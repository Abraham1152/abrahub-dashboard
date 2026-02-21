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

    // Fetch all business data in parallel
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since30d = thirtyDaysAgo.toISOString().split('T')[0]

    const currentMonth = new Date().toISOString().slice(0, 7) // "2026-02"
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`

    const [
      financialRes,
      churnRes,
      youtubeRes,
      instagramRes,
      adsRes,
      expensesRes,
      okrsRes,
      transactionsRes,
      systemeRes,
    ] = await Promise.all([
      supabase.from('financial_daily').select('*').gte('date', since30d).order('date', { ascending: true }),
      supabase.from('churn_metrics').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('youtube_daily').select('*').gte('date', since30d).order('date', { ascending: true }),
      supabase.from('instagram_daily').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('ads_daily').select('*').gte('date', since30d).order('date', { ascending: true }),
      supabase.from('monthly_expenses').select('*').eq('month', currentMonth),
      supabase.from('okrs').select('*'),
      supabase.from('revenue_transactions').select('date, source, amount, type, status').gte('date', since30d).order('date', { ascending: false }).limit(100),
      supabase.from('systeme_contacts_daily').select('*').order('date', { ascending: false }).limit(1),
    ])

    // Build business context
    const businessData = buildBusinessContext({
      financial: financialRes.data || [],
      churn: churnRes.data?.[0] || null,
      youtube: youtubeRes.data || [],
      instagram: instagramRes.data?.[0] || null,
      ads: adsRes.data || [],
      expenses: expensesRes.data || [],
      okrs: okrsRes.data || [],
      transactions: transactionsRes.data || [],
      systeme: systemeRes.data?.[0] || null,
    })

    const systemInstruction = `Voce e o Consultor Estrategico da ABRAhub Studio. Voce tem acesso a todos os dados do negocio e deve fornecer insights acionaveis e recomendacoes estrategicas.

REGRAS:
- Responda SEMPRE em portugues brasileiro
- Seja direto e objetivo
- Foque em insights acionaveis, nao apenas descricao de dados
- Use numeros e porcentagens para embasar suas analises
- Quando identificar problemas, sugira acoes concretas
- Quando identificar oportunidades, explique como aproveita-las
- Use formatacao simples (sem markdown complexo, apenas texto e quebras de linha)
- Mantenha respostas concisas (maximo 800 caracteres)

DADOS DO NEGOCIO (ultimos 30 dias):
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
      `${GEMINI_API}/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 500,
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
  instagram: Record<string, unknown> | null
  ads: Array<Record<string, unknown>>
  expenses: Array<Record<string, unknown>>
  okrs: Array<Record<string, unknown>>
  transactions: Array<Record<string, unknown>>
  systeme: Record<string, unknown> | null
}): string {
  const parts: string[] = []

  // Financial summary
  if (data.financial.length > 0) {
    const totalStripe = data.financial.reduce((s, r) => s + (Number(r.revenue_stripe) || 0), 0)
    const totalKiwify = data.financial.reduce((s, r) => s + (Number(r.revenue_kiwify) || 0), 0)
    const totalRefunds = data.financial.reduce((s, r) => s + (Number(r.refunds) || 0), 0)
    const totalFees = data.financial.reduce((s, r) => s + (Number(r.fees) || 0), 0)
    const netRevenue = totalStripe + totalKiwify - totalRefunds - totalFees
    parts.push(`FINANCEIRO (30 dias):
- Receita Stripe: R$ ${totalStripe.toFixed(2)}
- Receita Kiwify: R$ ${totalKiwify.toFixed(2)}
- Receita Total: R$ ${(totalStripe + totalKiwify).toFixed(2)}
- Reembolsos: R$ ${totalRefunds.toFixed(2)} (${((totalRefunds / (totalStripe + totalKiwify || 1)) * 100).toFixed(1)}%)
- Taxas: R$ ${totalFees.toFixed(2)}
- Receita Liquida: R$ ${netRevenue.toFixed(2)}
- Media Diaria: R$ ${(netRevenue / (data.financial.length || 1)).toFixed(2)}`)
  }

  // Churn
  if (data.churn) {
    parts.push(`\nCHURN:
