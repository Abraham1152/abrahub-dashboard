import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useState } from 'react'
import {
  Megaphone,
  Wallet,
  Eye,
  MousePointerClick,
  TrendingUp,
  RefreshCw,
  Target,
  Pause,
  Trash2,
  Archive,
  HelpCircle,
  BarChart3,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
}

type SortField = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'name'
type SortDir = 'asc' | 'desc'

// ==================== HELPERS ====================

const fmtCurrency = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

const fmtPct = (n: number) => `${n.toFixed(2)}%`

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  ACTIVE: { label: 'Ativa', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', icon: Target },
  PAUSED: { label: 'Pausada', color: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300', icon: Pause },
  DELETED: { label: 'Excluida', color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300', icon: Trash2 },
  ARCHIVED: { label: 'Arquivada', color: 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-400', icon: Archive },
}

const CHART_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6']

// ==================== MAIN PAGE ====================

export default function AdsManagerPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [sortField, setSortField] = useState<SortField>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['ads-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_campaigns')
        .select('*')
        .order('spend', { ascending: false })
      return (data || []) as AdsCampaign[]
    },
  })

  // Sync ads
  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch(
        `https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-ads`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
    } catch {}
    setSyncing(false)
  }

  // Sort campaigns
  const sorted = [...campaigns].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'name') return dir * a.name.localeCompare(b.name)
    return dir * ((a[sortField] as number) - (b[sortField] as number))
  })

  // KPI totals
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length

  // Chart data - top 8 campaigns by spend
  const chartData = campaigns
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8)
    .map(c => ({
      name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
      spend: c.spend,
    }))

  // Status breakdown
  const statusBreakdown = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Megaphone size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ads Manager</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm">
              {campaigns.length} campanhas · {activeCampaigns} ativas
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          Sincronizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Wallet}
          label="Gasto Total"
          value={fmtCurrency(totalSpend)}
          iconBg="bg-red-50 dark:bg-red-500/10"
          iconColor="text-red-600 dark:text-red-400"
          subtitle="Ultimos 30 dias"
        />
        <KPICard
          icon={Eye}
          label="Impressoes"
          value={fmtNum(totalImpressions)}
          iconBg="bg-blue-50 dark:bg-blue-500/10"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <KPICard
          icon={MousePointerClick}
          label="Cliques"
          value={fmtNum(totalClicks)}
          iconBg="bg-emerald-50 dark:bg-emerald-500/10"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={TrendingUp}
          label="CTR Medio"
          value={fmtPct(avgCtr)}
          iconBg="bg-purple-50 dark:bg-purple-500/10"
          iconColor="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Chart + Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            Gasto por Campanha
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$${v}`}
                  tick={{ fill: isDark ? '#737373' : '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fill: isDark ? '#d4d4d4' : '#374151', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [fmtCurrency(value), 'Gasto']}
                  contentStyle={{
                    background: isDark ? '#262626' : '#fff',
                    border: `1px solid ${isDark ? '#404040' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 dark:text-neutral-600 text-sm">
              Nenhuma campanha com gasto
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Status das Campanhas
          </h3>
          <div className="space-y-3">
            {Object.entries(statusBreakdown).map(([status, count]) => {
              const cfg = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-500', icon: HelpCircle }
              const Icon = cfg.icon
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color}`}>
                      <Icon size={12} />
                      {cfg.label}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              )
            })}
            {Object.keys(statusBreakdown).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-neutral-600">Nenhuma campanha</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <p className="text-xs text-gray-500 dark:text-neutral-500">Total</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{campaigns.length}</p>
            <p className="text-xs text-gray-400 dark:text-neutral-600">campanhas</p>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone size={16} className="text-indigo-500" />
            Todas as Campanhas
          </h3>
        </div>
        {campaigns.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone size={48} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
            <p className="text-gray-500 dark:text-neutral-500 text-sm">Nenhuma campanha sincronizada.</p>
            <p className="text-gray-400 dark:text-neutral-600 text-xs mt-1">Clique em "Sincronizar" acima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800">
                  <SortHeader label="Campanha" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">Objetivo</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">Orcamento</th>
                  <SortHeader label="Gasto" field="spend" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Impressoes" field="impressions" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Cliques" field="clicks" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="CTR" field="ctr" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">CPC</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">Alcance</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => {
                  const cfg = statusConfig[c.status] || { label: c.status, color: 'bg-gray-100 text-gray-500', icon: HelpCircle }
                  const Icon = cfg.icon
                  const budget = c.daily_budget
                    ? `${fmtCurrency(c.daily_budget)}/dia`
                    : c.lifetime_budget
                      ? `${fmtCurrency(c.lifetime_budget)} total`
                      : '-'

                  return (
                    <tr key={c.id} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 max-w-[200px]">
                          {c.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${cfg.color}`}>
                          <Icon size={10} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 dark:text-neutral-400">
                          {c.objective?.replace(/_/g, ' ').toLowerCase() || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 dark:text-neutral-400 whitespace-nowrap">
                          {budget}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {fmtCurrency(c.spend)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{fmtNum(c.impressions)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{fmtNum(c.clicks)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{fmtPct(c.ctr)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                        {c.cpc > 0 ? fmtCurrency(c.cpc) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{fmtNum(c.reach)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== KPI CARD ====================

function KPICard({ icon: Icon, label, value, iconBg, iconColor, subtitle }: {
  icon: any
  label: string
  value: string
  iconBg: string
  iconColor: string
  subtitle?: string
}) {
  return (
    <div className="card p-5 hover:border-gray-200 dark:hover:border-neutral-700/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ==================== SORT HEADER ====================

function SortHeader({ label, field, current, dir, onSort }: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onSort: (field: SortField) => void
}) {
  const isActive = current === field
  return (
    <th
      className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3 cursor-pointer hover:text-gray-700 dark:hover:text-neutral-300 transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-blue-500">{dir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )
}
