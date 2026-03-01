import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useState, useRef, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Megaphone,
  Wallet,
  Target,
  TrendingUp,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Archive,
  HelpCircle,
  BarChart3,
  DollarSign,
  Users,
  Zap,
  Bot,
  Send,
  Sparkles,
  Settings,
  Save,
  Loader2,
  Clock,
  ArrowUpRight,
  Check,
  X,
  Pencil,
  Image,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Rocket,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  BookOpen,
} from 'lucide-react'

// ==================== TYPES ====================

interface AdsCampaign {
  id: string
  campaign_id: string
  account_id: string
  name: string
  status: string
  objective: string | null
  daily_budget: number | null
  lifetime_budget: number | null
  impressions: number
  clicks: number
  reach: number
  spend: number
  cpc: number
  cpm: number
  ctr: number
  conversions: number
  cost_per_result: number
  created_time: string | null
  updated_time: string | null
  last_synced_at: string
  created_at: string
  _platform: 'meta'
}

interface GoogleAdsCampaign {
  id: string
  campaign_id: string
  customer_id: string
  name: string
  status: string
  campaign_type: string | null
  bidding_strategy: string | null
  daily_budget: number
  cost: number
  impressions: number
  clicks: number
  conversions: number
  cpc: number
  cpm: number
  ctr: number
  cost_per_conversion: number
  search_impression_share: number | null
  last_synced_at: string
  created_at: string
  _platform: 'google'
}

// Normalized shape for unified rendering
interface NormalizedCampaign {
  id: string
  campaign_id: string
  name: string
  status: string
  daily_budget: number | null
  lifetime_budget?: number | null
  impressions: number
  clicks: number
  spend: number
  cpc: number
  cpm: number
  ctr: number
  conversions: number
  cpa: number
  campaign_type?: string | null
  platform: 'meta' | 'google'
}

type Platform = 'meta' | 'google'
type SortField = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'name' | 'cpa' | 'conversions'
type SortDir = 'asc' | 'desc'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

// ==================== HELPERS ====================

const SUPABASE_URL = 'https://jdodenbjohnqvhvldfqu.supabase.co'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec'

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number) => `${n.toFixed(2)}%`

