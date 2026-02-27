import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders, todayDate } from '../_shared/supabase-client.ts'
import { getGoogleAdsCredentials, googleAdsQuery, microsToReal, googleRateLimit } from '../_shared/google-ads-api.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const supabase = getServiceClient()

  try {
    await logSync('google-ads', 'running')

    const creds = await getGoogleAdsCredentials(supabase)

    // Fetch campaigns with last 30 days metrics via GAQL
    const results = await googleAdsQuery(creds, `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.conversions_from_interactions_rate,
        metrics.search_impression_share
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
        AND campaign.status != 'REMOVED'
    `)

    const campaignRows: Array<Record<string, unknown>> = []
    let totalCost = 0
    let totalImpressions = 0
    let totalClicks = 0
    let totalConversions = 0
    let activeCampaigns = 0

    for (const row of results) {
      const c = row.campaign || {}
      const m = row.metrics || {}
      const budget = row.campaignBudget || {}

      const status = c.status || 'UNKNOWN'
      if (status === 'ENABLED') activeCampaigns++

      const cost = microsToReal(m.costMicros || '0')
      const dailyBudget = microsToReal(budget.amountMicros || '0')
      const conversions = parseFloat(m.conversions || '0')
      const impressions = parseInt(m.impressions || '0', 10)
      const clicks = parseInt(m.clicks || '0', 10)

      totalCost += cost
      totalImpressions += impressions
      totalClicks += clicks
      totalConversions += conversions

      campaignRows.push({
        campaign_id: String(c.id),
        customer_id: creds.customerId,
        name: c.name || 'Sem nome',
        status,
        campaign_type: c.advertisingChannelType || null,
        bidding_strategy: c.biddingStrategyType || null,
        daily_budget: dailyBudget,
        impressions,
        clicks,
        cost,
        cpc: microsToReal(m.averageCpc || '0'),
        cpm: microsToReal(m.averageCpm || '0'),
        ctr: parseFloat(m.ctr || '0') * 100, // Google returns as decimal
        conversions,
        cost_per_conversion: microsToReal(m.costPerConversion || '0'),
        conversion_rate: parseFloat(m.conversionsFromInteractionsRate || '0') * 100,
        search_impression_share: m.searchImpressionShare
          ? parseFloat(m.searchImpressionShare) * 100
          : null,
        last_synced_at: new Date().toISOString(),
      })

      await googleRateLimit()
    }

    // Batch upsert campaigns
    if (campaignRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('google_ads_campaigns')
        .upsert(campaignRows, { onConflict: 'campaign_id' })

      if (upsertError) {
        throw new Error(`Upsert error: ${upsertError.message}`)
      }
    }

    // Daily summary snapshot
    const today = todayDate()
    await supabase.from('google_ads_daily').upsert(
      {
        date: today,
        customer_id: creds.customerId,
        total_cost: totalCost,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        active_campaigns: activeCampaigns,
      },
      { onConflict: 'date,customer_id' },
    )

    await logSync('google-ads', 'success', campaignRows.length)

    // Trigger optimizer after sync (same pattern as Meta sync)
    try {
      const { data: optConfig } = await supabase
        .from('ads_optimization_config')
        .select('optimizer_enabled')
        .single()

      if (optConfig?.optimizer_enabled) {
        await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/ads-optimizer`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ platform: 'google' }),
          },
        )
      }
    } catch {
      // Optimizer failure should not fail the sync
    }

    return jsonResponse({
      success: true,
      campaigns_synced: campaignRows.length,
      active_campaigns: activeCampaigns,
      total_cost: totalCost,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('google-ads', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
