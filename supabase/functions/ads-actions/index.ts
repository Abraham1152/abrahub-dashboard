import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'
import { GRAPH_API, getMetaCredentials, metaPost, metaGet, rateLimit } from '../_shared/meta-api.ts'

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models'
const IG_ACCOUNT_ID = '17841451890607872'
const PAGE_ID = '925935230607764'

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
    status,
    details,
    source,
    created_at: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handlePause(
  supabase: ReturnType<typeof getServiceClient>,
  campaignId: string,
  accessToken: string,
  source: string,
): Promise<Response> {
  await rateLimit()
  await metaPost(campaignId, { status: 'PAUSED' }, accessToken)

  await supabase
    .from('ads_campaigns')
    .update({ status: 'PAUSED' })
    .eq('campaign_id', campaignId)

  await logAction(supabase, 'pause_campaign', campaignId, 'success', {}, source)

  return jsonResponse({ success: true, campaign_id: campaignId, status: 'PAUSED' })
}

async function handleResume(
  supabase: ReturnType<typeof getServiceClient>,
  campaignId: string,
  accessToken: string,
  source: string,
): Promise<Response> {
  await rateLimit()
  await metaPost(campaignId, { status: 'ACTIVE' }, accessToken)

  await supabase
    .from('ads_campaigns')
    .update({ status: 'ACTIVE' })
    .eq('campaign_id', campaignId)

  await logAction(supabase, 'resume_campaign', campaignId, 'success', {}, source)

  return jsonResponse({ success: true, campaign_id: campaignId, status: 'ACTIVE' })
}

async function handleBudget(
  supabase: ReturnType<typeof getServiceClient>,
  campaignId: string,
  accessToken: string,
  body: Record<string, unknown>,
  source: string,
): Promise<Response> {
  const dailyBudget = body.daily_budget as number | undefined
  if (dailyBudget === undefined || typeof dailyBudget !== 'number' || dailyBudget <= 0) {
    return jsonResponse({ error: 'daily_budget is required and must be a positive number' }, 400)
  }

  // Fetch current budget for the audit trail
  const { data: current } = await supabase
    .from('ads_campaigns')
    .select('daily_budget')
    .eq('campaign_id', campaignId)
    .single()

  const oldBudget = current?.daily_budget ?? null

  await rateLimit()
  // Meta API expects budget in cents as a string
  await metaPost(
    campaignId,
    { daily_budget: String(Math.round(dailyBudget * 100)) },
    accessToken,
  )

  await supabase
    .from('ads_campaigns')
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

async function handleCreateCampaign(
  supabase: ReturnType<typeof getServiceClient>,
  accountRef: string,
  accessToken: string,
  body: Record<string, unknown>,
  source: string,
): Promise<Response> {
  const name = body.name as string | undefined
  const dailyBudget = body.daily_budget as number | undefined

  if (!name || typeof name !== 'string') {
    return jsonResponse({ error: 'name is required' }, 400)
  }
  if (dailyBudget === undefined || typeof dailyBudget !== 'number' || dailyBudget <= 0) {
    return jsonResponse({ error: 'daily_budget is required and must be a positive number' }, 400)
  }

  // Step 1: Create Campaign
  await rateLimit()
  const campaignResult = await metaPost(`${accountRef}/campaigns`, {
    name,
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: '[]',
  }, accessToken)

  const campaignId = campaignResult.id as string

  await logAction(supabase, 'create_campaign', campaignId, 'success', {
    name,
    objective: 'OUTCOME_SALES',
  }, source)

  // Step 2: Create Ad Set
  await rateLimit()
  const adsetParams: Record<string, string> = {
    campaign_id: campaignId,
    name: `${name} - AdSet`,
    daily_budget: String(Math.round(dailyBudget * 100)),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    targeting: JSON.stringify(body.targeting || { geo_locations: { countries: ['BR'] } }),
    status: 'PAUSED',
  }

  if (body.pixel_id) {
    adsetParams.promoted_object = JSON.stringify({
      pixel_id: body.pixel_id,
      custom_event_type: 'PURCHASE',
    })
  }

  const adsetResult = await metaPost(`${accountRef}/adsets`, adsetParams, accessToken)
  const adsetId = adsetResult.id as string

  await logAction(supabase, 'create_adset', campaignId, 'success', {
    adset_id: adsetId,
    daily_budget: dailyBudget,
    targeting: body.targeting || { geo_locations: { countries: ['BR'] } },
  }, source)

  return jsonResponse({
    success: true,
    campaign_id: campaignId,
    adset_id: adsetId,
  })
}

async function handleGetConfig(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from('ads_optimization_config')
    .select('*')
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
  // Fetch existing config to get the ID
  const { data: config, error: fetchError } = await supabase
    .from('ads_optimization_config')
    .select('id')
    .single()

  if (fetchError || !config) {
    return jsonResponse({ error: `Config not found: ${fetchError?.message || 'no rows'}` }, 404)
  }

  const { data, error } = await supabase
    .from('ads_optimization_config')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', config.id)
    .select()
    .single()

  if (error) {
    return jsonResponse({ error: `Failed to update config: ${error.message}` }, 500)
  }

  return jsonResponse(data)
}

// ---------------------------------------------------------------------------
// AI Ad Creator handlers
// ---------------------------------------------------------------------------

async function handleFetchIgPosts(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from('instagram_posts')
    .select('media_id, media_type, caption, permalink, timestamp, like_count, comments_count, thumbnail_url, reach, impressions')
    .order('timestamp', { ascending: false })
    .limit(20)

  if (error) {
    return jsonResponse({ error: `Failed to fetch posts: ${error.message}` }, 500)
  }

  return jsonResponse({ posts: data || [] })
}

async function handleSearchInterests(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const keywords = body.keywords as string[] | undefined
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return jsonResponse({ error: 'keywords array is required' }, 400)
  }

  const results: Array<{ id: string; name: string; audience_size: number }> = []

  for (const keyword of keywords.slice(0, 10)) {
    await rateLimit()
    try {
      const data = await metaGet(
        `${GRAPH_API}/search?type=adinterest&q=${encodeURIComponent(keyword)}&limit=3&access_token=${accessToken}`
      )
      const items = (data.data as Array<Record<string, unknown>>) || []
      for (const item of items) {
        if (!results.find(r => r.id === item.id)) {
          results.push({
            id: item.id as string,
            name: item.name as string,
            audience_size: (item.audience_size as number) || 0,
          })
        }
      }
    } catch {
      // Skip failed keyword searches
    }
  }

  return jsonResponse({ interests: results })
}

