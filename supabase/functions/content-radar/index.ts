import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse, corsHeaders } from '../_shared/supabase-client.ts'
import { callGemini } from '../_shared/gemini.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  id: string
  username: string
  is_active: boolean
}

interface RawPost {
  id: string
  competitor_id: string
  media_type: string
  caption: string
  hashtags: string[]
  like_count: number
  comment_count: number
  view_count: number | null
  permalink: string
  posted_at: string
  viral_score: number
}

interface PostAnalysis {
  format: string
  hook_type: string
  hook_phrase: string
  retention_mechanism: string
  proof_type: string
  engagement_bait: string
  why_viral: string
}

interface ContentIdea {
  format: string
  hook_text: string
  script_hook: string
  script_beats: string[]
  script_payoff: string
  script_cta: string
  cover_suggestion: string
  caption: string
  hashtags: string[]
  takes_needed: string[]
}

// ─── JSON extractor ───────────────────────────────────────────────────────────

function extractJson<T>(text: string): T {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  const raw = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text
  return JSON.parse(raw.trim()) as T
}

// ─── Viral score calculator ───────────────────────────────────────────────────

function calculateViralScores(posts: RawPost[]): RawPost[] {
  if (posts.length === 0) return posts
  const maxLikes = Math.max(...posts.map(p => p.like_count), 1)
  const maxComments = Math.max(...posts.map(p => p.comment_count), 1)
  const now = Date.now()
  const maxAgeDays = 14

  return posts.map(post => {
    const likeScore = post.like_count / maxLikes
    const commentScore = post.comment_count / maxComments
    const ageDays = Math.max(0, (now - new Date(post.posted_at).getTime()) / (1000 * 60 * 60 * 24))
    const recencyScore = Math.max(0, 1 - ageDays / maxAgeDays)
    const commentToLikeRatio = post.like_count > 0 ? Math.min(1, post.comment_count / post.like_count) : 0
    const viral_score = (likeScore * 0.40 + commentScore * 0.30 + recencyScore * 0.20 + commentToLikeRatio * 0.10) * 100
    return { ...post, viral_score: Math.round(viral_score * 100) / 100 }
  })
}

// ─── Action: Collect ──────────────────────────────────────────────────────────

async function actionCollect(supabase: ReturnType<typeof getServiceClient>, config: Record<string, unknown>) {
  const rapidApiKey = config.rapidapi_key as string
  if (!rapidApiKey) return { error: 'RapidAPI key not configured. Add it in the Config tab.' }

  const collectDays = Number(config.collect_days) || 7
  const { data: competitors, error: compErr } = await supabase
    .from('content_radar_competitors')
    .select('id, username, is_active')
    .eq('is_active', true)

  if (compErr) throw new Error(`Failed to load competitors: ${compErr.message}`)
  if (!competitors || competitors.length === 0) return { message: 'No active competitors configured.', collected: 0 }

  const sinceTimestamp = Math.floor((Date.now() - collectDays * 86400000) / 1000)
  const allPosts: RawPost[] = []

  for (const competitor of competitors as Competitor[]) {
    try {
      const url = `https://instagram-scraper-api2.p.rapidapi.com/v1/posts?username_or_id_or_url=${encodeURIComponent(competitor.username)}&url_type=user`
      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com',
        },
      })
      if (!res.ok) { console.error(`HTTP ${res.status} for @${competitor.username}`); continue }

      const data = await res.json()
      const items = data?.data?.items || []

      for (const item of items) {
        const takenAt = item.taken_at || 0
        if (takenAt < sinceTimestamp) continue
        const captionText: string = item.caption?.text || ''
        const hashtags = (captionText.match(/#\w+/g) || []) as string[]
        allPosts.push({
          id: item.id || item.pk || String(takenAt),
          competitor_id: competitor.id,
          media_type: item.media_type === 1 ? 'IMAGE' : item.media_type === 2 ? 'VIDEO' : item.media_type === 8 ? 'CAROUSEL' : 'REEL',
          caption: captionText,
          hashtags,
          like_count: item.like_count || 0,
          comment_count: item.comment_count || 0,
          view_count: item.view_count || item.play_count || null,
          permalink: item.code ? `https://www.instagram.com/p/${item.code}/` : '',
          posted_at: new Date(takenAt * 1000).toISOString(),
          viral_score: 0,
        })
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error(`Error fetching @${competitor.username}:`, err)
    }
  }

  if (allPosts.length === 0) return { message: 'No posts found in the configured date range.', collected: 0 }

  const scoredPosts = calculateViralScores(allPosts)
  const { error: upsertErr } = await supabase
    .from('content_radar_posts')
    .upsert(
      scoredPosts.map(p => ({
        competitor_id: p.competitor_id, post_id: p.id, media_type: p.media_type,
        caption: p.caption, hashtags: p.hashtags, like_count: p.like_count,
        comment_count: p.comment_count, view_count: p.view_count,
        permalink: p.permalink, posted_at: p.posted_at, viral_score: p.viral_score,
      })),
      { onConflict: 'post_id' }
    )

  if (upsertErr) throw new Error(`Failed to save posts: ${upsertErr.message}`)
  return { message: `Collected ${scoredPosts.length} posts from ${competitors.length} competitors.`, collected: scoredPosts.length }
}

