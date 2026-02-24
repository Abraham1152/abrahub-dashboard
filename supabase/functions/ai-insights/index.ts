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
    const { question, history, dateRange: rawDateRange } = await req.json()
    if (!question) {
      return jsonResponse({ error: 'question is required' }, 400)
    }

    const supabase = getServiceClient()

    // Calculate date range based on frontend filter
    const dateRange = rawDateRange || '30d'
    const now = new Date()
    let daysBack = 30
    let periodLabel = 'últimos 30 dias'
    if (dateRange === '7d') { daysBack = 7; periodLabel = 'últimos 7 dias' }
    else if (dateRange === '30d') { daysBack = 30; periodLabel = 'últimos 30 dias' }
    else if (dateRange === '90d') { daysBack = 90; periodLabel = 'últimos 90 dias' }
    else if (dateRange === '365d') { daysBack = 365; periodLabel = 'últimos 365 dias' }
    else if (dateRange === 'ytd') {
      const jan1 = new Date(now.getFullYear(), 0, 1)
      daysBack = Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24))
      periodLabel = `desde 01/01/${now.getFullYear()} (YTD)`
    }

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - daysBack)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    const currentMonth = now.toISOString().slice(0, 7) // "2026-02"
    const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`

    // Calculate all months in range for expenses
    const monthsInRange: string[] = []
    const tempDate = new Date(sinceDate)
    while (tempDate <= now) {
      monthsInRange.push(tempDate.toISOString().slice(0, 7))
      tempDate.setMonth(tempDate.getMonth() + 1)
    }
    const uniqueMonths = [...new Set(monthsInRange)]

    const [
      financialRes,
      churnRes,
      youtubeRes,
      instagramDailyRes,
      instagramPostsRes,
      adsRes,
      adsCampaignsRes,
      expensesRes,
      okrsRes,
      transactionsRes,
      knowledgeRes,
    ] = await Promise.all([
      supabase.from('financial_daily').select('*').gte('date', sinceDateStr).order('date', { ascending: true }),
      supabase.from('churn_metrics').select('*').gte('date', sinceDateStr).order('date', { ascending: false }).limit(1),
      supabase.from('youtube_daily').select('*').gte('date', sinceDateStr).order('date', { ascending: true }),
      supabase.from('instagram_daily').select('*').gte('date', sinceDateStr).order('date', { ascending: true }),
      supabase.from('instagram_posts').select('media_type, caption, like_count, comments_count, reach, impressions, saves, shares, timestamp').order('like_count', { ascending: false }).limit(10),
      supabase.from('ads_daily').select('*').gte('date', sinceDateStr).order('date', { ascending: true }),
      supabase.from('ads_campaigns').select('name, status, objective, spend, impressions, clicks, cpc, cpm, ctr, conversions, cost_per_result').order('spend', { ascending: false }).limit(10),
      supabase.from('monthly_expenses').select('*').in('month', uniqueMonths),
      supabase.from('okrs').select('*'),
      supabase.from('revenue_transactions').select('date, source, amount, type, status').gte('date', sinceDateStr).order('date', { ascending: false }).limit(1000),
      supabase.from('ai_knowledge_base').select('name, content').order('created_at', { ascending: true }),
    ])

    // Build business context
    const businessData = buildBusinessContext({
      financial: financialRes.data || [],
      churn: churnRes.data?.[0] || null,
      youtube: youtubeRes.data || [],
      instagramDaily: instagramDailyRes.data || [],
      instagramPosts: (instagramPostsRes.data || []) as Array<Record<string, unknown>>,
      ads: adsRes.data || [],
      adsCampaigns: (adsCampaignsRes.data || []) as Array<Record<string, unknown>>,
      expenses: expensesRes.data || [],
      okrs: okrsRes.data || [],
      transactions: transactionsRes.data || [],
      periodLabel,
      daysBack,
    })

    // Build knowledge base context
    const knowledgeDocs = knowledgeRes.data || []
    let knowledgeContext = ''
    if (knowledgeDocs.length > 0) {
      knowledgeContext = `\n\nBASE DE CONHECIMENTO (documentos de referencia para suas analises e recomendacoes):\n`
      for (const doc of knowledgeDocs) {
        knowledgeContext += `\n--- ${doc.name} ---\n${doc.content}\n`
      }
    }

    const systemInstruction = `Voce e o Consultor Estrategico da ABRAhub Studio. Voce tem acesso a todos os dados do negocio e deve fornecer insights acionaveis e recomendacoes estrategicas.