- Taxa de Churn: ${data.churn.churn_percentage}%
- Total Clientes: ${data.churn.total_customers}
- Novos: ${data.churn.new_customers}
- Cancelados: ${data.churn.churned_customers}
- LTV Estimado: R$ ${data.churn.ltv_estimated}`)
  }

  // YouTube
  if (data.youtube.length > 0) {
    const latestDate = data.youtube[data.youtube.length - 1].date as string
    const latestRows = data.youtube.filter(r => r.date === latestDate)
    const totalSubs = latestRows.reduce((s, r) => s + (Number(r.subscribers) || 0), 0)
    const totalViews = data.youtube.reduce((s, r) => s + (Number(r.views_gained) || 0), 0)
    parts.push(`\nYOUTUBE:
- Total Inscritos: ${totalSubs.toLocaleString('pt-BR')}
- Views (30 dias): ${totalViews.toLocaleString('pt-BR')}
- Canais: 3 (Abraham TV, Rodrigo Abraham, ABRAhub Studio)`)
  }

  // Instagram
  if (data.instagram) {
    parts.push(`\nINSTAGRAM:
- Seguidores: ${data.instagram.followers}
- Alcance: ${data.instagram.reach}
- Impressoes: ${data.instagram.impressions}
- Views do Perfil: ${data.instagram.profile_views}`)
  }

  // Ads
  if (data.ads.length > 0) {
    const totalSpend = data.ads.reduce((s, r) => s + (Number(r.total_spend) || 0), 0)
    const totalClicks = data.ads.reduce((s, r) => s + (Number(r.total_clicks) || 0), 0)
    const totalImpressions = data.ads.reduce((s, r) => s + (Number(r.total_impressions) || 0), 0)
    const totalConversions = data.ads.reduce((s, r) => s + (Number(r.total_conversions) || 0), 0)
    parts.push(`\nADS (Meta):
- Gasto Total: R$ ${totalSpend.toFixed(2)}
- Impressoes: ${totalImpressions.toLocaleString('pt-BR')}
- Cliques: ${totalClicks.toLocaleString('pt-BR')}
- Conversoes: ${totalConversions}`)
  }

  // Expenses
  if (data.expenses.length > 0) {
    const totalExpenses = data.expenses.reduce((s, r) => s + (Number(r.price_brl) || 0), 0)
    parts.push(`\nGASTOS (mes atual):
- Total: R$ ${totalExpenses.toFixed(2)}
- Itens: ${data.expenses.length}
- Categorias: ${[...new Set(data.expenses.map(e => e.category))].join(', ')}`)
  }

  // OKRs
  if (data.okrs.length > 0) {
    parts.push(`\nOKRs:`)
    for (const okr of data.okrs) {
      const progress = Number(okr.target_value) > 0
        ? ((Number(okr.current_value) / Number(okr.target_value)) * 100).toFixed(0)
        : '0'
      parts.push(`- [${okr.category}] ${okr.title}: ${okr.current_value}/${okr.target_value} (${progress}%)`)
    }
  }

  // Transactions summary
  if (data.transactions.length > 0) {
    const recurring = data.transactions.filter(t => t.type === 'recurring').length
    const annual = data.transactions.filter(t => t.type === 'annual').length
    const oneTime = data.transactions.filter(t => t.type === 'one_time').length
    parts.push(`\nTRANSACOES (30 dias):
- Total: ${data.transactions.length}
- Recorrentes: ${recurring}
- Anuais: ${annual}
- Avulsas: ${oneTime}`)
  }

  // Systeme
  if (data.systeme) {
    parts.push(`\nSYSTEME.IO:
- Total Contatos: ${data.systeme.total_contacts}
- Novos Hoje: ${data.systeme.new_contacts}`)
  }

  return parts.join('\n')
}
