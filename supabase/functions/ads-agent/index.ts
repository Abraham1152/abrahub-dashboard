import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500)
  }

  try {
    const { question, history } = await req.json()
    if (!question) {
      return jsonResponse({ error: 'question is required' }, 400)
    }

    const supabase = getServiceClient()

    // Calculate date boundaries
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since30d = thirtyDaysAgo.toISOString().split('T')[0]

    // Fetch all ads and business data in parallel
    const [
      campaignsRes,
      adsRes,
      churnRes,
      revenueRes,
      configRes,
      actionsRes,
    ] = await Promise.all([
      supabase.from('ads_campaigns').select('*').order('spend', { ascending: false }),
      supabase.from('ads_daily').select('*').gte('date', since30d).order('date', { ascending: true }),
      supabase.from('churn_metrics').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('revenue_transactions').select('date, source, amount, type, status').gte('date', since30d).order('date', { ascending: false }).limit(100),
      supabase.from('ads_optimization_config').select('*').single(),
      supabase.from('ads_agent_actions').select('*').order('created_at', { ascending: false }).limit(20),
    ])

    const campaigns = campaignsRes.data || []
    const ads = adsRes.data || []
    const churn = churnRes.data?.[0] || null
    const transactions = revenueRes.data || []
    const config = configRes.data || null
    const actions = actionsRes.data || []

    // Build business context
    const businessData = buildAdsContext({
      campaigns,
      ads,
      churn,
      transactions,
      config,
      actions,
    })

    const targetCpa = config?.target_cpa ?? '??'
    const minRoas = config?.min_roas ?? '??'

    const systemInstruction = `Voce e o Estrategista de Trafego Pago da ABRAhub Studio, especialista em Meta Ads para campanhas de conversao (vendas).

Voce tem acesso a TODOS os dados de campanhas, metricas financeiras e configuracoes de otimizacao.

SEU PAPEL:
- Analisar performance de cada campanha individualmente
- Recomendar quais campanhas manter, pausar ou escalar
- Sugerir orcamentos ideais baseado em ROAS e CPA
- Identificar oportunidades de melhoria (publico, creative, copy)
- Calcular e explicar CAC, ROAS, CPA, LTV/CAC
- Propor estrategias de escala e novas campanhas

REGRAS:
- Responda SEMPRE em portugues brasileiro
- Seja direto e objetivo
- Use numeros concretos das campanhas nos insights
- Compare performance entre campanhas
- Recomende acoes especificas (pausar X, aumentar budget de Y para Z)
- Considere o target CPA de R$ ${targetCpa} e ROAS minimo de ${minRoas}x
- Use formatacao simples (sem markdown complexo)
- De respostas completas e detalhadas

DADOS DAS CAMPANHAS E NEGOCIO:
${businessData}`

    // Build conversation contents
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

    // Add history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })
      }
    }

    // Add current question
    contents.push({
      role: 'user',
      parts: [{ text: question }],
    })

    // Call Gemini
    const res = await fetch(
      `${GEMINI_API}/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        }),
      }
    )

    const data = await res.json()

    if (data.error) {
      console.error('Gemini error:', JSON.stringify(data.error))
      return jsonResponse({ error: 'AI service error' }, 500)
    }

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Nao consegui gerar uma resposta.'

    return jsonResponse({ answer })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('ads-agent error:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})

// ── Build Ads Context ──────────────────────────────────────────────────────────

function buildAdsContext(data: {
  campaigns: Array<Record<string, unknown>>
  ads: Array<Record<string, unknown>>
  churn: Record<string, unknown> | null
  transactions: Array<Record<string, unknown>>
  config: Record<string, unknown> | null
  actions: Array<Record<string, unknown>>
}): string {
  const parts: string[] = []

  // ── Campaigns ──────────────────────────────────────────────────────────────
  if (data.campaigns.length > 0) {
    parts.push(`CAMPANHAS (${data.campaigns.length} total):\n`)
    data.campaigns.forEach((c, i) => {
      const status = String(c.status || 'UNKNOWN').toUpperCase()
      const name = c.name || c.campaign_name || 'Sem nome'
      const spend = Number(c.spend) || 0
      const cpc = Number(c.cpc) || 0
      const ctr = Number(c.ctr) || 0
      const cpa = Number(c.cpa) || 0
      const impressions = Number(c.impressions) || 0
      const clicks = Number(c.clicks) || 0
      const conversions = Number(c.conversions) || 0
      const budget = Number(c.daily_budget) || 0

      parts.push(`${i + 1}. [${status}] "${name}"
   - Gasto: R$ ${spend.toFixed(2)} | CPC: R$ ${cpc.toFixed(2)} | CTR: ${ctr.toFixed(2)}% | CPA: R$ ${cpa.toFixed(2)}
   - Impressoes: ${impressions.toLocaleString('pt-BR')} | Cliques: ${clicks.toLocaleString('pt-BR')} | Conversoes: ${conversions}
   - Orcamento: R$ ${budget.toFixed(2)}/dia`)
    })
  } else {
    parts.push('CAMPANHAS: Nenhuma campanha encontrada.')
  }

  // ── Ads Daily Trend (aggregated) ───────────────────────────────────────────
  if (data.ads.length > 0) {
    const totalSpend = data.ads.reduce((s, r) => s + (Number(r.total_spend) || 0), 0)
    const totalClicks = data.ads.reduce((s, r) => s + (Number(r.total_clicks) || 0), 0)
    const totalImpressions = data.ads.reduce((s, r) => s + (Number(r.total_impressions) || 0), 0)
    const totalConversions = data.ads.reduce((s, r) => s + (Number(r.total_conversions) || 0), 0)
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0

    parts.push(`\nMETRICAS AGREGADAS (30 dias):
- Gasto Total: R$ ${totalSpend.toFixed(2)}
- Impressoes: ${totalImpressions.toLocaleString('pt-BR')}
- Cliques: ${totalClicks.toLocaleString('pt-BR')}
- Conversoes: ${totalConversions}
- CPC Medio: R$ ${avgCpc.toFixed(2)}
- CTR Medio: ${avgCtr.toFixed(2)}%
- CPA Medio: R$ ${avgCpa.toFixed(2)}`)
  }

  // ── Financial Context ──────────────────────────────────────────────────────
  if (data.transactions.length > 0 || data.campaigns.length > 0) {
    const totalRevenue = data.transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0)
    const newCustomers = data.churn ? Number(data.churn.new_customers) || 0 : 0
    const totalAdSpend = data.campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
    const cac = newCustomers > 0 ? totalAdSpend / newCustomers : 0
    const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0

    parts.push(`\nFINANCEIRO (30 dias):
- Receita Total: R$ ${totalRevenue.toFixed(2)}
- Novos Clientes: ${newCustomers}
- CAC: R$ ${cac.toFixed(2)} (Gasto em Ads / Novos Clientes)
- ROAS: ${roas.toFixed(2)}x (Receita / Gasto em Ads)`)
  }

  // ── Churn ──────────────────────────────────────────────────────────────────
  if (data.churn) {
    parts.push(`\nCHURN:
- Taxa de Churn: ${data.churn.churn_percentage}%
- Total Clientes: ${data.churn.total_customers}
- Novos: ${data.churn.new_customers}
- Cancelados: ${data.churn.churned_customers}
- LTV Estimado: R$ ${data.churn.ltv_estimated}`)
  }

  // ── Optimization Config ────────────────────────────────────────────────────
  if (data.config) {
    const autoPause = data.config.auto_pause_enabled ? 'ativo' : 'inativo'
    const autoBoost = data.config.auto_boost_enabled ? 'ativo' : 'inativo'

    parts.push(`\nCONFIGURACAO DO OTIMIZADOR:
- Target CPA: R$ ${data.config.target_cpa ?? '??'}
- ROAS Minimo: ${data.config.min_roas ?? '??'}x
- Auto-pause: ${autoPause}
- Auto-boost: ${autoBoost}`)
  }

  // ── Recent Actions ─────────────────────────────────────────────────────────
  if (data.actions.length > 0) {
    parts.push(`\nACOES RECENTES (ultimas ${data.actions.length}):`)
    for (const a of data.actions) {
      const ts = a.created_at
        ? new Date(String(a.created_at)).toISOString().replace('T', ' ').slice(0, 16)
        : '??'
      const actionType = a.action_type || a.type || 'unknown'
      const campaign = a.campaign_name || a.campaign || '??'
      const reason = a.reason || a.details || ''
      parts.push(`- [${ts}] ${actionType}: "${campaign}" - ${reason}`)
    }
  }

  return parts.join('\n')
}