${knowledgeDocs.length > 0 ? `
INSTRUCAO CRITICA SOBRE BASE DE CONHECIMENTO:
Voce tem ${knowledgeDocs.length} documento(s) na base de conhecimento (${knowledgeDocs.map(d => d.name).join(', ')}).
Esses documentos contem frameworks, estrategias e metodologias que o dono do negocio escolheu como referencia.
Voce DEVE:
1. SEMPRE aplicar os conceitos e frameworks desses documentos nas suas analises
2. CITAR explicitamente de qual documento e conceito voce esta tirando a recomendacao (ex: "Segundo o documento X, a estrategia Y sugere...")
3. Conectar os DADOS REAIS do negocio com as ESTRATEGIAS dos documentos
4. NAO dar conselhos genericos - tudo deve ser embasado nos documentos OU nos dados reais
5. Quando um documento fala sobre um tema relevante a pergunta, SEMPRE referenciar` : ''}

REGRAS:
- Responda SEMPRE em portugues brasileiro
- Seja direto e objetivo
- Foque em insights acionaveis, nao apenas descricao de dados
- Use numeros e porcentagens para embasar suas analises
- Quando identificar problemas, sugira acoes concretas baseadas nos documentos da base de conhecimento
- Quando identificar oportunidades, explique como aproveita-las usando frameworks dos documentos
- Use **negrito** para destacar numeros importantes e titulos de secao
- Use listas numeradas (1. 2. 3.) e com marcadores (- item) para organizar informacoes
- Para panoramas gerais, seja RESUMIDO e direto ao ponto - maximo 5-8 bullet points com os numeros-chave. NAO escreva paragrafos longos
- Para perguntas especificas, de respostas detalhadas mas ainda objetivas
- IMPORTANTE: Todos os dados abaixo sao do PERIODO SELECIONADO pelo usuario (${periodLabel}). Baseie TODAS as suas analises nesses dados. NAO invente numeros.
- NUNCA de conselhos genericos tipo "melhore o marketing" ou "reduza custos" sem especificar COMO baseado nos documentos
- REGRA FINANCEIRA CRITICA: Trabalhe SOMENTE com RECEITA LIQUIDA (receita total menos reembolsos). NUNCA mencione receita bruta. Quando falar de receita, margem, lucro, media diaria, etc, SEMPRE use a receita liquida como base. A receita liquida ja esta calculada nos dados abaixo.

DADOS DO NEGOCIO (${periodLabel}):
${businessData}${knowledgeContext}`

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
    console.error('ai-insights error:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})

function buildBusinessContext(data: {
  financial: Array<Record<string, unknown>>
  churn: Record<string, unknown> | null
  youtube: Array<Record<string, unknown>>
  instagramDaily: Array<Record<string, unknown>>
  instagramPosts: Array<Record<string, unknown>>
  ads: Array<Record<string, unknown>>
  adsCampaigns: Array<Record<string, unknown>>
  expenses: Array<Record<string, unknown>>
  okrs: Array<Record<string, unknown>>
  transactions: Array<Record<string, unknown>>
  periodLabel: string
  daysBack: number
}): string {
  const parts: string[] = []

  // ===== FINANCEIRO =====
  const paidTx = data.transactions.filter(t => t.status === 'paid' || t.status === 'approved')
  const refundTx = data.transactions.filter(t => t.status === 'refunded' || t.status === 'chargedback')

  const totalStripe = paidTx.filter(t => t.source === 'stripe').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
  const totalKiwify = paidTx.filter(t => t.source === 'kiwify').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
  const totalAdsense = data.financial.reduce((s, r) => s + (Number(r.revenue_adsense) || 0), 0)
  const totalRevenue = totalStripe + totalKiwify + totalAdsense
  const totalRefunds = refundTx.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
  const netRevenue = totalRevenue - totalRefunds
  const refundPct = totalRevenue > 0 ? ((totalRefunds / totalRevenue) * 100).toFixed(1) : '0.0'

  if (data.transactions.length > 0 || data.financial.length > 0) {
    parts.push(`FINANCEIRO (${data.periodLabel}):