// ─── Action: Analyze ──────────────────────────────────────────────────────────

async function actionAnalyze(supabase: ReturnType<typeof getServiceClient>, geminiKey: string) {
  const { data: posts, error: postsErr } = await supabase
    .from('content_radar_posts')
    .select('id, media_type, caption, hashtags, like_count, comment_count, view_count, posted_at, viral_score')
    .order('viral_score', { ascending: false })
    .limit(50)

  if (postsErr) throw new Error(`Failed to load posts: ${postsErr.message}`)
  if (!posts || posts.length === 0) return { message: 'No posts to analyze.', analyzed: 0 }

  const { data: existing } = await supabase.from('content_radar_analysis').select('post_id')
  const analyzedIds = new Set((existing || []).map((e: Record<string, unknown>) => e.post_id as string))
  const unanalyzed = (posts as Array<Record<string, unknown>>).filter(p => !analyzedIds.has(String(p.id)))

  if (unanalyzed.length === 0) return { message: 'All posts are already analyzed.', analyzed: 0 }

  const systemPrompt = `Você é um especialista em análise de conteúdo viral do Instagram. Analise posts e identifique os mecanismos que os tornam virais. Responda APENAS com JSON válido, sem markdown ou texto extra.`

  let analyzed = 0
  const analysisInserts = []

  for (const post of unanalyzed) {
    try {
      const captionPreview = String(post.caption || '').slice(0, 500)
      const daysAgo = post.posted_at
        ? Math.round((Date.now() - new Date(String(post.posted_at)).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      const prompt = `Analise este post do Instagram e retorne um JSON:

Tipo de mídia: ${post.media_type}
Curtidas: ${post.like_count} | Comentários: ${post.comment_count} | Views: ${post.view_count || 'N/A'}
Postado há: ${daysAgo} dias | Viral Score: ${post.viral_score}/100
Legenda: "${captionPreview}"
Hashtags: ${((post.hashtags as string[]) || []).slice(0, 10).join(', ')}

Retorne EXATAMENTE este JSON (sem markdown):
{
  "format": "talking_head|screen_record|meme|pov|mini_doc|carousel|before_after|other",
  "hook_type": "promise|shock|curiosity|common_mistake|nobody_tells_you|comparison|transformation|other",
  "hook_phrase": "frase de gancho ou início da legenda",
  "retention_mechanism": "quick_cuts|list|tension|expectation_break|visual_proof|challenge|other",
  "proof_type": "demo|numbers|testimonial|screen_proof|none",
  "engagement_bait": "question|poll|challenge|none",
  "why_viral": "Explicação em 1-2 frases em pt-BR"
}`

      const result = await callGemini(geminiKey, {
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        maxOutputTokens: 512,
        temperature: 0.3,
      })

      if (!result.text) { console.error(`Gemini error for post ${post.id}:`, result.error); continue }

      const analysis = extractJson<PostAnalysis>(result.text)
      analysisInserts.push({ post_id: post.id, ...analysis, raw_analysis: analysis })
      analyzed++
      await new Promise(r => setTimeout(r, 150))
    } catch (err) {
      console.error(`Analysis failed for post ${post.id}:`, err)
    }
  }

  if (analysisInserts.length > 0) {
    const { error: insertErr } = await supabase
      .from('content_radar_analysis')
      .upsert(analysisInserts, { onConflict: 'post_id' })
    if (insertErr) throw new Error(`Failed to save analysis: ${insertErr.message}`)
  }

  await buildWeeklyPattern(supabase)
  return { message: `Analyzed ${analyzed} posts.`, analyzed }
}

async function buildWeeklyPattern(supabase: ReturnType<typeof getServiceClient>) {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const { data: analyses } = await supabase
    .from('content_radar_analysis')
    .select('format, hook_type')
    .gte('analyzed_at', weekStartStr)

  if (!analyses || analyses.length === 0) return

  const hookCounts: Record<string, number> = {}
  const formatCounts: Record<string, number> = {}
  for (const a of analyses as Array<Record<string, unknown>>) {
    const hook = String(a.hook_type || 'other')
    const format = String(a.format || 'other')
    hookCounts[hook] = (hookCounts[hook] || 0) + 1
    formatCounts[format] = (formatCounts[format] || 0) + 1
  }

  await supabase.from('content_radar_patterns').upsert(
    { week_start: weekStartStr, top_hooks: hookCounts, top_formats: formatCounts, posts_analyzed: analyses.length },
    { onConflict: 'week_start' }
  )
}

// ─── Action: Ideate ───────────────────────────────────────────────────────────

async function actionIdeate(
  supabase: ReturnType<typeof getServiceClient>,
  geminiKey: string,
  config: Record<string, unknown>
) {
  const { data: patternData } = await supabase
    .from('content_radar_patterns')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  const since14d = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data: topPosts } = await supabase
    .from('content_radar_posts')
    .select('id, caption, media_type, like_count, comment_count, viral_score')
    .gte('posted_at', since14d)
    .order('viral_score', { ascending: false })
    .limit(8)

  const postIds = (topPosts || []).map((p: Record<string, unknown>) => p.id)
  const { data: postAnalyses } = postIds.length > 0
    ? await supabase.from('content_radar_analysis').select('post_id, hook_type, hook_phrase, why_viral').in('post_id', postIds)
    : { data: [] }

  const analysisMap = new Map((postAnalyses || []).map((a: Record<string, unknown>) => [a.post_id, a]))

  const themes = (config.themes as string[]) || []
  const restrictions = config.restrictions as string || ''
  const duration = Number(config.target_duration_seconds) || 30
  const cta = config.cta_preference as string || 'Salva isso porque...'
  const ideasCount = Number(config.ideas_per_run) || 15

  const pattern = patternData as Record<string, unknown> | null
  const topHooks = pattern?.top_hooks
    ? Object.entries(pattern.top_hooks as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []
  const topFormats = pattern?.top_formats
    ? Object.entries(pattern.top_formats as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : []

  const patternSummary = topHooks.length > 0
    ? `Top ganchos: ${topHooks.map(([k, v]) => `${k} (${v}x)`).join(', ')}\nTop formatos: ${topFormats.map(([k, v]) => `${k} (${v}x)`).join(', ')}`
    : 'Sem padrões mapeados ainda.'

  const postContext = (topPosts || []).slice(0, 5).map((p: Record<string, unknown>) => {
    const a = analysisMap.get(String(p.id)) as Record<string, unknown> | undefined
    return `- [${p.media_type}] Score ${p.viral_score}/100 | ${p.like_count} likes | Gancho: "${a?.hook_phrase || String(p.caption || '').slice(0, 60)}" | Por quê: ${a?.why_viral || 'N/A'}`
  }).join('\n')

  const systemPrompt = `Você é um roteirista e estrategista de conteúdo para Instagram Reels. Cria ideias originais baseadas em mecanismos virais, sem copiar conteúdo dos concorrentes. Responde APENAS com JSON válido.

REGRA ANTI-CÓPIA: Nunca reproduza frases dos posts dos concorrentes. Inspire-se no mecanismo, não no conteúdo.`

  const prompt = `Crie ${ideasCount} ideias originais para Instagram Reels.

PADRÕES VIRAIS DA SEMANA:
${patternSummary}

POSTS QUE MAIS PERFORMARAM (referência de mecanismo, NÃO copiar):
${postContext || 'Nenhum post coletado ainda.'}

PERFIL DO CRIADOR:
- Temas: ${themes.length > 0 ? themes.join(', ') : 'use os padrões dos concorrentes como referência'}
- Restrições: ${restrictions || 'nenhuma'}
- Duração alvo: ${duration} segundos
- CTA padrão: "${cta}"
- Tom: educacional, direto, autêntico, sem cringe

Retorne EXATAMENTE um array JSON com ${ideasCount} objetos (sem markdown, sem texto antes ou depois):
[
  {
    "format": "talking_head|screen_record|meme|pov|mini_doc|carousel|before_after",
    "hook_text": "gancho impactante (máximo 10 palavras)",
    "script_hook": "Descrição dos primeiros 3-5 segundos",
    "script_beats": ["beat 1", "beat 2", "beat 3"],
    "script_payoff": "Momento de entrega de valor",
    "script_cta": "Call to action específico",
    "cover_suggestion": "O que aparece na capa/thumbnail",
    "caption": "Legenda completa com emojis",
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "takes_needed": ["Take 1: descrição", "Take 2: descrição"]
  }
]`

  const result = await callGemini(geminiKey, {
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    maxOutputTokens: 8192,
    temperature: 0.85,
  })

  if (!result.text) throw new Error(`Gemini ideation failed: ${result.error}`)

  const ideas = extractJson<ContentIdea[]>(result.text)
  if (!Array.isArray(ideas) || ideas.length === 0) throw new Error('Gemini did not return a valid ideas array')

  const { error: insertErr } = await supabase
    .from('content_radar_ideas')
    .insert(ideas.map(idea => ({ pattern_id: pattern?.id || null, source_post_id: null, ...idea, status: 'new' })))

  if (insertErr) throw new Error(`Failed to save ideas: ${insertErr.message}`)
  return { message: `Generated ${ideas.length} original content ideas.`, generated: ideas.length }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500)

  try {
    const body = await req.json()
    const action = body?.action as string
    if (!['collect', 'analyze', 'ideate', 'full-run'].includes(action)) {
      return jsonResponse({ error: 'action must be: collect | analyze | ideate | full-run' }, 400)
    }

    const supabase = getServiceClient()
    const { data: configData } = await supabase.from('content_radar_config').select('*').limit(1).single()
    const config = (configData as Record<string, unknown>) || {}

    const result: Record<string, unknown> = {}
    if (action === 'collect' || action === 'full-run') result.collect = await actionCollect(supabase, config)
    if (action === 'analyze' || action === 'full-run') result.analyze = await actionAnalyze(supabase, geminiKey)
    if (action === 'ideate' || action === 'full-run') result.ideate = await actionIdeate(supabase, geminiKey, config)

    if (action === 'full-run' && config.id) {
      await supabase.from('content_radar_config').update({ last_run_at: new Date().toISOString() }).eq('id', config.id)
    }

    return jsonResponse({ success: true, action, result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('content-radar error:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
