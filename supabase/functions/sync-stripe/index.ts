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

    // --- PRE-PASS: Fetch subscriptions to build amount → interval map ---
    const amountToInterval: Record<number, string> = {} // amount_in_centavos -> 'month' | 'year'
    const customerToInterval: Record<string, string> = {} // customer_id -> interval
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params = new URLSearchParams({ 'limit': '100', 'status': 'all' })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      })
      const subs = await res.json()
      if (subs.error) break

      for (const sub of subs.data || []) {
        const item = sub.items?.data?.[0]
        const interval = item?.price?.recurring?.interval || sub.plan?.interval
        const unitAmount = item?.price?.unit_amount || sub.plan?.amount

        if (interval && unitAmount) {
          amountToInterval[unitAmount] = interval
        }
        if (interval && sub.customer) {
          const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
          customerToInterval[custId] = interval
        }
      }

      hasMore = subs.has_more
      if (hasMore && subs.data?.length > 0) {
        startingAfter = subs.data[subs.data.length - 1].id
      }
    }

    // --- Also fetch invoices to build a secondary map via line descriptions ---
    // New Stripe API removed charge/subscription/payment_intent from invoice response
    // But invoice.parent.subscription_details.subscription still exists
    // And line descriptions contain "/ year" or "/ month"
    const invoiceCustomerType: Record<string, Record<number, string>> = {} // customer -> { amount -> interval }
    hasMore = true
    startingAfter = undefined

    while (hasMore) {
      const params = new URLSearchParams({
        'created[gte]': since.toString(),
        'limit': '100',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/invoices?${params}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` },
      })
      const invoices = await res.json()
      if (invoices.error) break

      for (const inv of invoices.data || []) {
        const lineDesc = inv.lines?.data?.[0]?.description || ''
        const customer = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
        const amountPaid = inv.amount_paid || 0

        let interval = ''
        if (lineDesc.includes('/ year') || lineDesc.includes('/ ano')) {
          interval = 'year'
        } else if (lineDesc.includes('/ month') || lineDesc.includes('/ mês') || lineDesc.includes('/ mes')) {
          interval = 'month'
        }

        // Also try via parent.subscription_details
        if (!interval && inv.parent?.subscription_details?.subscription) {
          const subId = inv.parent.subscription_details.subscription
          if (typeof subId === 'string') {
            try {
              const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
                headers: { 'Authorization': `Bearer ${stripeKey}` },
              })
              const sub = await subRes.json()
              if (!sub.error) {
                interval = sub.items?.data?.[0]?.price?.recurring?.interval || sub.plan?.interval || ''
              }
            } catch { /* continue */ }
          }
        }

        if (interval && customer && amountPaid > 0) {
          if (!invoiceCustomerType[customer]) invoiceCustomerType[customer] = {}
          invoiceCustomerType[customer][amountPaid] = interval
          // Also add to amount map as additional data
          if (!amountToInterval[amountPaid]) amountToInterval[amountPaid] = interval
        }
      }

      hasMore = invoices.has_more
      if (hasMore && invoices.data?.length > 0) {
        startingAfter = invoices.data[invoices.data.length - 1].id
      }
    }

    // --- PASS 1: Fetch Charges ---
    const dailyRevenue: Record<string, { stripe: number; fees: number }> = {}
    hasMore = true
    startingAfter = undefined

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
        const custId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id || ''

        // Aggregate daily
        if (!dailyRevenue[date]) dailyRevenue[date] = { stripe: 0, fees: 0 }
        dailyRevenue[date].stripe += amount
        dailyRevenue[date].fees += fee

        // Determine subscription type using multiple strategies
        let txType = 'one_time'
        let productName = charge.description || 'Pagamento Stripe'

        // Strategy 1: Match by amount (centavos) → interval from subscriptions
        if (amountToInterval[charge.amount]) {
          const interval = amountToInterval[charge.amount]
          txType = interval === 'year' ? 'annual' : 'recurring'
        }
        // Strategy 2: Match by customer+amount from invoices
        else if (custId && invoiceCustomerType[custId]?.[charge.amount]) {
          const interval = invoiceCustomerType[custId][charge.amount]
          txType = interval === 'year' ? 'annual' : 'recurring'
        }
        // Strategy 3: Match by customer's subscription
        else if (custId && customerToInterval[custId]) {
          const interval = customerToInterval[custId]
          txType = interval === 'year' ? 'annual' : 'recurring'
        }

        // Clean up product name
        if (productName.startsWith('Invoice ')) {
          productName = productName.replace(/^Invoice [A-Z0-9-]+ /, '')
        }
        if (!productName || productName === 'null') productName = 'Pagamento Stripe'

        // Upsert individual transaction
        const { error: upsertErr } = await supabase.from('revenue_transactions').upsert(
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
              payment_intent: charge.payment_intent || null,
              payment_method: charge.payment_method_details?.type || null,
            },
          },
          { onConflict: 'transaction_id' }
        )
        if (upsertErr) {
          console.error(`Stripe upsert failed for ${charge.id} (${date}):`, upsertErr.message)
        }
        totalRecords++
      }

      hasMore = charges.has_more
      if (hasMore && charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id
      }
    }

    // --- PASS 2: Fetch Refunds ---
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
        const { error: refundErr } = await supabase.from('revenue_transactions').upsert(
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
        if (refundErr) {
          console.error(`Stripe refund upsert failed for ${refund.id} (${date}):`, refundErr.message)
        }
        totalRecords++
      }

      hasMore = refunds.has_more
      if (hasMore && refunds.data.length > 0) {
        startingAfter = refunds.data[refunds.data.length - 1].id
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
        const { error: updateErr } = await supabase
          .from('financial_daily')
          .update({ revenue_stripe: revenue, refunds, fees })
          .eq('id', existing.id)
        if (updateErr) console.error(`financial_daily update failed for ${date}:`, updateErr.message)
      } else {
        const { error: insertErr } = await supabase
          .from('financial_daily')
          .insert({ date, revenue_stripe: revenue, revenue_kiwify: 0, refunds, fees })
        if (insertErr) console.error(`financial_daily insert failed for ${date}:`, insertErr.message)
      }
    }

    // Collect date stats for diagnostics
    const allRevDates = Object.keys(dailyRevenue).sort()
    const latestDate = allRevDates[allRevDates.length - 1] || 'none'
    const earliestDate = allRevDates[0] || 'none'

    await logSync('stripe', 'success', totalRecords)
    return jsonResponse({
      success: true,
      records: totalRecords,
      price_map: amountToInterval,
      customer_map_size: Object.keys(customerToInterval).length,
      date_range: { earliest: earliestDate, latest: latestDate },
      unique_dates: allRevDates.length,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('stripe', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
