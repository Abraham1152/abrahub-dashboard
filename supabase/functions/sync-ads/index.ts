import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, logSync, jsonResponse, corsHeaders, todayDate } from '../_shared/supabase-client.ts'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

async function metaFetch(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Meta API returned non-JSON (${res.status}): ${text.substring(0, 200)}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const accessToken = Deno.env.get('META_ADS_ACCESS_TOKEN')
  const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID')

  if (!accessToken || !adAccountId) {
    return jsonResponse({ error: 'Meta Ads credentials not configured' }, 500)
  }

  const supabase = getServiceClient()
  const accountRef = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  try {
    await logSync('ads', 'running')
    let totalRecords = 0

    // --- Fetch Campaigns ---
    const campaignsData = await metaFetch(
      `${GRAPH_API}/${accountRef}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time&limit=100&access_token=${accessToken}`
    )

    if (campaignsData.error) {
      const err = campaignsData.error as Record<string, unknown>
      throw new Error(`Campaigns: ${err.message || JSON.stringify(err)}`)
    }

    const campaigns = (campaignsData.data as Array<Record<string, unknown>>) || []
    const campaignRows: Array<Record<string, unknown>> = []

    let totalSpend = 0
    let totalImpressions = 0
    let totalClicks = 0
    let totalReach = 0
    let totalConversions = 0
    let activeCampaigns = 0

    for (const campaign of campaigns) {
      const status = (campaign.status as string) || 'UNKNOWN'
      if (status === 'ACTIVE') activeCampaigns++

      // Fetch insights for each campaign
      let impressions = 0
      let clicks = 0
      let reach = 0
      let spend = 0
      let cpc = 0
      let cpm = 0
      let ctr = 0
      let conversions = 0
      let costPerResult = 0

      try {
        const insightsData = await metaFetch(
          `${GRAPH_API}/${campaign.id}/insights?fields=impressions,clicks,reach,spend,cpc,cpm,ctr,actions&date_preset=last_30d&access_token=${accessToken}`
        )

        const insightsArr = (insightsData.data as Array<Record<string, unknown>>) || []
        if (insightsArr.length > 0) {
          const ins = insightsArr[0]
          impressions = parseInt(ins.impressions as string || '0', 10)
          clicks = parseInt(ins.clicks as string || '0', 10)
          reach = parseInt(ins.reach as string || '0', 10)
          spend = parseFloat(ins.spend as string || '0')
          cpc = parseFloat(ins.cpc as string || '0')
          cpm = parseFloat(ins.cpm as string || '0')
          ctr = parseFloat(ins.ctr as string || '0')

          // Extract conversions from actions array
          const actions = (ins.actions as Array<Record<string, unknown>>) || []
          for (const action of actions) {
            if (action.action_type === 'offsite_conversion.fb_pixel_purchase' ||
                action.action_type === 'purchase' ||
                action.action_type === 'lead') {
              conversions += parseInt(action.value as string || '0', 10)
            }
          }

          if (conversions > 0) {
            costPerResult = spend / conversions
          }
        }
      } catch {
        // Some campaigns may not have insights
      }

      // Accumulate totals
      totalSpend += spend
      totalImpressions += impressions
      totalClicks += clicks
      totalReach += reach
      totalConversions += conversions

      // Budget values from Meta come in cents
      const dailyBudget = campaign.daily_budget ? parseFloat(campaign.daily_budget as string) / 100 : null
      const lifetimeBudget = campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget as string) / 100 : null

      campaignRows.push({
        campaign_id: campaign.id as string,
        account_id: adAccountId,
        name: (campaign.name as string) || 'Sem nome',
        status,
        objective: (campaign.objective as string) || null,
        daily_budget: dailyBudget,
        lifetime_budget: lifetimeBudget,
        impressions,
        clicks,
        reach,
        spend,
        cpc,
        cpm,
        ctr,
        conversions,
        cost_per_result: costPerResult,
        created_time: (campaign.created_time as string) || null,
        updated_time: (campaign.updated_time as string) || null,
        last_synced_at: new Date().toISOString(),
      })

      // Rate limit delay
      await new Promise(r => setTimeout(r, 200))
    }

    // Batch upsert campaigns
    if (campaignRows.length > 0) {
      await supabase.from('ads_campaigns').upsert(campaignRows, { onConflict: 'campaign_id' })
      totalRecords += campaignRows.length
    }

    // Upsert daily summary
    const today = todayDate()
    await supabase.from('ads_daily').upsert(
      {
        date: today,
        account_id: adAccountId,
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_reach: totalReach,
        total_conversions: totalConversions,
        active_campaigns: activeCampaigns,
      },
      { onConflict: 'date,account_id' }
    )
    totalRecords++

    await logSync('ads', 'success', totalRecords)

    // Trigger autonomous optimizer after successful sync
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
          }
        )
      }
    } catch {
      // Optimizer failure should not fail the sync
    }

    return jsonResponse({
      success: true,
      records: totalRecords,
      campaigns_synced: campaignRows.length,
      active_campaigns: activeCampaigns,
      total_spend: totalSpend,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logSync('ads', 'error', 0, msg)
    return jsonResponse({ error: msg }, 500)
  }
})