const statusConfig: Record<string, { key: string; color: string; icon: any }> = {
  ACTIVE: { key: 'ads.active_label', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', icon: Target },
  ENABLED: { key: 'ads.enabled_label', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', icon: Target },
  PAUSED: { key: 'ads.paused_label', color: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300', icon: Pause },
  DELETED: { key: 'ads.deleted_label', color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300', icon: Trash2 },
  ARCHIVED: { key: 'ads.archived_label', color: 'bg-gray-100 dark:bg-neutral-500/20 text-gray-600 dark:text-neutral-400', icon: Archive },
  REMOVED: { key: 'ads.deleted_label', color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300', icon: Trash2 },
}

const CHART_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6']

async function adsAction(path: string, method = 'POST', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ads-actions${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function googleAdsAction(path: string, method = 'POST', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-ads-actions/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

function normalizeMetaCampaign(c: AdsCampaign): NormalizedCampaign {
  return {
    id: c.id,
    campaign_id: c.campaign_id,
    name: c.name,
    status: c.status,
    daily_budget: c.daily_budget,
    lifetime_budget: c.lifetime_budget,
    impressions: c.impressions,
    clicks: c.clicks,
    spend: c.spend,
    cpc: c.cpc,
    cpm: c.cpm,
    ctr: c.ctr,
    conversions: c.conversions,
    cpa: c.cost_per_result,
    platform: 'meta',
  }
}

function normalizeGoogleCampaign(c: GoogleAdsCampaign): NormalizedCampaign {
  return {
    id: c.id,
    campaign_id: c.campaign_id,
    name: c.name,
    status: c.status,
    daily_budget: c.daily_budget,
    impressions: c.impressions,
    clicks: c.clicks,
    spend: c.cost,
    cpc: c.cpc,
    cpm: c.cpm,
    ctr: c.ctr,
    conversions: c.conversions,
    cpa: c.cost_per_conversion,
    campaign_type: c.campaign_type,
    platform: 'google',
  }
}

// ==================== MAIN PAGE ====================

export default function AdsManagerPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showConfig, setShowConfig] = useState(false)
  const [showCreator, setShowCreator] = useState(false)
  const [showGoogleSetup, setShowGoogleSetup] = useState(false)
  const [platform, setPlatform] = useState<Platform>('meta')

  // Fetch Meta campaigns
  const { data: metaCampaigns = [], isLoading: loadingMeta } = useQuery({
    queryKey: ['ads-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_campaigns')
        .select('*')
        .order('spend', { ascending: false })
      return (data || []).map((c: any) => ({ ...c, _platform: 'meta' as const })) as AdsCampaign[]
    },
  })

  // Fetch Google campaigns
  const { data: googleCampaigns = [], isLoading: loadingGoogle } = useQuery({
    queryKey: ['google-ads-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_ads_campaigns' as any)
        .select('*')
        .order('cost', { ascending: false })
      return (data || []).map((c: any) => ({ ...c, _platform: 'google' as const })) as GoogleAdsCampaign[]
    },
  })

  // Fetch Google config
  const { data: googleConfig } = useQuery({
    queryKey: ['google-ads-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_ads_config' as any)
        .select('id, customer_id, is_connected, updated_at')
        .single()
      return data as any
    },
  })

  // Fetch churn for new customers display
  const { data: churnData } = useQuery({
    queryKey: ['ads-churn'],
    queryFn: async () => {
      const { data } = await supabase
        .from('churn_metrics' as any)
        .select('new_customers')
        .order('date', { ascending: false })
        .limit(1)
        .single()
      return data as { new_customers: number } | null
    },
  })

  const isLoading = loadingMeta && loadingGoogle

  // Normalize campaigns for active platform
  const allNormalized: NormalizedCampaign[] = platform === 'meta'
    ? metaCampaigns.map(normalizeMetaCampaign)
    : googleCampaigns.map(normalizeGoogleCampaign)

  // Sync ads
  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const fn = platform === 'meta' ? 'sync-ads' : 'sync-google-ads'
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ANON_KEY}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSyncError(err.error || `Erro ${res.status} ao sincronizar`)
      } else {
        queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
        queryClient.invalidateQueries({ queryKey: ['google-ads-campaigns'] })
        queryClient.invalidateQueries({ queryKey: ['ads-agent-actions'] })
      }
    } catch (e: any) {
      setSyncError(e?.message || 'Erro de conexão ao sincronizar')
    }
    setSyncing(false)
  }

  // Sort
  const sorted = [...allNormalized].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'name') return dir * a.name.localeCompare(b.name)
    return dir * ((a[sortField] as number) - (b[sortField] as number))
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // KPI calculations
  const totalSpend = allNormalized.reduce((s, c) => s + c.spend, 0)
  const totalConversions = allNormalized.reduce((s, c) => s + c.conversions, 0)
  const activeCampaigns = allNormalized.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED').length
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0
  const newCustomers = churnData?.new_customers || 0
  const cac = totalSpend > 0 && totalConversions > 0 ? totalSpend / totalConversions : 0
  const totalImpressions = allNormalized.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = allNormalized.reduce((s, c) => s + c.clicks, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  // Chart data
  const chartData = allNormalized
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8)
    .map(c => ({
      name: c.name.length > 25 ? c.name.substring(0, 25) + '...' : c.name,
      spend: c.spend,
    }))

  // Status breakdown
  const statusBreakdown = allNormalized.reduce((acc, c) => {
    const displayStatus = c.status === 'ENABLED' ? 'ACTIVE' : c.status
    acc[displayStatus] = (acc[displayStatus] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400 dark:text-neutral-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Megaphone size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ads.title')}</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm">
              {allNormalized.length} {t('ads.campaigns')} · {activeCampaigns} {t('ads.active')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {platform !== 'google' && (
            <button
              onClick={() => setShowCreator(!showCreator)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                showCreator
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                  : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Sparkles size={15} />
              {t('ads.create_ad')}
            </button>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              showConfig
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
            }`}
          >
            <Settings size={15} />
            {t('ads.optimizer')}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {t('ads.sync')}
          </button>
        </div>
      </div>
      {syncError && (
        <p className="text-xs text-red-500 mt-1 text-right">{syncError}</p>
      )}

      {/* Platform Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1 w-fit">
        {(['meta', 'google'] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setShowCreator(false); setShowGoogleSetup(false) }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              platform === p
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
          >
            {t(`ads.platform_${p}`)}
          </button>
        ))}
        {!googleConfig?.is_connected && (
          <button
            onClick={() => setShowGoogleSetup(!showGoogleSetup)}
            className={`ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showGoogleSetup
                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
            }`}
          >
            {t('ads.google_setup')}
          </button>
        )}
      </div>

      {/* Google Ads Setup Panel */}
      {showGoogleSetup && <GoogleAdsSetup queryClient={queryClient} />}

      {/* AI Ad Creator Wizard — Meta only */}
      {showCreator && platform !== 'google' && <AdCreatorWizard onClose={() => setShowCreator(false)} queryClient={queryClient} />}

      {/* Optimizer Config Panel */}
      {showConfig && <OptimizerConfig />}

      {/* Pending Approval Cards */}
      <PendingApprovalCards platform={platform} />

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={Wallet} label={t('ads.total_spend')} value={BRL(totalSpend)} accent="red" sub={t('ads.last_30_days')} />
        <KPICard icon={DollarSign} label={t('ads.cac')} value={cac > 0 ? BRL(cac) : '-'} accent="amber" sub={`${newCustomers} ${t('ads.new_clients')}`} />
        <KPICard icon={TrendingUp} label={t('ads.avg_ctr')} value={avgCtr > 0 ? `${avgCtr.toFixed(2)}%` : '-'} accent={avgCtr >= 1 ? 'emerald' : 'amber'} sub={`${fmtNum(totalClicks)} clicks`} />
        <KPICard icon={Zap} label={t('ads.conversions')} value={fmtNum(totalConversions)} accent="blue" />
        <KPICard icon={Target} label={t('ads.active_label')} value={String(activeCampaigns)} accent="emerald" />
        <KPICard icon={Users} label={t('ads.avg_cpa')} value={avgCpa > 0 ? BRL(avgCpa) : '-'} accent="purple" />
      </div>

      {/* Chart + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            {t('ads.spend_by_campaign')}
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} tick={{ fill: isDark ? '#737373' : '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={160} tick={{ fill: isDark ? '#d4d4d4' : '#374151', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => [BRL(value), t('ads.spend')]} contentStyle={{ background: isDark ? '#262626' : '#fff', border: `1px solid ${isDark ? '#404040' : '#e5e7eb'}`, borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 dark:text-neutral-600 text-sm">
              {t('ads.no_spend')}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('ads.campaign_status')}</h3>
          <div className="space-y-3">
            {Object.entries(statusBreakdown).map(([status, count]) => {
              const cfg = statusConfig[status] || { key: status, color: 'bg-gray-100 text-gray-500', icon: HelpCircle }
              const Icon = cfg.icon
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color}`}>
                    <Icon size={12} /> {t(cfg.key)}
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <p className="text-xs text-gray-500 dark:text-neutral-500">{t('ads.total')}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{allNormalized.length}</p>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <CampaignTable campaigns={sorted} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} queryClient={queryClient} />

      {/* AI Chat + Action History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdsAgentChat />
        </div>
        <ActionHistory platform={platform} />
      </div>
    </div>
  )
}

// ==================== KPI CARD ====================

function KPICard({ icon: Icon, label, value, accent, sub }: { icon: any; label: string; value: string; accent: string; sub?: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-500' },
  }
  const c = colors[accent] || colors.blue
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`p-2 rounded-xl ${c.bg}`}><Icon size={16} className={c.text} /></span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-neutral-600">{sub}</p>}
    </div>
  )
}

// ==================== PENDING APPROVAL CARDS ====================

interface PendingAction {
  id: string
  campaign_id: string
  campaign_name: string
  action_type: 'pause' | 'boost' | 'adjust_budget'
  ai_reasoning: string
  current_metrics: { spend: number; conversions: number; cpa: number; ctr: number }
  proposed_changes: Record<string, unknown>
  status: string
  created_at: string
}

function PendingApprovalCards({ platform }: { platform: Platform }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const { data: pendingActions = [] } = useQuery({
    queryKey: ['ads-pending-actions'],
    queryFn: async () => {
      const res = await adsAction('/pending-actions', 'GET')
      return (res.pending_actions || []) as (PendingAction & { platform?: string })[]
    },
    refetchInterval: 30000,
  })

  const filtered = pendingActions.filter(a => (a.platform || 'meta') === platform)

  if (filtered.length === 0) return null

  const handleApprove = async (id: string) => {
    setLoadingId(id)
    try {
      await adsAction(`/approve-action/${id}`, 'POST')
      queryClient.invalidateQueries({ queryKey: ['ads-pending-actions'] })
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['ads-agent-actions'] })
    } catch {}
    setLoadingId(null)
  }

  const handleReject = async (id: string) => {
    setLoadingId(id)
    try {
      await adsAction(`/reject-action/${id}`, 'POST')
      queryClient.invalidateQueries({ queryKey: ['ads-pending-actions'] })
      queryClient.invalidateQueries({ queryKey: ['ads-agent-actions'] })
    } catch {}
    setLoadingId(null)
  }

  const actionLabels: Record<string, { label: string; color: string; icon: any }> = {
    pause: { label: t('ads.action_pause'), color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300', icon: Pause },
    boost: { label: t('ads.action_boost'), color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', icon: ArrowUpRight },
    adjust_budget: { label: t('ads.action_adjust'), color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300', icon: DollarSign },
  }

  return (
    <div className="card p-5 border-2 border-amber-200 dark:border-amber-800/50">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('ads.pending_actions')} ({filtered.length})</h3>
          <p className="text-[11px] text-gray-500 dark:text-neutral-500">{t('ads.pending_actions_desc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((action) => {
          const cfg = actionLabels[action.action_type] || actionLabels.pause
          const Icon = cfg.icon
          const isLoading = loadingId === action.id
          const metrics = action.current_metrics || {}
          const proposed = action.proposed_changes || {}

          return (
            <div key={action.id} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[60%]">
                  {action.campaign_name}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${cfg.color}`}>
                  <Icon size={10} /> {cfg.label}
                </span>
              </div>

              {/* AI Reasoning */}
              <div className="p-2 mb-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-800/30">
                <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mb-0.5">{t('ads.ai_reasoning')}</p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">{action.ai_reasoning}</p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <div className="text-center p-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800">
                  <p className="text-[9px] text-gray-400 dark:text-neutral-500">CPA</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{metrics.cpa > 0 ? BRL(metrics.cpa) : '-'}</p>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800">
                  <p className="text-[9px] text-gray-400 dark:text-neutral-500">{t('ads.spend')}</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{BRL(metrics.spend || 0)}</p>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800">
                  <p className="text-[9px] text-gray-400 dark:text-neutral-500">CTR</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{fmtPct(metrics.ctr || 0)}</p>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-gray-50 dark:bg-neutral-800">
                  <p className="text-[9px] text-gray-400 dark:text-neutral-500">Conv.</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{metrics.conversions || 0}</p>
                </div>
              </div>

              {/* Proposed change for boost/adjust */}
              {(action.action_type === 'boost' || action.action_type === 'adjust_budget') && proposed.old_budget !== undefined && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-xs">
                  <span className="text-gray-500 dark:text-neutral-400">{BRL(proposed.old_budget as number)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">→</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">{BRL(proposed.new_budget as number)}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(action.id)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                  {t('ads.approve')}
                </button>
                <button
                  onClick={() => handleReject(action.id)}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
                  {t('ads.reject')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== CAMPAIGN TABLE ====================

function CampaignTable({ campaigns, sortField, sortDir, toggleSort, queryClient }: {
  campaigns: NormalizedCampaign[]
  sortField: SortField
  sortDir: SortDir
  toggleSort: (f: SortField) => void
  queryClient: any
}) {
  const { t } = useTranslation()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetValue, setBudgetValue] = useState('')

  const handleTogglePause = async (campaign: NormalizedCampaign) => {
    const isActive = campaign.status === 'ACTIVE' || campaign.status === 'ENABLED'
    const action = isActive ? 'pause' : 'resume'
    setActionLoading(campaign.campaign_id)
    try {
      if (campaign.platform === 'google') {
        await googleAdsAction(`${action}/${campaign.campaign_id}`)
        queryClient.invalidateQueries({ queryKey: ['google-ads-campaigns'] })
      } else {
        await adsAction(`/${action}/${campaign.campaign_id}`)
        queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
      }
      queryClient.invalidateQueries({ queryKey: ['ads-agent-actions'] })
    } catch {}
    setActionLoading(null)
  }

  const handleBudgetSave = async (campaign: NormalizedCampaign) => {
    const val = parseFloat(budgetValue)
    if (isNaN(val) || val <= 0) return
    setActionLoading(campaign.campaign_id)
    try {
      if (campaign.platform === 'google') {
        await googleAdsAction(`budget/${campaign.campaign_id}`, 'POST', { daily_budget: val })
        queryClient.invalidateQueries({ queryKey: ['google-ads-campaigns'] })
      } else {
        await adsAction(`/budget/${campaign.campaign_id}`, 'POST', { daily_budget: val })
        queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
      }
      queryClient.invalidateQueries({ queryKey: ['ads-agent-actions'] })
    } catch {}
    setActionLoading(null)
    setEditingBudget(null)
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone size={16} className="text-indigo-500" />
          {t('ads.campaigns_label')} ({campaigns.length})
        </h3>
      </div>
      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone size={48} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
          <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('ads.no_campaigns')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800">
                <SortHeader label={t('ads.campaign')} field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('ads.status')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('ads.budget')}</th>
                <SortHeader label={t('ads.spend')} field="spend" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label={t('ads.clicks')} field="clicks" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label={t('ads.ctr')} field="ctr" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label={t('ads.cpa')} field="cpa" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label={t('ads.conv')} field="conversions" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('ads.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const cfg = statusConfig[c.status] || { key: c.status, color: 'bg-gray-100 text-gray-500', icon: HelpCircle }
                const Icon = cfg.icon
                const isEditing = editingBudget === c.campaign_id
                const isLoadingThis = actionLoading === c.campaign_id
                const isActive = c.status === 'ACTIVE' || c.status === 'ENABLED'

                return (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 max-w-[200px]">{c.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          c.platform === 'google'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'
                            : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'
                        }`}>
                          {c.platform === 'google' ? 'G' : 'M'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${cfg.color}`}>
                        <Icon size={10} /> {t(cfg.key)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={budgetValue}
                            onChange={(e) => setBudgetValue(e.target.value)}
                            className="w-20 px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleBudgetSave(c); if (e.key === 'Escape') setEditingBudget(null) }}
                          />
                          <button onClick={() => handleBudgetSave(c)} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded"><Check size={12} /></button>
                          <button onClick={() => setEditingBudget(null)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded"><X size={12} /></button>
                        </div>
                      ) : (
                        <span
                          className="text-xs text-gray-600 dark:text-neutral-400 whitespace-nowrap cursor-pointer hover:text-blue-500 transition-colors"
                          onClick={() => { setEditingBudget(c.campaign_id); setBudgetValue(String(c.daily_budget || 0)) }}
                        >
                          {c.daily_budget ? `${BRL(c.daily_budget)}/dia` : c.lifetime_budget ? `${BRL(c.lifetime_budget)} total` : '-'}
                          <Pencil size={10} className="inline ml-1 opacity-50" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{BRL(c.spend)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{fmtNum(c.clicks)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-purple-600 dark:text-purple-400">{fmtPct(c.ctr)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 whitespace-nowrap">{c.cpa > 0 ? BRL(c.cpa) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{c.conversions > 0 ? c.conversions : '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTogglePause(c)}
                        disabled={isLoadingThis || c.status === 'DELETED' || c.status === 'ARCHIVED' || c.status === 'REMOVED'}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                          isActive
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                            : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        }`}
                        title={isActive ? t('ads.pause') : t('ads.resume')}
                      >
                        {isLoadingThis ? <Loader2 size={14} className="animate-spin" /> : isActive ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ==================== SORT HEADER ====================

function SortHeader({ label, field, current, dir, onSort }: {
  label: string; field: SortField; current: SortField; dir: SortDir; onSort: (f: SortField) => void
}) {
  const isActive = current === field
  return (
    <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3 cursor-pointer hover:text-gray-700 dark:hover:text-neutral-300 transition-colors select-none" onClick={() => onSort(field)}>
      <span className="flex items-center gap-1">
        {label}
        {isActive && <span className="text-blue-500">{dir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  )
}

// ==================== OPTIMIZER CONFIG ====================

function OptimizerConfig() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const { data: config } = useQuery({
    queryKey: ['ads-optimization-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_optimization_config' as any)
        .select('*')
        .single()
      return data as any
    },
  })

  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    if (config && !form) setForm({ ...config })
  }, [config])

  if (!form) return null

  const handleSave = async () => {
    setSaving(true)
    const { id, created_at, ...rest } = form
    await adsAction('/config', 'POST', rest)
    queryClient.invalidateQueries({ queryKey: ['ads-optimization-config'] })
    setSaving(false)
  }

  const Toggle = ({ field, label }: { field: string; label: string }) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-700 dark:text-neutral-300">{label}</span>
      <button
        onClick={() => setForm({ ...form, [field]: !form[field] })}
        className={`w-10 h-5 rounded-full transition-colors relative ${form[field] ? 'bg-blue-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form[field] ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )

  const NumInput = ({ field, label, prefix }: { field: string; label: string; prefix?: string }) => (
    <div>
      <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-1 mt-0.5">
        {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
        <input
          type="number"
          value={form[field] ?? ''}
          onChange={(e) => setForm({ ...form, [field]: parseFloat(e.target.value) || 0 })}
          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white"
        />
      </div>
    </div>
  )

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings size={16} className="text-blue-500" />
          {t('ads.optimizer_config')}
        </h3>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {t('ads.save')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">{t('ads.goals')}</p>
          <NumInput field="target_cpa" label={t('ads.target_cpa')} prefix="R$" />
          <NumInput field="min_roas" label={t('ads.min_roas')} prefix="x" />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">{t('ads.budget_label')}</p>
          <NumInput field="min_daily_budget" label={t('ads.min_budget')} prefix="R$" />
          <NumInput field="max_daily_budget" label={t('ads.max_budget')} prefix="R$" />
          <NumInput field="budget_increase_pct" label={t('ads.increase_pct')} prefix="%" />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">{t('ads.evaluation')}</p>
          <NumInput field="min_spend_to_evaluate" label={t('ads.min_spend_eval')} prefix="R$" />
          <NumInput field="min_impressions_to_evaluate" label={t('ads.min_impressions')} />
          <NumInput field="max_cpa_multiplier" label={t('ads.max_cpa_mult')} prefix="x" />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">{t('ads.automation')}</p>
          <Toggle field="optimizer_enabled" label={t('ads.optimizer_active')} />
          <Toggle field="approval_mode_enabled" label={t('ads.approval_mode')} />
          <Toggle field="auto_pause_enabled" label={t('ads.auto_pause_bad')} />
          <Toggle field="auto_boost_enabled" label={t('ads.auto_scale_good')} />
          <div className="pt-2">
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{t('ads.pixel_id')}</label>
            <input
              type="text"
              value={form.pixel_id || ''}
              onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
              placeholder={t('ads.pixel_placeholder')}
              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white mt-0.5"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== AI CHAT ====================

function AdsAgentChat() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const quickQuestions = [
    t('ads.pause_suggestion'),
    t('ads.roas_question'),
    t('ads.best_cpa'),
    t('ads.budget_strategy'),
  ]

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', text: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ads-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ question: text.trim(), history: updated.slice(-10) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'model', text: data.answer || data.error || t('ads.error_processing') }])
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: t('ads.error_connection') }])
    }
    setLoading(false)
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('ads.strategist')}</h2>
            <p className="text-xs text-gray-400 dark:text-neutral-500">{t('ads.strategist_desc')}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto min-h-[180px]">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Bot className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-neutral-500">{t('ads.ask_campaigns')}</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-neutral-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {messages.length === 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button key={q} onClick={() => sendMessage(q)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder={t('ads.ask_placeholder')}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== ACTION HISTORY ====================

function ActionHistory({ platform }: { platform: Platform }) {
  const { t } = useTranslation()
  const { data: allActions = [] } = useQuery({
    queryKey: ['ads-agent-actions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_agent_actions' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      return (data as any[]) || []
    },
  })

  const actions = allActions.filter((a: any) => (a.platform || 'meta') === platform).slice(0, 30)

  const actionIcons: Record<string, { icon: any; color: string }> = {
    pause_campaign: { icon: Pause, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
    resume_campaign: { icon: Play, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    update_budget: { icon: DollarSign, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
    create_campaign: { icon: Zap, color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
    optimizer_pause: { icon: Pause, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
    optimizer_boost: { icon: ArrowUpRight, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    optimizer_keep: { icon: Check, color: 'text-gray-400 bg-gray-50 dark:bg-neutral-800' },
    optimizer_skip: { icon: Clock, color: 'text-gray-400 bg-gray-50 dark:bg-neutral-800' },
    approve_pause: { icon: ThumbsUp, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    approve_boost: { icon: ThumbsUp, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    approve_adjust_budget: { icon: ThumbsUp, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    reject_pause: { icon: ThumbsDown, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
    reject_boost: { icon: ThumbsDown, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
    reject_adjust_budget: { icon: ThumbsDown, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          {t('ads.action_history')}
        </h3>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        {actions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
            <p className="text-xs text-gray-400 dark:text-neutral-500">{t('ads.no_actions')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-neutral-800/50">
            {actions.map((a: any) => {
              const cfg = actionIcons[a.action_type] || { icon: HelpCircle, color: 'text-gray-400 bg-gray-50' }
              const Icon = cfg.icon
              const details = a.details || {}
              return (
                <div key={a.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span className={`p-1.5 rounded-lg shrink-0 ${cfg.color}`}>
                      <Icon size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {a.campaign_name || a.action_type}
                      </p>
                      {details.reason && (
                        <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-0.5 line-clamp-2">{details.reason}</p>
                      )}
                      {details.old_budget !== undefined && (
                        <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-0.5">
                          {BRL(details.old_budget)} → {BRL(details.new_budget)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 dark:text-neutral-600">{formatTime(a.created_at)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          a.source === 'optimizer' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-500' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400'
                        }`}>
                          {a.source}
                        </span>
                        {a.platform && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            a.platform === 'google' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'
                          }`}>
                            {a.platform === 'google' ? 'G' : 'M'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== GOOGLE ADS SETUP ====================

function GoogleAdsSetup({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [form, setForm] = useState({
    customer_id: '',
    developer_token: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
  })

  // Load existing config
  const { data: config } = useQuery({
    queryKey: ['google-ads-config-full'],
    queryFn: async () => {
      const res = await googleAdsAction('config', 'GET')
      return res
    },
  })

  useEffect(() => {
    if (config?.customer_id) {
      setForm(prev => ({ ...prev, customer_id: config.customer_id || '' }))
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      await googleAdsAction('config', 'POST', form)
      queryClient.invalidateQueries({ queryKey: ['google-ads-config'] })
      queryClient.invalidateQueries({ queryKey: ['google-ads-config-full'] })
    } catch {}
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await googleAdsAction('test-connection', 'POST')
      if (res.success) {
        setTestResult({ success: true, message: `${t('ads.connection_success')} (${res.customer_name})` })
        queryClient.invalidateQueries({ queryKey: ['google-ads-config'] })
      } else {
        setTestResult({ success: false, message: res.error || t('ads.connection_failed') })
      }
    } catch {
      setTestResult({ success: false, message: t('ads.connection_failed') })
    }
    setTesting(false)
  }

  const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

  return (
    <div className="card p-5 border-2 border-amber-200 dark:border-amber-800/50">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Settings size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('ads.google_setup')}</h3>
          <p className="text-[11px] text-gray-500 dark:text-neutral-500">{t('ads.google_setup_desc')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            config?.is_connected
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500'
          }`}>
            {config?.is_connected ? t('ads.connected') : t('ads.not_connected')}
          </span>
        </div>
      </div>

      {/* Collapsible setup guide */}
      <div className="mb-4">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <BookOpen size={13} />
          {t('ads.setup_guide_toggle')}
          <ChevronDown size={13} className={`transition-transform ${showGuide ? 'rotate-180' : ''}`} />
        </button>
        {showGuide && (
          <div className="mt-3 p-4 rounded-lg bg-blue-50/70 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-800/40 space-y-3">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n}>
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  {t(`ads.setup_guide_step${n}_title` as 'ads.setup_guide_step1_title')}
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed mt-0.5">
                  {t(`ads.setup_guide_step${n}` as 'ads.setup_guide_step1')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{t('ads.customer_id')}</label>
          <input value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} placeholder={t('ads.customer_id_placeholder')} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{t('ads.developer_token')}</label>
          <input type="password" value={form.developer_token} onChange={e => setForm({ ...form, developer_token: e.target.value })} placeholder={t('ads.developer_token_placeholder')} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{t('ads.client_id')}</label>
          <input value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} placeholder={t('ads.client_id_placeholder')} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{t('ads.client_secret')}</label>
          <input type="password" value={form.client_secret} onChange={e => setForm({ ...form, client_secret: e.target.value })} placeholder={t('ads.client_secret_placeholder')} className={inputClass} />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{t('ads.refresh_token')}</label>
          <input type="password" value={form.refresh_token} onChange={e => setForm({ ...form, refresh_token: e.target.value })} placeholder={t('ads.refresh_token_placeholder')} className={inputClass} />
        </div>
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 p-2 mb-3 rounded-lg text-xs ${
          testResult.success
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
        }`}>
          {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {testResult.message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? t('ads.saving_config') : t('ads.save_config')}
        </button>
        <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50">
          {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {testing ? t('ads.testing_connection') : t('ads.test_connection')}
        </button>
      </div>
    </div>
  )
}

// ==================== AD CREATOR WIZARD ====================

interface IgPost {
  media_id: string
  media_type: string
  caption: string | null
  permalink: string | null
  timestamp: string
  like_count: number
  comments_count: number
  thumbnail_url: string | null
  reach: number
  impressions: number
}

interface AiStrategy {
  interests: string[]
  age_min: number
  age_max: number
  gender: 'all' | 'male' | 'female'
  daily_budget_brl: number
  cta_type: string
  campaign_name: string
  reasoning: string
}

const CTA_OPTIONS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'SUBSCRIBE', 'WATCH_MORE',
  'APPLY_NOW', 'BOOK_NOW', 'CONTACT_US', 'DOWNLOAD', 'ORDER_NOW',
]

function AdCreatorWizard({ onClose, queryClient }: { onClose: () => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const { t } = useTranslation()
  const [creatorMode, setCreatorMode] = useState<'instagram' | 'upload'>('instagram')
  const [step, setStep] = useState(1)
  const [posts, setPosts] = useState<IgPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [selectedPost, setSelectedPost] = useState<IgPost | null>(null)
  // Upload mode state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadBase64, setUploadBase64] = useState<string | null>(null)
  const [adCaption, setAdCaption] = useState('')
  const [adBrief, setAdBrief] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [autoMode, setAutoMode] = useState(true)
  const [destinationUrl, setDestinationUrl] = useState('')
  const [strategy, setStrategy] = useState<AiStrategy | null>(null)
  const [loadingStrategy, setLoadingStrategy] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [result, setResult] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Editable strategy fields
  const [editName, setEditName] = useState('')
  const [editBudget, setEditBudget] = useState(30)
  const [editAgeMin, setEditAgeMin] = useState(18)
  const [editAgeMax, setEditAgeMax] = useState(65)
  const [editGender, setEditGender] = useState<'all' | 'male' | 'female'>('all')
  const [editCta, setEditCta] = useState('LEARN_MORE')

  useEffect(() => {
    (async () => {
      try {
        const res = await adsAction('/fetch-ig-posts', 'POST')
        setPosts(res.posts || [])
      } catch {
        setError(t('ads.error_loading_posts'))
      }
      setLoadingPosts(false)
    })()
  }, [])

  const handleFileChange = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setUploadBase64(null) // reset — videos don't use base64
    if (file.type.startsWith('video/')) {
      // For video: just show a preview placeholder (can't ObjectURL easily without cleanup)
      setUploadPreview(null)
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        setUploadPreview(dataUrl)
        // Strip "data:image/...;base64," prefix — Meta wants raw base64
        setUploadBase64(dataUrl.split(',')[1])
      }
      reader.readAsDataURL(file)
    }
  }

  const isVideoFile = (file: File | null) => file?.type.startsWith('video/') ?? false

  const generateStrategy = async () => {
    setLoadingStrategy(true)
    setError(null)
    try {
      const caption = creatorMode === 'instagram'
        ? (selectedPost?.caption || '')
        : adCaption
      const res = await adsAction('/ai-strategy', 'POST', {
        post_caption: caption,
        ad_brief: adBrief,
        post_type: creatorMode === 'instagram' ? selectedPost?.media_type : 'IMAGE',
        post_engagement: creatorMode === 'instagram' ? {
          likes: selectedPost?.like_count || 0,
          comments: selectedPost?.comments_count || 0,
          reach: selectedPost?.reach || 0,
          impressions: selectedPost?.impressions || 0,
        } : { likes: 0, comments: 0, reach: 0, impressions: 0 },
      })
      if (res.error) {
        setError(res.error)
      } else if (res.strategy) {
        const s = res.strategy as AiStrategy
        setStrategy(s)
        setEditName(s.campaign_name || '')
        setEditBudget(s.daily_budget_brl || 30)
        setEditAgeMin(s.age_min || 18)
        setEditAgeMax(s.age_max || 65)
        setEditGender(s.gender || 'all')
        setEditCta(s.cta_type || 'LEARN_MORE')
        setStep(3)
        // Auto mode: launch immediately after strategy is ready
        if (autoMode) {
          await launchWithStrategy(s)
        }
      }
    } catch {
      setError(t('ads.error_connection'))
    }
    setLoadingStrategy(false)
  }

  // Separated so it can be called with a fresh strategy object (auto mode)
  const launchWithStrategy = async (s: AiStrategy) => {
    if (creatorMode === 'instagram' && !selectedPost) return
    if (creatorMode === 'upload' && !uploadFile) return
    setLaunching(true)
    setError(null)
    try {
      let videoUrl: string | null = null
      if (creatorMode === 'upload' && uploadFile && isVideoFile(uploadFile)) {
        const fileName = `${Date.now()}-${uploadFile.name}`
        const { error: storageError } = await supabase.storage
          .from('ad-uploads')
          .upload(fileName, uploadFile, { contentType: uploadFile.type, upsert: false })
        if (storageError) { setError(`Erro no upload do vídeo: ${storageError.message}`); setLaunching(false); return }
        const { data: urlData } = supabase.storage.from('ad-uploads').getPublicUrl(fileName)
        videoUrl = urlData.publicUrl
      }
      const interestRes = await adsAction('/search-interests', 'POST', { keywords: s.interests })
      const resolved = (interestRes.interests || []).slice(0, 15)
      const targeting: Record<string, unknown> = {
        geo_locations: { countries: ['BR'] },
        age_min: s.age_min || 18,
        age_max: s.age_max || 65,
        publisher_platforms: ['facebook', 'instagram'],
        instagram_positions: ['stream', 'story', 'reels'],
      }
      if (s.gender === 'male') targeting.genders = [1]
      else if (s.gender === 'female') targeting.genders = [2]
      if (resolved.length > 0) {
        targeting.flexible_spec = [{ interests: resolved.map((i: { id: string; name: string }) => ({ id: i.id, name: i.name })) }]
      }
      const isUpload = creatorMode === 'upload'
      const createRes = await adsAction(isUpload ? '/create-from-upload' : '/create-from-post', 'POST', {
        ...(isUpload
          ? videoUrl
            ? { video_url: videoUrl, image_name: uploadFile?.name || 'ad.mp4', ad_message: adCaption }
            : { image_base64: uploadBase64, image_name: uploadFile?.name || 'ad.jpg', ad_message: adCaption }
          : { ig_media_id: selectedPost!.media_id }),
        destination_url: destinationUrl,
        campaign_name: s.campaign_name,
        daily_budget: s.daily_budget_brl,
        targeting,
        cta_type: s.cta_type,
        source: 'ai_ad_creator_auto',
      })
      if (createRes.error) { setError(createRes.error) }
      else {
        setResult(createRes)
        setStep(4)
        queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
        queryClient.invalidateQueries({ queryKey: ['ads-agent-actions'] })
      }
    } catch { setError(t('ads.error_connection')) }
    setLaunching(false)
  }

  // Manual mode launch — uses editable state fields
  const launchCampaign = async () => {
    if (!strategy) return
    await launchWithStrategy({
      ...strategy,
      campaign_name: editName,
      daily_budget_brl: editBudget,
      age_min: editAgeMin,
      age_max: editAgeMax,
      gender: editGender,
      cta_type: editCta,
    })
  }

  const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors'
  const labelClass = 'block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1.5'

  const steps = [
    { n: 1, label: t('ads.step_select_post') },
    { n: 2, label: t('ads.step_destination') },
    { n: 3, label: t('ads.step_strategy') },
    { n: 4, label: t('ads.step_done') },
  ]

  return (
    <div className="card p-6 border-2 border-purple-200 dark:border-purple-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('ads.creator_title')}</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-500">{t('ads.creator_subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto mode toggle */}
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoMode
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400'
            }`}
            title={autoMode ? t('ads.auto_mode_on_hint') : t('ads.auto_mode_off_hint')}
          >
            <Zap size={12} className={autoMode ? 'fill-emerald-500 text-emerald-500' : ''} />
            {autoMode ? t('ads.auto_mode_on') : t('ads.auto_mode_off')}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= s.n
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600'
            }`}>
              {step > s.n ? <Check size={14} /> : s.n}
            </div>
            <span className={`text-[11px] font-medium hidden sm:block ${
              step >= s.n ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-neutral-600'
            }`}>{s.label}</span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded ${step > s.n ? 'bg-purple-600' : 'bg-gray-200 dark:bg-neutral-800'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/50">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* Step 1: Select creative source */}
      {step === 1 && (
        <div>
          {/* Mode toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-gray-100 dark:bg-neutral-800 rounded-xl w-fit">
            {(['instagram', 'upload'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setCreatorMode(m); setSelectedPost(null); setUploadFile(null); setUploadPreview(null); setUploadBase64(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  creatorMode === m
                    ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
                }`}
              >
                {m === 'instagram' ? <Image size={13} /> : <ArrowUpRight size={13} />}
                {t(m === 'instagram' ? 'ads.creator_mode_instagram' : 'ads.creator_mode_upload')}
              </button>
            ))}
          </div>

          {/* Instagram post grid */}
          {creatorMode === 'instagram' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 dark:text-neutral-400">{t('ads.select_post_hint')}</p>
                <button
                  onClick={async () => {
                    setLoadingPosts(true)
                    await fetch(`${SUPABASE_URL}/functions/v1/sync-instagram`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${ANON_KEY}` },
                    })
                    const res = await adsAction('/fetch-ig-posts', 'POST')
                    setPosts(res.posts || [])
                    setLoadingPosts(false)
                  }}
                  disabled={loadingPosts}
                  className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 disabled:opacity-50"
                >
                  <RefreshCw size={11} className={loadingPosts ? 'animate-spin' : ''} />
                  Atualizar posts
                </button>
              </div>
              {loadingPosts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-purple-500" size={28} />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center gap-3">
                  <p className="text-sm text-gray-400 dark:text-neutral-500">{t('ads.no_posts')}</p>
                  <button
                    onClick={async () => {
                      setLoadingPosts(true)
                      await fetch(`${SUPABASE_URL}/functions/v1/sync-instagram`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${ANON_KEY}` },
                      })
                      const res = await adsAction('/fetch-ig-posts', 'POST')
                      setPosts(res.posts || [])
                      setLoadingPosts(false)
                    }}
                    className="flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-600 underline"
                  >
                    <RefreshCw size={12} />
                    Sincronizar Instagram
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {posts.map(post => (
                    <button
                      key={post.media_id}
                      onClick={() => setSelectedPost(post)}
                      className={`text-left rounded-xl overflow-hidden border-2 transition-all hover:shadow-md ${
                        selectedPost?.media_id === post.media_id
                          ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-lg'
                          : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      {post.thumbnail_url ? (
                        <img src={post.thumbnail_url} alt="" className="w-full h-36 object-cover" />
                      ) : (
                        <div className="w-full h-36 bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                          <Image size={24} className="text-gray-300 dark:text-neutral-600" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-[11px] text-gray-700 dark:text-neutral-300 line-clamp-2 leading-tight">
                          {post.caption?.substring(0, 80) || '-'}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">{post.like_count} {t('ads.likes')}</span>
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">{post.comments_count} {t('ads.comments_count')}</span>
                        </div>
                        <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          post.media_type === 'VIDEO' || post.media_type === 'REELS'
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                            : post.media_type === 'CAROUSEL_ALBUM'
                              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400'
                        }`}>{post.media_type}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Upload from PC */}
          {creatorMode === 'upload' && (
            <div className="space-y-3">
              {/* Drop zone / file picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  uploadFile
                    ? 'border-purple-400 dark:border-purple-600 p-2'
                    : 'border-gray-300 dark:border-neutral-700 hover:border-purple-400 dark:hover:border-purple-600 py-10'
                }`}
              >
                {uploadFile ? (
                  <div className="relative w-full">
                    {uploadPreview ? (
                      <img src={uploadPreview} alt={t('ads.upload_preview')} className="w-full max-h-52 object-contain rounded-lg" />
                    ) : (
                      // Video — show filename + play icon
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-purple-50 dark:bg-purple-500/10">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
                          <Play size={18} className="text-purple-600 dark:text-purple-400 ml-0.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-purple-800 dark:text-purple-300 truncate">{uploadFile.name}</p>
                          <p className="text-xs text-purple-500 dark:text-purple-400">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB · {t('ads.upload_video_ready')}</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadPreview(null); setUploadBase64(null) }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                      <Image size={24} className="text-purple-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">{t('ads.upload_file')}</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{t('ads.upload_file_hint')}</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/avi,video/mov"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Optional caption */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1.5">{t('ads.ad_caption')}</label>
                <textarea
                  rows={2}
                  value={adCaption}
                  onChange={e => setAdCaption(e.target.value)}
                  placeholder={t('ads.ad_caption_placeholder')}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
                />
              </div>
            </div>
          )}

          {/* AI Brief — shared for both modes */}
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">{t('ads.brief_title')}</p>
            </div>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mb-2">{t('ads.brief_hint')}</p>
            <textarea
              rows={3}
              value={adBrief}
              onChange={e => setAdBrief(e.target.value)}
              placeholder={t('ads.brief_placeholder')}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-gray-900 dark:text-white placeholder-indigo-300 dark:placeholder-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
            />
            {adBrief.length > 0 && (
              <p className="text-[10px] text-indigo-400 dark:text-indigo-500 mt-1 text-right">{adBrief.length} {t('ads.brief_chars')}</p>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => setStep(2)}
              disabled={creatorMode === 'instagram' ? !selectedPost : !uploadFile}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('ads.step_destination')} <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Destination URL */}
      {step === 2 && (
        <div>
          {/* Creative preview */}
          {creatorMode === 'instagram' && selectedPost && (
            <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50">
              {selectedPost.thumbnail_url && (
                <img src={selectedPost.thumbnail_url} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
              )}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-neutral-300">{t('ads.selected_post')}</p>
                <p className="text-[11px] text-gray-500 dark:text-neutral-400 line-clamp-2 mt-0.5">{selectedPost.caption?.substring(0, 120)}</p>
              </div>
            </div>
          )}
          {creatorMode === 'upload' && uploadFile && (
            <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50">
              {uploadPreview ? (
                <img src={uploadPreview} alt={t('ads.upload_preview')} className="w-16 h-16 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Play size={20} className="text-purple-600 dark:text-purple-400 ml-0.5" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-neutral-300">{t('ads.creator_mode_upload')}</p>
                <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">{uploadFile.name}</p>
                {adCaption && <p className="text-[11px] text-gray-400 dark:text-neutral-500 line-clamp-2 mt-0.5">{adCaption.substring(0, 100)}</p>}
              </div>
            </div>
          )}
          {/* Brief preview */}
          {adBrief && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
              <Sparkles size={14} className="text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 line-clamp-3">{adBrief}</p>
            </div>
          )}
          <label className={labelClass}>{t('ads.enter_url')}</label>
          <div className="relative">
            <ExternalLink size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              value={destinationUrl}
              onChange={e => setDestinationUrl(e.target.value)}
              placeholder={t('ads.url_placeholder')}
              className={`${inputClass} pl-9`}
            />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-1.5">{t('ads.url_hint')}</p>
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300">
              <ChevronLeft size={15} /> {t('ads.step_select_post')}
            </button>
            <button
              onClick={generateStrategy}
              disabled={!destinationUrl.startsWith('http') || loadingStrategy || launching}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            >
              {loadingStrategy ? (
                <><Loader2 size={15} className="animate-spin" /> {t('ads.generating')}</>
              ) : launching ? (
                <><Loader2 size={15} className="animate-spin" /> {t('ads.launching')}</>
              ) : autoMode ? (
                <><Zap size={15} /> {t('ads.generate_and_launch')}</>
              ) : (
                <><Sparkles size={15} /> {t('ads.generate_strategy')}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: AI Strategy */}
      {step === 3 && strategy && (
        <div>
          {/* AI Reasoning — always shown */}
          <div className="p-3 mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-800/50">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">{t('ads.ai_reasoning')}</p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed">{strategy.reasoning}</p>
          </div>

          {/* Auto mode: show summary card + loading state, no editing */}
          {autoMode && (
            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: t('ads.campaign_name'), value: strategy.campaign_name },
                  { label: t('ads.daily_budget_label'), value: `R$ ${strategy.daily_budget_brl}` },
                  { label: t('ads.age_range'), value: `${strategy.age_min}–${strategy.age_max}` },
                  { label: t('ads.cta_label'), value: strategy.cta_type.replace(/_/g, ' ') },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded-lg bg-gray-50 dark:bg-neutral-800">
                    <p className="text-[10px] text-gray-400 dark:text-neutral-500">{item.label}</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-neutral-200 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {strategy.interests.map((kw, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">{kw}</span>
                ))}
              </div>
              {launching && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800/50">
                  <Loader2 size={15} className="animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('ads.auto_launching')}</p>
                </div>
              )}
            </div>
          )}

          {/* Manual mode: editable fields + launch button */}
          {!autoMode && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('ads.campaign_name')}</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('ads.daily_budget_label')}</label>
                  <input type="number" min={5} max={1000} value={editBudget} onChange={e => setEditBudget(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('ads.cta_label')}</label>
                  <select value={editCta} onChange={e => setEditCta(e.target.value)} className={inputClass}>
                    {CTA_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('ads.age_range')}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={13} max={65} value={editAgeMin} onChange={e => setEditAgeMin(Number(e.target.value))} className={`${inputClass} w-20`} />
                    <span className="text-xs text-gray-400">-</span>
                    <input type="number" min={13} max={65} value={editAgeMax} onChange={e => setEditAgeMax(Number(e.target.value))} className={`${inputClass} w-20`} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t('ads.gender_label')}</label>
                  <select value={editGender} onChange={e => setEditGender(e.target.value as 'all' | 'male' | 'female')} className={inputClass}>
                    <option value="all">{t('ads.gender_all')}</option>
                    <option value="male">{t('ads.gender_male')}</option>
                    <option value="female">{t('ads.gender_female')}</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className={labelClass}>{t('ads.interests_label')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {strategy.interests.map((kw, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">{kw}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300">
                  <ChevronLeft size={15} /> {t('ads.step_destination')}
                </button>
                <button
                  onClick={launchCampaign}
                  disabled={launching || !editName}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-40 shadow-lg"
                >
                  {launching ? (
                    <><Loader2 size={15} className="animate-spin" /> {t('ads.launching')}</>
                  ) : (
                    <><Rocket size={15} /> {t('ads.launch_campaign')}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && result && (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('ads.campaign_created')}</h4>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">{t('ads.campaign_paused_note')}</p>
          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto mb-4">
            {[
              ['Campaign', result.campaign_id],
              ['AdSet', result.adset_id],
              ['Creative', result.creative_id],
              ['Ad', result.ad_id],
            ].map(([label, id]) => (
              <div key={label} className="p-2 rounded-lg bg-gray-50 dark:bg-neutral-800">
                <p className="text-[10px] text-gray-400 dark:text-neutral-500">{label}</p>
                <p className="text-[11px] font-mono text-gray-700 dark:text-neutral-300 truncate">{id}</p>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {t('ads.close_creator') || 'Fechar'}
          </button>
        </div>
      )}
    </div>
  )
}
