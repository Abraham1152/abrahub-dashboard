import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'
import {
  getGoogleAdsCredentials,
  googleAdsMutateCampaign,
  googleAdsMutateBudget,
  googleAdsQuery,
  realToMicros,
  microsToReal,
  googleRateLimit,
  type GoogleAdsCredentials,
} from '../_shared/google-ads-api.ts'

// ---------------------------------------------------------------------------
// Helper: log an action to ads_agent_actions
// ---------------------------------------------------------------------------
async function logAction(
  supabase: ReturnType<typeof getServiceClient>,
  actionType: string,
  campaignId: string | null,
  status: 'success' | 'error',
  details: Record<string, unknown>,
  source: string,
) {
  await supabase.from('ads_agent_actions').insert({
    action_type: actionType,
    campaign_id: campaignId,
    campaign_name: details.campaign_name || null,
    status,
    details,
    source,
    platform: 'google',
    created_at: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handlePause(
  supabase: ReturnType<typeof getServiceClient>,
  campaignId: string,
  creds: GoogleAdsCredentials,
  source: string,
): Promise<Response> {
  await googleRateLimit()
  await googleAdsMutateCampaign(creds, campaignId, { status: 'PAUSED' }, 'status')

  await supabase
    .from('google_ads_campaigns')
    .update({ status: 'PAUSED' })
    .eq('campaign_id', campaignId)

  await logAction(supabase, 'pause_campaign', campaignId, 'success', {}, source)

  return jsonResponse({ success: true, campaign_id: campaignId, status: 'PAUSED' })
}

async function handleResume(
  supabase: ReturnType<typeof getServiceClient>,
  campaignId: string,
  creds: GoogleAdsCredentials,
  source: string,
): Promise<Response> {
  await googleRateLimit()
  await googleAdsMutateCampaign(creds, campaignId, { status: 'ENABLED' }, 'status')

  await supabase
    .from('google_ads_campaigns')
    .update({ status: 'ENABLED' })
    .eq('campaign_id', campaignId)

  await logAction(supabase, 'resume_campaign', campaignId, 'success', {}, source)

  return jsonResponse({ success: true, campaign_id: campaignId, status: 'ENABLED' })
}

async function handleBudget(
  supabase: ReturnType<typeof getServiceClient>,
  campaignId: string,
  creds: GoogleAdsCredentials,
  body: Record<string, unknown>,
  source: string,
): Promise<Response> {
  const dailyBudget = body.daily_budget as number | undefined
  if (dailyBudget === undefined || typeof dailyBudget !== 'number' || dailyBudget <= 0) {
    return jsonResponse({ error: 'daily_budget is required and must be a positive number' }, 400)
  }

  // Fetch current budget for audit trail
  const { data: current } = await supabase
    .from('google_ads_campaigns')
    .select('daily_budget')
    .eq('campaign_id', campaignId)
    .single()

  const oldBudget = current?.daily_budget ?? null

  // Google Ads: need to find the campaign's budget resource name first
  const budgetResults = await googleAdsQuery(creds, `
    SELECT campaign.id, campaign_budget.id
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `)

  if (!budgetResults.length || !budgetResults[0].campaignBudget?.id) {
    return jsonResponse({ error: 'Campaign budget not found in Google Ads' }, 404)
  }

  const budgetId = String(budgetResults[0].campaignBudget.id)

  await googleRateLimit()
  await googleAdsMutateBudget(creds, budgetId, realToMicros(dailyBudget))

  await supabase
    .from('google_ads_campaigns')
    .update({ daily_budget: dailyBudget })
    .eq('campaign_id', campaignId)

  await logAction(supabase, 'update_budget', campaignId, 'success', {
    old_budget: oldBudget,
    new_budget: dailyBudget,
    reason: (body.reason as string) || null,
  }, source)

  return jsonResponse({
    success: true,
    campaign_id: campaignId,
    old_budget: oldBudget,
    new_budget: dailyBudget,
  })
}

async function handleGetConfig(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from('google_ads_config')
    .select('id, customer_id, is_connected, last_token_refresh, created_at, updated_at')
    .single()

  if (error) {
    return jsonResponse({ error: `Failed to fetch config: ${error.message}` }, 500)
  }

  return jsonResponse(data)
}

async function handleUpdateConfig(
  supabase: ReturnType<typeof getServiceClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const { data: config, error: fetchError } = await supabase
    .from('google_ads_config')
    .select('id')
    .single()

  if (fetchError || !config) {
    return jsonResponse({ error: `Config not found: ${fetchError?.message || 'no rows'}` }, 404)
  }

  // Determine connection status
  const isConnected = !!(body.customer_id && body.refresh_token && body.developer_token)

  const { data, error } = await supabase
    .from('google_ads_config')
    .update({
      customer_id: body.customer_id || null,
      client_id: body.client_id || null,
      client_secret: body.client_secret || null,
      refresh_token: body.refresh_token || null,
      developer_token: body.developer_token || null,
      is_connected: isConnected,
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id)
    .select('id, customer_id, is_connected, updated_at')
    .single()

  if (error) {
    return jsonResponse({ error: `Failed to update config: ${error.message}` }, 500)
  }

  return jsonResponse(data)
}

async function handleTestConnection(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<Response> {
  try {
    const creds = await getGoogleAdsCredentials(supabase)

    // Simple query to test the connection
    const results = await googleAdsQuery(creds, `
      SELECT customer.id, customer.descriptive_name
      FROM customer
      LIMIT 1
    `)

    const customer = results[0]?.customer || {}

    // Mark as connected
    await supabase
      .from('google_ads_config')
      .update({ is_connected: true, updated_at: new Date().toISOString() })
      .eq('customer_id', creds.customerId)

    return jsonResponse({
      success: true,
      customer_id: customer.id,
      customer_name: customer.descriptiveName || 'Unknown',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: msg, success: false }, 400)
  }
}

// ---------------------------------------------------------------------------
// Main serve handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').filter(Boolean)

    const idx = path.indexOf('google-ads-actions')
    const action = path[idx + 1] || ''
    const param = path[idx + 2] || ''

    const supabase = getServiceClient()

    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        // Body may be empty
      }
    }

    const source = (body?.source as string) || 'manual'

    // -----------------------------------------------------------------------
    // POST /pause/{campaign_id}
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'pause') {
      if (!param) return jsonResponse({ error: 'campaign_id is required' }, 400)
      try {
        const creds = await getGoogleAdsCredentials(supabase)
        return await handlePause(supabase, param, creds, source)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await logAction(supabase, 'pause_campaign', param, 'error', { error: msg }, source)
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /resume/{campaign_id}
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'resume') {
      if (!param) return jsonResponse({ error: 'campaign_id is required' }, 400)
      try {
        const creds = await getGoogleAdsCredentials(supabase)
        return await handleResume(supabase, param, creds, source)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await logAction(supabase, 'resume_campaign', param, 'error', { error: msg }, source)
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /budget/{campaign_id}
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'budget') {
      if (!param) return jsonResponse({ error: 'campaign_id is required' }, 400)
      try {
        const creds = await getGoogleAdsCredentials(supabase)
        return await handleBudget(supabase, param, creds, body, source)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await logAction(supabase, 'update_budget', param, 'error', { error: msg }, source)
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // GET /config
    // -----------------------------------------------------------------------
    if (req.method === 'GET' && action === 'config') {
      return await handleGetConfig(supabase)
    }

    // -----------------------------------------------------------------------
    // POST /config
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'config') {
      return await handleUpdateConfig(supabase, body)
    }

    // -----------------------------------------------------------------------
    // POST /test-connection
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'test-connection') {
      return await handleTestConnection(supabase)
    }

    // -----------------------------------------------------------------------
    // Fallback
    // -----------------------------------------------------------------------
    return jsonResponse({
      error: 'Unknown route',
      available_routes: [
        'POST /pause/{campaign_id}',
        'POST /resume/{campaign_id}',
        'POST /budget/{campaign_id}',
        'GET  /config',
        'POST /config',
        'POST /test-connection',
      ],
    }, 404)

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('google-ads-actions error:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
