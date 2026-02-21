import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const clientId = Deno.env.get('KIWIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('KIWIFY_CLIENT_SECRET')
  const accountId = Deno.env.get('KIWIFY_ACCOUNT_ID')

  if (!clientId || !clientSecret || !accountId) {
    return jsonResponse({ error: 'Kiwify credentials not configured' }, 500)
  }

  const supabase = getServiceClient()

  try {
    await logSync('kiwify', 'running')

    // --- Get OAuth Token ---
    const cid = clientId.trim()
    const csec = clientSecret.trim()
    const body = `client_id=${encodeURIComponent(cid)}&client_secret=${encodeURIComponent(csec)}`

    const tokenRes = await fetch('https://public-api.kiwify.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      throw new Error(`Kiwify token failed (${tokenRes.status}): ${JSON.stringify(tokenData)}`)
    }

    const token = tokenData.access_token

    // --- Fetch Sales (last 90 days) ---
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const params = new URLSearchParams({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      page_number: '1',
      page_size: '100',
    })

    const dailyRevenue: Record<string, number> = {}
    const dailyRefunds: Record<string, number> = {}
    const transactions: Array<Record<string, unknown>> = []
    let totalRecords = 0
    let pageNum = 1
    let hasMore = true
    const acctId = accountId.trim()

    while (hasMore) {
      params.set('page_number', pageNum.toString())

      const salesUrl = `https://public-api.kiwify.com/v1/sales?${params}`
      const salesRes = await fetch(salesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-kiwify-account-id': acctId,
        },
      })
      const salesData = await salesRes.json()

      if (salesData.error) {
        const errMsg = typeof salesData.error === 'string' ? salesData.error : JSON.stringify(salesData.error)
        throw new Error(`Sales API error (${salesRes.status}): ${errMsg}, message: ${salesData.message || 'none'}`)
      }

      const sales = salesData.data || []

      for (const sale of sales) {
        const date = (sale.created_at || '').split('T')[0]
        if (!date) continue

        // Kiwify API returns `net_amount` in centavos (integer)
        const netAmountCents = sale.net_amount || 0
        const amount = netAmountCents / 100

        const productName = sale.product?.name || 'Produto Kiwify'
        const planName = sale.product?.plan_name || ''

        // Determine transaction type from product plan
        let txType = 'one_time'
        if (planName) {
          const planLower = planName.toLowerCase()
          if (planLower.includes('anual') || planLower.includes('annual') || planLower.includes('year')) {
            txType = 'annual'
          } else if (planLower.includes('mensal') || planLower.includes('monthly') || planLower.includes('parcela') || planLower.includes('semestral')) {
            txType = 'recurring'
          } else {
            txType = 'recurring'
          }
        }

        const isRefund = sale.status === 'refunded' || sale.status === 'chargedback'
        const isPaid = sale.status === 'paid' || sale.status === 'approved'

        if (isRefund) {
          dailyRefunds[date] = (dailyRefunds[date] || 0) + amount
        } else if (isPaid) {
          dailyRevenue[date] = (dailyRevenue[date] || 0) + amount
        }

        totalRecords++

        transactions.push({
          date,
          source: 'kiwify',
          transaction_id: sale.id,
          product_name: (productName || '').substring(0, 200),
          amount: isRefund ? -amount : amount,
          type: txType,
          status: sale.status || 'unknown',
          customer_email: sale.customer?.email || null,
          metadata: {
            plan_name: planName || null,
            offer_name: sale.product?.offer_name || null,
            payment_method: sale.payment_method || null,
            reference: sale.reference || null,
            net_amount_cents: netAmountCents,
          },
        })
      }

      // Check pagination
      const pagination = salesData.pagination
      if (pagination) {
        const totalPages = Math.ceil(pagination.count / (pagination.page_size || 100))
        hasMore = pageNum < totalPages
      } else {
        hasMore = sales.length >= 100
      }
      pageNum++

      if (hasMore) await new Promise(r => setTimeout(r, 200))
    }

    // --- Delete old kiwify records with amount=0 before upserting ---
    await supabase.from('revenue_transactions')
      .delete()
      .eq('source', 'kiwify')
      .eq('amount', 0)

    // --- Batch upsert transactions (chunks of 200) ---
    for (let i = 0; i < transactions.length; i += 200) {
      const chunk = transactions.slice(i, i + 200)
      await supabase.from('revenue_transactions').upsert(chunk, { onConflict: 'transaction_id' })
    }

    // --- Batch upsert financial_daily ---
    const allDates = new Set([...Object.keys(dailyRevenue), ...Object.keys(dailyRefunds)])

    if (allDates.size > 0) {
      const dateArray = Array.from(allDates)
      const { data: existingRows } = await supabase
        .from('financial_daily')
        .select('id, date, revenue_stripe, refunds')
        .in('date', dateArray)

      const existingMap = new Map((existingRows || []).map(r => [r.date, r]))

      const toInsert: Array<Record<string, unknown>> = []
      const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = []

      for (const date of dateArray) {
        const revenue = dailyRevenue[date] || 0
        const refunds = dailyRefunds[date] || 0
        const existing = existingMap.get(date)

        if (existing) {
          toUpdate.push({
            id: existing.id,
            data: {
              revenue_kiwify: revenue,
              refunds: (existing.refunds || 0) + refunds,
            }
          })
        } else {
          toInsert.push({ date, revenue_stripe: 0, revenue_kiwify: revenue, refunds, fees: 0 })
        }
      }

      if (toInsert.length > 0) {
        await supabase.from('financial_daily').insert(toInsert)
      }

      for (const item of toUpdate) {
        await supabase.from('financial_daily').update(item.data).eq('id', item.id)
      }
    }

    await logSync('kiwify', 'success', totalRecords)
    return jsonResponse({ success: true, records: totalRecords })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('kiwify', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
