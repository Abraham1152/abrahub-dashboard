import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders, daysAgoUnix, todayDate } from '../_shared/supabase-client.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 500)
  }

  const supabase = getServiceClient()

  try {
    await logSync('stripe', 'running')

    const since = daysAgoUnix(90)
    let totalRecords = 0

    // --- Fetch Charges with invoice expansion ---
    const dailyRevenue: Record<string, { stripe: number; fees: number }> = {}
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params = new URLSearchParams({
        'created[gte]': since.toString(),
        'limit': '100',
        'expand[]': 'data.balance_transaction',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/charges?${params}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      })
      const charges = await res.json()

      if (charges.error) throw new Error(charges.error.message)

      for (const charge of charges.data || []) {
        if (charge.status !== 'succeeded') continue

        const date = new Date(charge.created * 1000).toISOString().split('T')[0]
        const amount = charge.amount / 100
        const fee = charge.balance_transaction?.fee ? charge.balance_transaction.fee / 100 : 0

        // Aggregate daily
        if (!dailyRevenue[date]) dailyRevenue[date] = { stripe: 0, fees: 0 }
        dailyRevenue[date].stripe += amount
        dailyRevenue[date].fees += fee

        // Determine subscription type
        let txType = 'one_time'
        let productName = charge.description || 'Pagamento Stripe'

        if (charge.invoice) {
          // Has invoice = subscription charge
          txType = 'recurring'
          // Try to extract product name from description
          if (charge.description) {
            if (charge.description.toLowerCase().includes('anual') || charge.description.toLowerCase().includes('annual') || charge.description.toLowerCase().includes('yearly')) {
              txType = 'annual'
            }
          }
        }

        // Clean up product name
        if (productName.startsWith('Invoice ')) {
          productName = productName.replace(/^Invoice [A-Z0-9-]+ /, '')
        }
        if (!productName || productName === 'null') productName = 'Pagamento Stripe'

        // Upsert individual transaction
        await supabase.from('revenue_transactions').upsert(
          {
            date,
            source: 'stripe',
            transaction_id: charge.id,
            product_name: productName.substring(0, 200),
            amount,
            type: txType,
            status: 'paid',
            customer_email: charge.billing_details?.email || charge.receipt_email || null,
            metadata: {
              fee,
              invoice_id: charge.invoice || null,
              payment_method: charge.payment_method_details?.type || null,
            },
          },
          { onConflict: 'transaction_id' }
        )
        totalRecords++
      }

      hasMore = charges.has_more
      if (hasMore && charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id
      }
    }

    // --- Fetch Refunds ---
    const dailyRefunds: Record<string, number> = {}
    hasMore = true
    startingAfter = undefined

    while (hasMore) {
      const params = new URLSearchParams({
        'created[gte]': since.toString(),
        'limit': '100',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/refunds?${params}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      })
      const refunds = await res.json()

      if (refunds.error) throw new Error(refunds.error.message)

      for (const refund of refunds.data || []) {
        if (refund.status !== 'succeeded') continue
        const date = new Date(refund.created * 1000).toISOString().split('T')[0]
        const amount = refund.amount / 100
        dailyRefunds[date] = (dailyRefunds[date] || 0) + amount

        // Store refund as negative transaction
        await supabase.from('revenue_transactions').upsert(
          {
            date,
            source: 'stripe',
            transaction_id: refund.id,
            product_name: 'Reembolso',
            amount: -amount,
            type: 'one_time',
            status: 'refunded',
            customer_email: null,
            metadata: { charge_id: refund.charge },
          },
          { onConflict: 'transaction_id' }
        )
        totalRecords++
      }

      hasMore = refunds.has_more
      if (hasMore && refunds.data.length > 0) {
        startingAfter = refunds.data[refunds.data.length - 1].id
      }
    }

    // --- Also fetch subscriptions for better type detection ---
    hasMore = true
    startingAfter = undefined
    const subscriptionIntervals: Record<string, string> = {} // charge_id -> interval

    while (hasMore) {
      const params = new URLSearchParams({
        'created[gte]': since.toString(),
        'limit': '100',
        'expand[]': 'data.plan',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/invoices?${params}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      })
      const invoices = await res.json()

      if (invoices.error) break // Non-critical, continue without

      for (const inv of invoices.data || []) {
        if (!inv.charge) continue
        const interval = inv.lines?.data?.[0]?.plan?.interval || inv.lines?.data?.[0]?.price?.recurring?.interval
        const productDesc = inv.lines?.data?.[0]?.description || inv.lines?.data?.[0]?.plan?.nickname || null

        if (interval) {
          const txType = interval === 'year' ? 'annual' : 'recurring'
          // Update the already-inserted transaction with correct type and product name
          const updateData: Record<string, unknown> = { type: txType }
          if (productDesc) updateData.product_name = productDesc.substring(0, 200)

          await supabase
            .from('revenue_transactions')
            .update(updateData)
            .eq('transaction_id', inv.charge)
        }
      }

      hasMore = invoices.has_more
      if (hasMore && invoices.data.length > 0) {
        startingAfter = invoices.data[invoices.data.length - 1].id
      }
    }

    // --- Upsert into financial_daily ---
    const allDates = new Set([...Object.keys(dailyRevenue), ...Object.keys(dailyRefunds)])

    for (const date of allDates) {
      const revenue = dailyRevenue[date]?.stripe || 0
      const fees = dailyRevenue[date]?.fees || 0
      const refunds = dailyRefunds[date] || 0

      const { data: existing } = await supabase
        .from('financial_daily')
        .select('id, revenue_kiwify')
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('financial_daily')
          .update({ revenue_stripe: revenue, refunds, fees, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('financial_daily')
          .insert({ date, revenue_stripe: revenue, revenue_kiwify: 0, refunds, fees })
      }
    }

    await logSync('stripe', 'success', totalRecords)
    return jsonResponse({ success: true, records: totalRecords })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('stripe', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