- Dias no periodo: ${data.daysBack}
- Total transacoes: ${data.transactions.length} (${paidTx.length} pagas, ${refundTx.length} reembolsadas)
- Receita Liquida: R$ ${netRevenue.toFixed(2)} (Stripe: R$ ${totalStripe.toFixed(2)}, Kiwify: R$ ${totalKiwify.toFixed(2)}, AdSense: R$ ${totalAdsense.toFixed(2)}, Reembolsos: -R$ ${totalRefunds.toFixed(2)})
- Media Diaria: R$ ${(netRevenue / (data.daysBack || 1)).toFixed(2)}`)

    // Breakdown by type
    const recurring = paidTx.filter(t => t.type === 'recurring')
    const annual = paidTx.filter(t => t.type === 'annual')
    const oneTime = paidTx.filter(t => t.type === 'one_time')
    const recurringAmt = recurring.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
    const annualAmt = annual.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
    const oneTimeAmt = oneTime.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
    parts.push(`- Receita Recorrente: R$ ${recurringAmt.toFixed(2)} (${recurring.length} transacoes)`)
    parts.push(`- Receita Anual: R$ ${annualAmt.toFixed(2)} (${annual.length} transacoes)`)
    parts.push(`- Receita Avulsa: R$ ${oneTimeAmt.toFixed(2)} (${oneTime.length} transacoes)`)
  } else {
    parts.push(`FINANCEIRO (${data.periodLabel}):\n- Nenhum dado financeiro encontrado neste periodo.`)
  }

  // ===== CUSTOS FIXOS DETALHADOS =====
  if (data.expenses.length > 0) {
    const rawExpenses = data.expenses.reduce((s, r) => s + (Number(r.price_brl) || 0), 0)
    const totalDaysInMonths = [...new Set(data.expenses.map(e => e.month as string))].reduce((sum, m) => {
      const [y, mo] = m.split('-').map(Number)
      return sum + new Date(y, mo, 0).getDate()
    }, 0)
    const proratedExpenses = totalDaysInMonths > 0 ? rawExpenses * (data.daysBack / totalDaysInMonths) : rawExpenses
    const profit = netRevenue - proratedExpenses
    const marginPct = netRevenue > 0 ? ((profit / netRevenue) * 100).toFixed(1) : '0.0'

    // Group expenses by category
    const byCategory: Record<string, number> = {}
    for (const e of data.expenses) {
      const cat = String(e.category || 'other')
      byCategory[cat] = (byCategory[cat] || 0) + (Number(e.price_brl) || 0)
    }

    parts.push(`\nCUSTOS FIXOS E LUCRO:
