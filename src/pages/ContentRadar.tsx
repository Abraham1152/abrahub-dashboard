import { useState, useEffect, useCallback } from 'react'
import {
  Radar,
  Play,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Eye,
  BookmarkCheck,
  CheckCircle2,
  X,
  Settings,
  TrendingUp,
  Lightbulb,
  Search,
  Copy,
  Check,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  id: string
  username: string
  platform: string
  is_active: boolean
  follower_count: number | null
  added_at: string
}

interface Post {
  id: string
  competitor_id: string
  post_id: string
  media_type: string
  caption: string
  hashtags: string[]
  like_count: number
  comment_count: number
  view_count: number | null
  permalink: string
  posted_at: string
  viral_score: number
  collected_at: string
  content_radar_analysis?: Analysis | null
  content_radar_competitors?: { username: string } | null
}

interface Analysis {
  id: string
  format: string
  hook_type: string
  hook_phrase: string
  retention_mechanism: string
  proof_type: string
  engagement_bait: string
  why_viral: string
}

interface Pattern {
  id: string
  week_start: string
  top_hooks: Record<string, number>
  top_formats: Record<string, number>
  trending_themes: string[]
  gaps: string[]
  saturated_themes: string[]
  summary: string | null
  posts_analyzed: number
}

interface Idea {
  id: string
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
  status: 'new' | 'saved' | 'used' | 'discarded'
  created_at: string
}

interface Config {
  id: string
  themes: string[]
  restrictions: string
  target_duration_seconds: number
  cta_preference: string
  rapidapi_key: string
  collect_days: number
  ideas_per_run: number
  is_active: boolean
  last_run_at: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  talking_head: 'Talking Head',
  screen_record: 'Tela Gravada',
  meme: 'Meme',
  pov: 'POV',
  mini_doc: 'Mini Doc',
  carousel: 'Carrossel',
  before_after: 'Antes/Depois',
  other: 'Outro',
}

const HOOK_LABELS: Record<string, string> = {
  promise: 'Promessa',
  shock: 'Choque',
  curiosity: 'Curiosidade',
  common_mistake: 'Erro Comum',
  nobody_tells_you: 'Ninguém Te Conta',
  comparison: 'Comparação',
  transformation: 'Transformação',
  other: 'Outro',
}

const HOOK_COLORS: Record<string, string> = {
  promise: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  shock: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  curiosity: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  common_mistake: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  nobody_tells_you: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  comparison: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  transformation: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-neutral-300',
}

function viralScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
  return 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IdeaCard({ idea, onStatusChange }: { idea: Idea; onStatusChange: (id: string, status: Idea['status']) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [copiedCaption, setCopiedCaption] = useState(false)

  const copyCaption = async () => {
    await navigator.clipboard.writeText(idea.caption + '\n\n' + idea.hashtags.join(' '))
    setCopiedCaption(true)
    setTimeout(() => setCopiedCaption(false), 2000)
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-2xl border transition-all ${
      idea.status === 'used' ? 'border-green-200 dark:border-green-800/40 opacity-70' :
      idea.status === 'discarded' ? 'border-gray-100 dark:border-neutral-800 opacity-40' :
      idea.status === 'saved' ? 'border-blue-200 dark:border-blue-800/40' :
      'border-gray-100 dark:border-neutral-800 hover:border-gray-200 dark:hover:border-neutral-700'
    }`}>
      <div className="p-5">
        {/* Format + hook badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400">
            {FORMAT_LABELS[idea.format] || idea.format}
          </span>
          {idea.script_beats?.length > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500">
              {idea.script_beats.length} beats
            </span>
          )}
          {idea.status === 'saved' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              Salvo
            </span>
          )}
          {idea.status === 'used' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
              Usado
            </span>
          )}
        </div>

        {/* Hook text */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug mb-3">
          "{idea.hook_text}"
        </h3>

        {/* Cover suggestion */}
        {idea.cover_suggestion && (
          <p className="text-xs text-gray-500 dark:text-neutral-500 mb-4 flex items-start gap-1.5">
            <span className="mt-0.5">🎬</span>
            <span><span className="font-medium text-gray-600 dark:text-neutral-400">Capa:</span> {idea.cover_suggestion}</span>
          </p>
        )}

        {/* Expand/collapse script */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-4"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Ocultar roteiro' : 'Ver roteiro completo'}
        </button>

        {expanded && (
          <div className="space-y-4 mb-4 pl-3 border-l-2 border-gray-100 dark:border-neutral-800">
            {idea.script_hook && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-1">Hook (0-5s)</p>
                <p className="text-sm text-gray-700 dark:text-neutral-300">{idea.script_hook}</p>
              </div>
            )}

            {idea.script_beats?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-1">Beats</p>
                <ol className="space-y-1">
                  {idea.script_beats.map((beat, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-neutral-300 flex gap-2">
                      <span className="text-gray-400 dark:text-neutral-500 flex-shrink-0">{i + 1}.</span>
                      {beat}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {idea.script_payoff && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-1">Payoff</p>
                <p className="text-sm text-gray-700 dark:text-neutral-300">{idea.script_payoff}</p>
              </div>
            )}

            {idea.script_cta && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-1">CTA</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{idea.script_cta}</p>
              </div>
            )}

            {idea.takes_needed?.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-1">Takes necessários</p>
                <ul className="space-y-1">
                  {idea.takes_needed.map((take, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-neutral-400 flex gap-2">
                      <span className="text-gray-300 dark:text-neutral-600">○</span>
                      {take}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {idea.caption && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-1">Legenda</p>
                <div className="bg-gray-50 dark:bg-neutral-800 rounded-xl p-3 relative">
                  <p className="text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-line pr-8">{idea.caption}</p>
                  {idea.hashtags?.length > 0 && (
                    <p className="text-sm text-blue-500 dark:text-blue-400 mt-2">{idea.hashtags.join(' ')}</p>
                  )}
                  <button
                    onClick={copyCaption}
                    className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-400"
                    title="Copiar legenda"
                  >
                    {copiedCaption ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {idea.status !== 'discarded' && (
          <div className="flex gap-2">
            {idea.status !== 'saved' && idea.status !== 'used' && (
              <button
                onClick={() => onStatusChange(idea.id, 'saved')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
              >
                <BookmarkCheck size={13} /> Salvar
              </button>
            )}
            {idea.status !== 'used' && (
              <button
                onClick={() => onStatusChange(idea.id, 'used')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
              >
                <CheckCircle2 size={13} /> Usado
              </button>
            )}
            <button
              onClick={() => onStatusChange(idea.id, 'discarded')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X size={13} /> Descartar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContentRadar() {
  const [activeTab, setActiveTab] = useState<'radar' | 'patterns' | 'ideas' | 'config'>('radar')
  const [running, setRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  // Data
  const [posts, setPosts] = useState<Post[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [config, setConfig] = useState<Config | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])

  // Loading
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)

  // Filters
  const [ideasFilter, setIdeasFilter] = useState<'all' | 'saved' | 'used'>('all')
  const [postsFilter, setPostsFilter] = useState<string>('all')
  const [searchIdeas, setSearchIdeas] = useState('')

  // Config editing state
  const [editConfig, setEditConfig] = useState<Partial<Config>>({})
  const [newCompetitor, setNewCompetitor] = useState('')
  const [newTheme, setNewTheme] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || ''
  const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

  // ─── Loaders ─────────────────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true)
    const { data } = await supabase
      .from('content_radar_posts')
      .select(`
        *,
        content_radar_analysis(*),
        content_radar_competitors(username)
      `)
      .order('viral_score', { ascending: false })
      .limit(50)
    setPosts((data as Post[]) || [])
    setLoadingPosts(false)
  }, [])

  const loadPatterns = useCallback(async () => {
    const { data } = await supabase
      .from('content_radar_patterns')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(4)
    setPatterns((data as Pattern[]) || [])
  }, [])

  const loadIdeas = useCallback(async () => {
    setLoadingIdeas(true)
    const { data } = await supabase
      .from('content_radar_ideas')
      .select('*')
      .neq('status', 'discarded')
      .order('created_at', { ascending: false })
      .limit(60)
    setIdeas((data as Idea[]) || [])
    setLoadingIdeas(false)
  }, [])

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    const { data: cfgData } = await supabase
      .from('content_radar_config')
      .select('*')
      .limit(1)
      .single()

    const { data: compData } = await supabase
      .from('content_radar_competitors')
      .select('*')
      .order('added_at', { ascending: true })

    if (cfgData) {
      setConfig(cfgData as Config)
      setEditConfig(cfgData as Config)
    }
    setCompetitors((compData as Competitor[]) || [])
    setLoadingConfig(false)
  }, [])

  useEffect(() => {
    loadPosts()
    loadPatterns()
    loadIdeas()
    loadConfig()
  }, [loadPosts, loadPatterns, loadIdeas, loadConfig])

  // ─── Actions ──────────────────────────────────────────────────────────────────

  const runAgent = async (action: 'full-run' | 'collect' | 'analyze' | 'ideate') => {
    setRunning(true)
    setRunStatus(`Executando ${action}...`)
    setRunError(null)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/content-radar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()

      if (data.error) {
        setRunError(data.error)
      } else {
        const r = data.result || {}
        const parts = []
        if (r.collect?.collected !== undefined) parts.push(`${r.collect.collected} posts coletados`)
        if (r.analyze?.analyzed !== undefined) parts.push(`${r.analyze.analyzed} analisados`)
        if (r.ideate?.generated !== undefined) parts.push(`${r.ideate.generated} ideias geradas`)
        if (r.collect?.error) parts.push(`⚠️ ${r.collect.error}`)
        setRunStatus(parts.length > 0 ? parts.join(' · ') : 'Concluído')

        await loadPosts()
        await loadPatterns()
        await loadIdeas()
        await loadConfig()
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setRunning(false)
    }
  }

  const updateIdeaStatus = async (id: string, status: Idea['status']) => {
    await supabase.from('content_radar_ideas').update({ status }).eq('id', id)
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const addCompetitor = async () => {
    const username = newCompetitor.trim().replace('@', '')
    if (!username) return
    const { data } = await supabase
      .from('content_radar_competitors')
      .insert({ username, platform: 'instagram' })
      .select()
      .single()
    if (data) {
      setCompetitors(prev => [...prev, data as Competitor])
      setNewCompetitor('')
    }
  }

  const toggleCompetitor = async (id: string, is_active: boolean) => {
    await supabase.from('content_radar_competitors').update({ is_active }).eq('id', id)
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, is_active } : c))
  }

  const removeCompetitor = async (id: string) => {
    await supabase.from('content_radar_competitors').delete().eq('id', id)
    setCompetitors(prev => prev.filter(c => c.id !== id))
  }

  const addTheme = () => {
    const t = newTheme.trim()
    if (!t) return
    setEditConfig(prev => ({ ...prev, themes: [...(prev.themes || []), t] }))
    setNewTheme('')
  }

  const removeTheme = (theme: string) => {
    setEditConfig(prev => ({ ...prev, themes: (prev.themes || []).filter(t => t !== theme) }))
  }

  const saveConfig = async () => {
    if (!config?.id) return
    setSavingConfig(true)
    await supabase
      .from('content_radar_config')
      .update({
        themes: editConfig.themes,
        restrictions: editConfig.restrictions,
        target_duration_seconds: editConfig.target_duration_seconds,
        cta_preference: editConfig.cta_preference,
        rapidapi_key: editConfig.rapidapi_key,
        collect_days: editConfig.collect_days,
        ideas_per_run: editConfig.ideas_per_run,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id)
    setConfig(prev => prev ? { ...prev, ...editConfig } as Config : prev)
    setSavingConfig(false)
  }

  // ─── Derived data ─────────────────────────────────────────────────────────────

  const filteredPosts = posts.filter(p => {
    if (postsFilter === 'all') return true
    return p.content_radar_competitors?.username === postsFilter
  })

  const filteredIdeas = ideas.filter(i => {
    if (ideasFilter !== 'all' && i.status !== ideasFilter) return false
    if (searchIdeas) {
      const q = searchIdeas.toLowerCase()
      return i.hook_text.toLowerCase().includes(q) || (i.caption || '').toLowerCase().includes(q)
    }
    return true
  })

  const competitorUsernames = [...new Set(posts.map(p => p.content_radar_competitors?.username).filter(Boolean))]
  const savedCount = ideas.filter(i => i.status === 'saved').length
  const usedCount = ideas.filter(i => i.status === 'used').length
  const newCount = ideas.filter(i => i.status === 'new').length

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
            <Radar size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Content Radar</h1>
            <p className="text-xs text-gray-500 dark:text-neutral-500">
              {config?.last_run_at
                ? `Última coleta: ${new Date(config.last_run_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : 'Nenhuma coleta realizada ainda'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {runStatus && !running && (
            <span className="text-xs text-gray-500 dark:text-neutral-500 max-w-xs truncate">{runStatus}</span>
          )}
          {runError && (
            <span className="text-xs text-red-500 max-w-xs truncate" title={runError}>⚠️ {runError}</span>
          )}
          <button
            onClick={() => runAgent('full-run')}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            {running ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
            {running ? 'Rodando...' : 'Rodar Agora'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Posts capturados', value: posts.length, icon: Search, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Ideias novas', value: newCount, icon: Lightbulb, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10' },
          { label: 'Ideias salvas', value: savedCount, icon: BookmarkCheck, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10' },
          { label: 'Usadas', value: usedCount, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>
              <stat.icon size={16} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
        {([
          { id: 'radar', label: 'Radar', icon: Search },
          { id: 'patterns', label: 'Padrões', icon: TrendingUp },
          { id: 'ideas', label: 'Ideias', icon: Lightbulb },
          { id: 'config', label: 'Config', icon: Settings },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Radar ────────────────────────────────────────────────────────── */}
      {activeTab === 'radar' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500 dark:text-neutral-500">Filtrar por:</span>
            {['all', ...competitorUsernames].map(u => (
              <button
                key={String(u)}
                onClick={() => setPostsFilter(String(u))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  postsFilter === String(u)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                }`}
              >
                {String(u) === 'all' ? 'Todos' : `@${u}`}
              </button>
            ))}
            <button
              onClick={() => runAgent('collect')}
              disabled={running}
              className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
              Coletar
            </button>
          </div>

          {loadingPosts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 animate-pulse h-44" />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <Radar size={40} className="mx-auto text-gray-300 dark:text-neutral-700 mb-4" />
              <p className="text-gray-500 dark:text-neutral-500 font-medium">Nenhum post capturado ainda</p>
              <p className="text-sm text-gray-400 dark:text-neutral-600 mt-1">Configure os concorrentes e clique em "Rodar Agora"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map(post => {
                const analysis = post.content_radar_analysis
                return (
                  <div key={post.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                        @{post.content_radar_competitors?.username || '—'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${viralScoreColor(post.viral_score)}`}>
                          {Math.round(post.viral_score)}
                        </span>
                        {post.permalink && (
                          <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Caption */}
                    <p className="text-sm text-gray-600 dark:text-neutral-400 line-clamp-3 flex-1">
                      {post.caption || <span className="italic text-gray-400">Sem legenda</span>}
                    </p>

                    {/* Analysis badges */}
                    {analysis && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${HOOK_COLORS[analysis.hook_type] || HOOK_COLORS.other}`}>
                          {HOOK_LABELS[analysis.hook_type] || analysis.hook_type}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400">
                          {FORMAT_LABELS[analysis.format] || analysis.format}
                        </span>
                      </div>
                    )}

                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-neutral-500">
                      <span className="flex items-center gap-1"><Heart size={11} /> {post.like_count.toLocaleString('pt-BR')}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={11} /> {post.comment_count.toLocaleString('pt-BR')}</span>
                      {post.view_count != null && (
                        <span className="flex items-center gap-1"><Eye size={11} /> {post.view_count.toLocaleString('pt-BR')}</span>
                      )}
                      <span className="ml-auto text-[10px]">
                        {new Date(post.posted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>

                    {/* Why viral */}
                    {analysis?.why_viral && (
                      <p className="text-xs text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-800 rounded-lg p-2 leading-relaxed">
                        {analysis.why_viral}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Padrões ──────────────────────────────────────────────────────── */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <div className="text-center py-16">
              <TrendingUp size={40} className="mx-auto text-gray-300 dark:text-neutral-700 mb-4" />
              <p className="text-gray-500 dark:text-neutral-500 font-medium">Sem padrões mapeados ainda</p>
              <p className="text-sm text-gray-400 dark:text-neutral-600 mt-1">Execute "Rodar Agora" para analisar os posts coletados</p>
            </div>
          ) : patterns.map(pattern => {
            const hooks = Object.entries(pattern.top_hooks || {}).sort((a, b) => b[1] - a[1])
            const formats = Object.entries(pattern.top_formats || {}).sort((a, b) => b[1] - a[1])
            const maxHook = hooks[0]?.[1] || 1
            const maxFormat = formats[0]?.[1] || 1

            return (
              <div key={pattern.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Semana de {new Date(pattern.week_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-neutral-500">{pattern.posts_analyzed} posts analisados</span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top Hooks */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-3">Top Ganchos</p>
                    <div className="space-y-2">
                      {hooks.map(([hook, count]) => (
                        <div key={hook} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 dark:text-neutral-400 w-36 flex-shrink-0">{HOOK_LABELS[hook] || hook}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-purple-500 dark:bg-purple-400"
                              style={{ width: `${(count / maxHook) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 dark:text-neutral-500 w-4">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Formats */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-3">Top Formatos</p>
                    <div className="space-y-2">
                      {formats.map(([format, count]) => (
                        <div key={format} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 dark:text-neutral-400 w-36 flex-shrink-0">{FORMAT_LABELS[format] || format}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-blue-500 dark:bg-blue-400"
                              style={{ width: `${(count / maxFormat) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500 dark:text-neutral-500 w-4">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gaps */}
                {pattern.gaps?.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-100 dark:border-neutral-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-2">Lacunas identificadas</p>
                    <div className="flex flex-wrap gap-2">
                      {pattern.gaps.map((gap, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-full">
                          💡 {gap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {pattern.summary && (
                  <p className="mt-4 text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">{pattern.summary}</p>
                )}
              </div>
            )
          })}

          <button
            onClick={() => runAgent('analyze')}
            disabled={running}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
            Reanalisar posts
          </button>
        </div>
      )}

      {/* ── Tab: Ideias ───────────────────────────────────────────────────────── */}
      {activeTab === 'ideas' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter */}
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
              {([
                { id: 'all', label: 'Todas' },
                { id: 'saved', label: 'Salvas' },
                { id: 'used', label: 'Usadas' },
              ] as const).map(f => (
                <button
                  key={f.id}
                  onClick={() => setIdeasFilter(f.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    ideasFilter === f.id
                      ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-neutral-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar ideias..."
                value={searchIdeas}
                onChange={e => setSearchIdeas(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <button
              onClick={() => runAgent('ideate')}
              disabled={running}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              <Lightbulb size={13} />
              Gerar ideias
            </button>
          </div>

          {loadingIdeas ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 animate-pulse h-48" />
              ))}
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="text-center py-16">
              <Lightbulb size={40} className="mx-auto text-gray-300 dark:text-neutral-700 mb-4" />
              <p className="text-gray-500 dark:text-neutral-500 font-medium">Nenhuma ideia ainda</p>
              <p className="text-sm text-gray-400 dark:text-neutral-600 mt-1">Clique em "Gerar ideias" ou "Rodar Agora"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onStatusChange={updateIdeaStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Config ───────────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-5">
            {/* Competitors */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Concorrentes monitorados</h3>

              <div className="space-y-2 mb-4">
                {competitors.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCompetitor(c.id, !c.is_active)}
                      className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${c.is_active ? 'bg-purple-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${c.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <span className={`text-sm flex-1 ${c.is_active ? 'text-gray-800 dark:text-neutral-200' : 'text-gray-400 dark:text-neutral-600 line-through'}`}>
                      @{c.username}
                    </span>
                    <button onClick={() => removeCompetitor(c.id)} className="text-gray-300 dark:text-neutral-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="@username"
                  value={newCompetitor}
                  onChange={e => setNewCompetitor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCompetitor()}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <button
                  onClick={addCompetitor}
                  className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm transition-colors"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </div>

            {/* Themes */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Meus temas</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(editConfig.themes || []).map(theme => (
                  <span key={theme} className="flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">
                    {theme}
                    <button onClick={() => removeTheme(theme)} className="hover:text-red-500 transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: IA, produtividade, bastidores..."
                  value={newTheme}
                  onChange={e => setNewTheme(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTheme()}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <button
                  onClick={addTheme}
                  className="px-3 py-2 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-400 rounded-xl text-sm transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Restrictions */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Restrições</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mb-3">O que você não posta, seu tom, o que evitar</p>
              <textarea
                rows={4}
                value={editConfig.restrictions || ''}
                onChange={e => setEditConfig(prev => ({ ...prev, restrictions: e.target.value }))}
                placeholder="Ex: Não uso linguagem de coach. Evito promessas de renda. Tom direto, sem exageros..."
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Parameters */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Parâmetros</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">
                    Duração alvo: <span className="text-purple-600 dark:text-purple-400">{editConfig.target_duration_seconds || 30}s</span>
                  </label>
                  <input
                    type="range" min={15} max={60} step={5}
                    value={editConfig.target_duration_seconds || 30}
                    onChange={e => setEditConfig(prev => ({ ...prev, target_duration_seconds: Number(e.target.value) }))}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-neutral-600">
                    <span>15s</span><span>30s</span><span>45s</span><span>60s</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">CTA padrão</label>
                  <input
                    type="text"
                    value={editConfig.cta_preference || ''}
                    onChange={e => setEditConfig(prev => ({ ...prev, cta_preference: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Coletar últimos X dias</label>
                    <select
                      value={editConfig.collect_days || 7}
                      onChange={e => setEditConfig(prev => ({ ...prev, collect_days: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"
                    >
                      <option value={7}>7 dias</option>
                      <option value={14}>14 dias</option>
                      <option value={30}>30 dias</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1">Ideias por rodada</label>
                    <select
                      value={editConfig.ideas_per_run || 15}
                      onChange={e => setEditConfig(prev => ({ ...prev, ideas_per_run: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"
                    >
                      <option value={10}>10 ideias</option>
                      <option value={15}>15 ideias</option>
                      <option value={20}>20 ideias</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* RapidAPI Key */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Integração RapidAPI</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mb-3">
                Chave da API do Instagram Scraper API2 no{' '}
                <a href="https://rapidapi.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  RapidAPI
                </a>
              </p>
              <input
                type="password"
                value={editConfig.rapidapi_key || ''}
                onChange={e => setEditConfig(prev => ({ ...prev, rapidapi_key: e.target.value }))}
                placeholder="Sua chave RapidAPI..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-mono"
              />
              {!editConfig.rapidapi_key && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">⚠️ Sem a chave, a coleta automática não funcionará.</p>
              )}
            </div>

            {/* Save */}
            <button
              onClick={saveConfig}
              disabled={savingConfig || loadingConfig}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {savingConfig ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