async function handleAiStrategy(
  supabase: ReturnType<typeof getServiceClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500)
  }

  const postCaption = body.post_caption as string || ''
  const postType = body.post_type as string || 'IMAGE'
  const postEngagement = body.post_engagement as Record<string, unknown> || {}

  const [campaignsRes, configRes, dailyRes] = await Promise.all([
    supabase.from('ads_campaigns').select('*').order('spend', { ascending: false }).limit(10),
    supabase.from('ads_optimization_config').select('*').single(),
    supabase.from('ads_daily').select('*').order('date', { ascending: false }).limit(30),
  ])

  const campaigns = campaignsRes.data || []
  const config = configRes.data || null
  const dailyData = dailyRes.data || []

  const topCampaigns = campaigns
    .filter((c: Record<string, unknown>) => (c.spend as number) > 0)
    .map((c: Record<string, unknown>) => `"${c.name}": CTR=${((c.ctr as number) || 0).toFixed(2)}%, CPA=R$${((c.cost_per_result as number) || 0).toFixed(2)}, Conv=${c.conversions}, Gasto=R$${((c.spend as number) || 0).toFixed(2)}`)
    .join('\n')

  const totalSpend30d = dailyData.reduce((s: number, d: Record<string, unknown>) => s + ((d.total_spend as number) || 0), 0)
  const totalConv30d = dailyData.reduce((s: number, d: Record<string, unknown>) => s + ((d.total_conversions as number) || 0), 0)
  const avgCpa30d = totalConv30d > 0 ? totalSpend30d / totalConv30d : 0

  const systemPrompt = `Voce e o Estrategista de Trafego Pago da ABRAhub Studio.

Sua tarefa: analisar um post do Instagram que sera usado como creative de um anuncio Meta Ads e sugerir a melhor estrategia de campanha.

CONTEXTO DA CONTA:
- Objetivo: OUTCOME_TRAFFIC com otimizacao LINK_CLICKS (sem pixel)
- Pais: Brasil
- Plataformas: Facebook + Instagram
- Target CPA configurado: R$${config?.target_cpa ?? 'nao definido'}
- ROAS minimo: ${config?.min_roas ?? 'nao definido'}x
- Budget min/max diario: R$${config?.min_daily_budget ?? 10} - R$${config?.max_daily_budget ?? 200}
- CPA medio ultimos 30 dias: R$${avgCpa30d.toFixed(2)}
- Gasto total 30 dias: R$${totalSpend30d.toFixed(2)}
- Conversoes totais 30 dias: ${totalConv30d}

TOP CAMPANHAS (por performance):
${topCampaigns || 'Nenhuma campanha com dados ainda'}

POST SELECIONADO:
- Tipo: ${postType}
- Legenda: "${postCaption}"
- Engajamento: Likes=${postEngagement.likes || 0}, Comentarios=${postEngagement.comments || 0}, Alcance=${postEngagement.reach || 0}, Impressoes=${postEngagement.impressions || 0}

REGRAS:
- Responda APENAS em JSON valido, sem markdown, sem texto adicional
- interests: array de 5-8 palavras-chave em portugues para busca de interesses no Meta (serao usadas para buscar na API /search?type=adinterest)
- Escolha interesses relevantes ao conteudo do post e ao publico-alvo
- O budget deve respeitar min/max configurados
- cta_type deve ser um dos: LEARN_MORE, SHOP_NOW, SIGN_UP, SUBSCRIBE, WATCH_MORE, APPLY_NOW, BOOK_NOW, CONTACT_US, DOWNLOAD, GET_OFFER, GET_QUOTE, ORDER_NOW
- campaign_name deve seguir o padrao: "ABRAhub - [tema do post curto]"

RESPONDA com este JSON exato:
{
  "interests": ["palavra1", "palavra2"],
  "age_min": number,
  "age_max": number,
  "gender": "all" | "male" | "female",
  "daily_budget_brl": number,
  "cta_type": "LEARN_MORE",
  "campaign_name": "ABRAhub - ...",
  "reasoning": "Explicacao em portugues de por que essas escolhas"
}`

  const res = await fetch(
    `${GEMINI_API}/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: 'Analise este post e sugira a estrategia ideal de campanha Meta Ads.' }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
    }
  )

  const data = await res.json()
  if (data.error) {
    return jsonResponse({ error: `AI error: ${JSON.stringify(data.error).substring(0, 300)}` }, 500)
  }

  let answer = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  answer = answer.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  try {
    const strategy = JSON.parse(answer)
    return jsonResponse({ strategy })
  } catch {
    return jsonResponse({ error: 'AI returned invalid JSON', raw: answer }, 500)
  }
}

async function handleCreateFromPost(
  supabase: ReturnType<typeof getServiceClient>,
  accountRef: string,
  accessToken: string,
  body: Record<string, unknown>,
  source: string,
): Promise<Response> {
  const igMediaId = body.ig_media_id as string
  const destinationUrl = body.destination_url as string
  const campaignName = body.campaign_name as string
  const dailyBudget = body.daily_budget as number
  const targeting = body.targeting as Record<string, unknown>
  const ctaType = (body.cta_type as string) || 'LEARN_MORE'

  if (!igMediaId) return jsonResponse({ error: 'ig_media_id is required' }, 400)
  if (!destinationUrl) return jsonResponse({ error: 'destination_url is required' }, 400)
  if (!campaignName) return jsonResponse({ error: 'campaign_name is required' }, 400)
  if (!dailyBudget || dailyBudget <= 0) return jsonResponse({ error: 'daily_budget must be positive' }, 400)

  // Step 1: Create Campaign
  await rateLimit()
  const campaignResult = await metaPost(`${accountRef}/campaigns`, {
    name: campaignName,
    objective: 'OUTCOME_TRAFFIC',
    status: 'PAUSED',
    special_ad_categories: '[]',
  }, accessToken)
  const campaignId = campaignResult.id as string

  await logAction(supabase, 'create_campaign', campaignId, 'success', {
    name: campaignName,
    objective: 'OUTCOME_TRAFFIC',
    source: 'ai_ad_creator',
    ig_media_id: igMediaId,
  }, source)

  // Step 2: Create AdSet
  await rateLimit()
  const startTime = new Date()
  startTime.setHours(startTime.getHours() + 1)

  const adsetResult = await metaPost(`${accountRef}/adsets`, {
    campaign_id: campaignId,
    name: `${campaignName} - AdSet`,
    daily_budget: String(Math.round(dailyBudget * 100)),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    targeting: JSON.stringify(targeting || { geo_locations: { countries: ['BR'] } }),
    start_time: startTime.toISOString(),
    status: 'PAUSED',
    promoted_object: JSON.stringify({ page_id: PAGE_ID }),
  }, accessToken)
  const adsetId = adsetResult.id as string

  await logAction(supabase, 'create_adset', campaignId, 'success', {
    adset_id: adsetId, daily_budget: dailyBudget,
  }, source)

  // Step 3: Create Ad Creative (using existing IG post)
  await rateLimit()
  const creativeResult = await metaPost(`${accountRef}/adcreatives`, {
    name: `${campaignName} - Creative`,
    source_instagram_media_id: igMediaId,
    instagram_actor_id: IG_ACCOUNT_ID,
    call_to_action: JSON.stringify({ type: ctaType, value: { link: destinationUrl } }),
  }, accessToken)
  const creativeId = creativeResult.id as string

  await logAction(supabase, 'create_ad_creative', campaignId, 'success', {
    creative_id: creativeId, ig_media_id: igMediaId, cta_type: ctaType,
  }, source)

  // Step 4: Create Ad
  await rateLimit()
  const adResult = await metaPost(`${accountRef}/ads`, {
    name: `${campaignName} - Ad`,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: 'PAUSED',
  }, accessToken)
  const adId = adResult.id as string

  await logAction(supabase, 'create_ad', campaignId, 'success', {
    ad_id: adId, creative_id: creativeId, adset_id: adsetId, ig_media_id: igMediaId,
  }, source)

  return jsonResponse({
    success: true,
    campaign_id: campaignId,
    adset_id: adsetId,
    creative_id: creativeId,
    ad_id: adId,
    status: 'PAUSED',
  })
}

// ---------------------------------------------------------------------------
// Pending Actions handlers (human-in-the-loop)
// ---------------------------------------------------------------------------

async function handleGetPendingActions(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<Response> {
  const { data, error } = await supabase
    .from('ads_pending_actions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    return jsonResponse({ error: `Failed to fetch pending actions: ${error.message}` }, 500)
  }

  return jsonResponse({ pending_actions: data || [] })
}

async function handleApproveAction(
  supabase: ReturnType<typeof getServiceClient>,
  actionId: string,
  accessToken: string,
): Promise<Response> {
  // 1. Fetch the pending action
  const { data: action, error: fetchError } = await supabase
    .from('ads_pending_actions')
    .select('*')
    .eq('id', actionId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !action) {
    return jsonResponse({ error: 'Pending action not found or already resolved' }, 404)
  }

  // 2. Execute the action on Meta
  try {
    if (action.action_type === 'pause') {
      await rateLimit()
      await metaPost(action.campaign_id, { status: 'PAUSED' }, accessToken)

      await supabase
        .from('ads_campaigns')
        .update({ status: 'PAUSED' })
        .eq('campaign_id', action.campaign_id)

    } else if (action.action_type === 'boost') {
      const proposed = action.proposed_changes as Record<string, unknown>
      const newBudget = proposed.new_budget as number

      if (newBudget && newBudget > 0) {
        await rateLimit()
        await metaPost(
          action.campaign_id,
          { daily_budget: String(Math.round(newBudget * 100)) },
          accessToken,
        )

        await supabase
          .from('ads_campaigns')
          .update({ daily_budget: newBudget })
          .eq('campaign_id', action.campaign_id)
      }

    } else if (action.action_type === 'adjust_budget') {
      const proposed = action.proposed_changes as Record<string, unknown>
      const newBudget = proposed.new_budget as number

      if (newBudget && newBudget > 0) {
        await rateLimit()
        await metaPost(
          action.campaign_id,
          { daily_budget: String(Math.round(newBudget * 100)) },
          accessToken,
        )

        await supabase
          .from('ads_campaigns')
          .update({ daily_budget: newBudget })
          .eq('campaign_id', action.campaign_id)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return jsonResponse({ error: `Failed to execute action on Meta: ${msg}` }, 500)
  }

  // 3. Mark as approved
  await supabase
    .from('ads_pending_actions')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', actionId)

  // 4. Log the approval
  await logAction(supabase, `approve_${action.action_type}`, action.campaign_id, 'success', {
    pending_action_id: actionId,
    ai_reasoning: action.ai_reasoning,
    proposed_changes: action.proposed_changes,
  }, 'human_approval')

  return jsonResponse({
    success: true,
    action_id: actionId,
    action_type: action.action_type,
    campaign_id: action.campaign_id,
    campaign_name: action.campaign_name,
    status: 'approved',
  })
}

async function handleRejectAction(
  supabase: ReturnType<typeof getServiceClient>,
  actionId: string,
): Promise<Response> {
  // 1. Fetch the pending action
  const { data: action, error: fetchError } = await supabase
    .from('ads_pending_actions')
    .select('*')
    .eq('id', actionId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !action) {
    return jsonResponse({ error: 'Pending action not found or already resolved' }, 404)
  }

  // 2. Mark as rejected
  await supabase
    .from('ads_pending_actions')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', actionId)

  // 3. Log the rejection
  await logAction(supabase, `reject_${action.action_type}`, action.campaign_id, 'success', {
    pending_action_id: actionId,
    ai_reasoning: action.ai_reasoning,
  }, 'human_approval')

  return jsonResponse({
    success: true,
    action_id: actionId,
    action_type: action.action_type,
    campaign_id: action.campaign_id,
    campaign_name: action.campaign_name,
    status: 'rejected',
  })
}

// ---------------------------------------------------------------------------
// Main serve handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').filter(Boolean)

    // Find the function name in the path to support both local and hosted routing
    // Local: /ads-actions/pause/12345
    // Hosted: /functions/v1/ads-actions/pause/12345
    const idx = path.indexOf('ads-actions')
    const action = path[idx + 1] || ''
    const param = path[idx + 2] || ''

    const supabase = getServiceClient()

    // Parse body for POST requests (safe for GET)
    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        // Body may be empty for some routes
      }
    }

    const source = (body?.source as string) || 'manual'

    // -----------------------------------------------------------------------
    // POST /pause/{campaign_id}
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'pause') {
      if (!param) {
        return jsonResponse({ error: 'campaign_id is required' }, 400)
      }
      try {
        const { accessToken } = getMetaCredentials()
        return await handlePause(supabase, param, accessToken, source)
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
      if (!param) {
        return jsonResponse({ error: 'campaign_id is required' }, 400)
      }
      try {
        const { accessToken } = getMetaCredentials()
        return await handleResume(supabase, param, accessToken, source)
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
      if (!param) {
        return jsonResponse({ error: 'campaign_id is required' }, 400)
      }
      try {
        const { accessToken } = getMetaCredentials()
        return await handleBudget(supabase, param, accessToken, body, source)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await logAction(supabase, 'update_budget', param, 'error', { error: msg }, source)
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /create-campaign
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'create-campaign') {
      try {
        const { accessToken, accountRef } = getMetaCredentials()
        return await handleCreateCampaign(supabase, accountRef, accessToken, body, source)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await logAction(supabase, 'create_campaign', null, 'error', { error: msg }, source)
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // GET /config
    // -----------------------------------------------------------------------
    if (req.method === 'GET' && action === 'config') {
      try {
        return await handleGetConfig(supabase)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /config
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'config') {
      try {
        return await handleUpdateConfig(supabase, body)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /fetch-ig-posts
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'fetch-ig-posts') {
      try {
        return await handleFetchIgPosts(supabase)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /search-interests
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'search-interests') {
      try {
        const { accessToken } = getMetaCredentials()
        return await handleSearchInterests(accessToken, body)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /ai-strategy
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'ai-strategy') {
      try {
        return await handleAiStrategy(supabase, body)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /create-from-post
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'create-from-post') {
      try {
        const { accessToken, accountRef } = getMetaCredentials()
        return await handleCreateFromPost(supabase, accountRef, accessToken, body, source)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await logAction(supabase, 'create_from_post', null, 'error', { error: msg }, source)
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // GET /pending-actions
    // -----------------------------------------------------------------------
    if (req.method === 'GET' && action === 'pending-actions') {
      try {
        return await handleGetPendingActions(supabase)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /approve-action/{id}
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'approve-action') {
      if (!param) {
        return jsonResponse({ error: 'action id is required' }, 400)
      }
      try {
        const { accessToken } = getMetaCredentials()
        return await handleApproveAction(supabase, param, accessToken)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // POST /reject-action/{id}
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && action === 'reject-action') {
      if (!param) {
        return jsonResponse({ error: 'action id is required' }, 400)
      }
      try {
        return await handleRejectAction(supabase, param)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse({ error: msg }, 500)
      }
    }

    // -----------------------------------------------------------------------
    // Fallback: unknown route
    // -----------------------------------------------------------------------
    return jsonResponse({
      error: 'Unknown route',
      available_routes: [
        'POST /pause/{campaign_id}',
        'POST /resume/{campaign_id}',
        'POST /budget/{campaign_id}',
        'POST /create-campaign',
        'POST /create-from-post',
        'POST /fetch-ig-posts',
        'POST /search-interests',
        'POST /ai-strategy',
        'GET  /config',
        'POST /config',
        'GET  /pending-actions',
        'POST /approve-action/{id}',
        'POST /reject-action/{id}',
      ],
    }, 404)

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('ads-actions error:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