- Total custos mensais: R$ ${rawExpenses.toFixed(2)}
- Proporcional ao periodo (${data.daysBack} dias): R$ ${proratedExpenses.toFixed(2)}
- Lucro no periodo: R$ ${profit.toFixed(2)}
- Margem de lucro: ${marginPct}%
- Custos por categoria:`)
    for (const [cat, val] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      parts.push(`  - ${cat}: R$ ${val.toFixed(2)}`)
    }
    parts.push(`- Detalhamento completo:`)
    for (const e of data.expenses.sort((a, b) => (Number(b.price_brl) || 0) - (Number(a.price_brl) || 0))) {
      const usd = e.price_usd ? ` (US$ ${Number(e.price_usd).toFixed(2)})` : ''
      parts.push(`  - ${e.name} [${e.category}]: R$ ${Number(e.price_brl).toFixed(2)}${usd}${e.is_recurring ? ' (recorrente)' : ''}`)
    }
  }

  // ===== CHURN =====
  if (data.churn) {
    parts.push(`\nCHURN:
- Taxa de Churn: ${data.churn.churn_percentage}%
- Total Clientes Ativos: ${data.churn.total_customers}
- Novos Clientes (30d): ${data.churn.new_customers}
- Cancelados (30d): ${data.churn.churned_customers}
- LTV Estimado: R$ ${data.churn.ltv_estimated}`)
  }

  // ===== YOUTUBE (por canal) =====
  if (data.youtube.length > 0) {
    const channelNames: Record<string, string> = {
      'UCJDekPfdOi9gDg-1dw_GDng': '@abrahubstudio',
      'UC0qgDFuPmvDRNz_tXO90fBg': '@Abraham_tv',
      'UCNHMvXsxOBlUUd3k-Zvtr1Q': '@rodrigoabraham',
    }
    const latestDate = data.youtube[data.youtube.length - 1].date as string
    const latestRows = data.youtube.filter(r => r.date === latestDate)
    const totalSubs = latestRows.reduce((s, r) => s + (Number(r.subscribers) || 0), 0)
    const totalViews = data.youtube.reduce((s, r) => s + (Number(r.views_gained) || 0), 0)
    parts.push(`\nYOUTUBE (${data.periodLabel}):
- Total Inscritos (soma 3 canais): ${totalSubs.toLocaleString('pt-BR')}
- Views totais no periodo: ${totalViews.toLocaleString('pt-BR')}`)

    // Per-channel breakdown
    const channelIds = [...new Set(data.youtube.map(r => r.channel_id as string))]
    for (const chId of channelIds) {
      const chData = data.youtube.filter(r => r.channel_id === chId)
      const chLatest = chData[chData.length - 1]
      const chViews = chData.reduce((s, r) => s + (Number(r.views_gained) || 0), 0)
      const chName = channelNames[chId] || chId
      parts.push(`- ${chName}: ${Number(chLatest?.subscribers || 0).toLocaleString('pt-BR')} inscritos, ${chViews.toLocaleString('pt-BR')} views`)
    }
  }

  // ===== INSTAGRAM =====
  if (data.instagramDaily.length > 0) {
    const igLatest = data.instagramDaily[data.instagramDaily.length - 1]
    const igFirst = data.instagramDaily[0]
    const followerGrowth = Number(igLatest.followers || 0) - Number(igFirst.followers || 0)
    const totalReach = data.instagramDaily.reduce((s, r) => s + (Number(r.reach) || 0), 0)
    const totalImpressions = data.instagramDaily.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
    const totalProfileViews = data.instagramDaily.reduce((s, r) => s + (Number(r.profile_views) || 0), 0)
    const avgReachDay = Math.round(totalReach / (data.instagramDaily.length || 1))

    parts.push(`\nINSTAGRAM (${data.periodLabel}):
