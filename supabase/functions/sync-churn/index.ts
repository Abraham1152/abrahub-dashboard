import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders, todayDate, daysAgoUnix } from '../_shared/supabase-client.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 500)
  }

  const supabase = getServiceClient()
  const headers = { 'Authorization': `Bearer ${stripeKey}` }

  try {
    await logSync('churn', 'running')

    const thirtyDaysAgo = daysAgoUnix(30)

    // --- Count Active Subscriptions ---
    let totalActive = 0
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params = new URLSearchParams({ status: 'active', limit: '100' })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, { headers })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      totalActive += (data.data || []).length
      hasMore = data.has_more
      if (hasMore && data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id
      }
    }

    // --- Count New Subscriptions (last 30 days) ---
    let newCustomers = 0
    hasMore = true
    startingAfter = undefined

    while (hasMore) {
      const params = new URLSearchParams({
        status: 'active',
        'created[gte]': thirtyDaysAgo.toString(),
        limit: '100',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, { headers })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      newCustomers += (data.data || []).length
      hasMore = data.has_more
      if (hasMore && data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id
      }
    }

    // --- Count Canceled Subscriptions (last 30 days) ---
    let churnedCustomers = 0
    hasMore = true
    startingAfter = undefined

    while (hasMore) {
      const params = new URLSearchParams({
        status: 'canceled',
        'created[gte]': thirtyDaysAgo.toString(),
        limit: '100',
      })
      if (startingAfter) params.set('starting_after', startingAfter)

      const res = await fetch(`https://api.stripe.com/v1/subscriptions?${params}`, { headers })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      churnedCustomers += (data.data || []).length
      hasMore = data.has_more
      if (hasMore && data.data.length > 0) {
        startingAfter = data.data[data.data.length - 1].id
      }
    }

    // --- Calculate Metrics ---
    const totalCustomers = totalActive
    const churnPercentage = totalActive + churnedCustomers > 0
      ? (churnedCustomers / (totalActive + churnedCustomers)) * 100
      : 0

    // Estimate LTV: get average revenue per customer from last 30 days
    const { data: revenueData } = await supabase
      .from('financial_daily')
      .select('revenue_stripe')
      .gte('date', new Date(thirtyDaysAgo * 1000).toISOString().split('T')[0])

    const totalRevenue30d = (revenueData || []).reduce((sum, r) => sum + (r.revenue_stripe || 0), 0)
    const avgRevenuePerCustomer = totalActive > 0 ? totalRevenue30d / totalActive : 0
    const monthlyChurnRate = churnPercentage / 100
    const ltvEstimated = monthlyChurnRate > 0 ? avgRevenuePerCustomer / monthlyChurnRate : 0

    // --- Upsert into churn_metrics ---
    const today = todayDate()
    await supabase.from('churn_metrics').upsert(
      {
        date: today,
        total_customers: totalCustomers,
        new_customers: newCustomers,
        churned_customers: churnedCustomers,
        churn_percentage: Math.round(churnPercentage * 100) / 100,
        ltv_estimated: Math.round(ltvEstimated * 100) / 100,
      },
      { onConflict: 'date' }
    )

    await logSync('churn', 'success', 1)
    return jsonResponse({
      success: true,
      metrics: {
        totalCustomers,
        newCustomers,
        churnedCustomers,
        churnPercentage: Math.round(churnPercentage * 100) / 100,
        ltvEstimated: Math.round(ltvEstimated * 100) / 100,
      },
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('churn', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