- Seguidores atuais: ${Number(igLatest.followers || 0).toLocaleString('pt-BR')}
- Crescimento de seguidores no periodo: ${followerGrowth >= 0 ? '+' : ''}${followerGrowth}
- Seguindo: ${igLatest.follows}
- Total de posts: ${igLatest.media_count}
- Alcance total no periodo: ${totalReach.toLocaleString('pt-BR')}
- Alcance medio diario: ${avgReachDay.toLocaleString('pt-BR')}
- Impressoes totais: ${totalImpressions.toLocaleString('pt-BR')}
- Views do perfil: ${totalProfileViews.toLocaleString('pt-BR')}`)
  }

  // Top Instagram posts
  if (data.instagramPosts.length > 0) {
    const avgLikes = Math.round(data.instagramPosts.reduce((s, p) => s + (Number(p.like_count) || 0), 0) / data.instagramPosts.length)
    const avgComments = Math.round(data.instagramPosts.reduce((s, p) => s + (Number(p.comments_count) || 0), 0) / data.instagramPosts.length)
    const avgSaves = Math.round(data.instagramPosts.reduce((s, p) => s + (Number(p.saves) || 0), 0) / data.instagramPosts.length)
    const avgShares = Math.round(data.instagramPosts.reduce((s, p) => s + (Number(p.shares) || 0), 0) / data.instagramPosts.length)
    const followers = data.instagramDaily.length > 0 ? Number(data.instagramDaily[data.instagramDaily.length - 1].followers || 0) : 0
    const engRate = followers > 0 ? (((avgLikes + avgComments) / followers) * 100).toFixed(2) : '0.00'

    parts.push(`\nINSTAGRAM - ENGAJAMENTO (top 10 posts):
- Media de Likes: ${avgLikes}
- Media de Comentarios: ${avgComments}
- Media de Salvos: ${avgSaves}
- Media de Compartilhamentos: ${avgShares}
- Taxa de Engajamento: ${engRate}%`)
    parts.push(`- Top posts:`)
    for (const p of data.instagramPosts.slice(0, 5)) {
      const caption = String(p.caption || '').slice(0, 60)
      parts.push(`  - [${p.media_type}] "${caption}..." - ${p.like_count} likes, ${p.comments_count} comments, ${p.saves || 0} saves`)
    }
  }

  // ===== ADS META =====
  if (data.ads.length > 0) {
    const totalSpend = data.ads.reduce((s, r) => s + (Number(r.total_spend) || 0), 0)
    const totalClicks = data.ads.reduce((s, r) => s + (Number(r.total_clicks) || 0), 0)
    const totalImpressions = data.ads.reduce((s, r) => s + (Number(r.total_impressions) || 0), 0)
    const totalConversions = data.ads.reduce((s, r) => s + (Number(r.total_conversions) || 0), 0)
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0
    parts.push(`\nADS META (${data.periodLabel}):
- Gasto Total: R$ ${totalSpend.toFixed(2)}
- Impressoes: ${totalImpressions.toLocaleString('pt-BR')}
- Cliques: ${totalClicks.toLocaleString('pt-BR')}
- CTR medio: ${avgCTR.toFixed(2)}%
- CPC medio: R$ ${avgCPC.toFixed(2)}
- Conversoes: ${totalConversions}
- Custo por conversao: R$ ${costPerConversion.toFixed(2)}
- ROAS: ${totalRevenue > 0 && totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) + 'x' : 'N/A'}`)
  }

  // Top campaigns
  if (data.adsCampaigns.length > 0) {
    parts.push(`- Top campanhas:`)
    for (const c of data.adsCampaigns.slice(0, 5)) {
      parts.push(`  - "${c.name}" [${c.status}]: R$ ${Number(c.spend || 0).toFixed(2)} gasto, ${c.clicks} cliques, ${c.conversions} conversoes, CPC R$ ${Number(c.cpc || 0).toFixed(2)}`)
    }
  }

  // ===== OKRs =====
  if (data.okrs.length > 0) {
    parts.push(`\nOKRs:`)
    for (const okr of data.okrs) {
      const progress = Number(okr.target_value) > 0
        ? ((Number(okr.current_value) / Number(okr.target_value)) * 100).toFixed(0)
        : '0'
      parts.push(`- [${okr.category}] ${okr.title}: ${okr.current_value}/${okr.target_value} (${progress}%)`)
    }
  }

  return parts.join('\n')
}
