import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Youtube,
  Users,
  Eye,
  Play,
  TrendingUp,
  Heart,
  MessageCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react'

type Period = 7 | 30 | 90

const CHANNELS: Record<string, { name: string; color: string; short: string }> = {
  'UC0qgDFuPmvDRNz_tXO90fBg': { name: '@Abraham_tv', color: '#ef4444', short: 'Abraham TV' },
  'UCNHMvXsxOBlUUd3k-Zvtr1Q': { name: '@rodrigoabraham', color: '#3b82f6', short: 'Rodrigo Abraham' },
  'UCJDekPfdOi9gDg-1dw_GDng': { name: '@abrahubstudio', color: '#f59e0b', short: 'Studio' },
}

const CHANNEL_IDS = Object.keys(CHANNELS)

const fmt = (n: number) => n?.toLocaleString('pt-BR') || '0'

export default function YouTubePage() {
  const [activeChannel, setActiveChannel] = useState(CHANNEL_IDS[0])

  return (
    <div className="space-y-6 pb-8">
      <div>
        <div className="flex items-center gap-3">
          <Youtube size={28} className="text-red-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">YouTube</h1>
        </div>
        <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">Metricas dos 3 canais</p>
      </div>

      {/* Channel Tabs */}
      <div className="flex gap-2">
        {CHANNEL_IDS.map((id) => {
          const ch = CHANNELS[id]
          return (
            <button
              key={id}
              onClick={() => setActiveChannel(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                activeChannel === id
                  ? 'text-white shadow-lg'
                  : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-neutral-700'
              }`}
              style={activeChannel === id ? { backgroundColor: ch.color, boxShadow: `0 4px 14px ${ch.color}33` } : undefined}
            >
              <Youtube size={18} /> {ch.short}
            </button>
          )
        })}
      </div>

      <ChannelTab channelId={activeChannel} />
    </div>
  )
}

function ChannelTab({ channelId }: { channelId: string }) {
  const [period, setPeriod] = useState<Period>(30)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const channel = CHANNELS[channelId]

  const tooltipStyle = {
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    border: '1px solid ' + (isDark ? '#3f3f46' : '#e5e7eb'),
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  }

  const sinceDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - period)
    return d.toISOString().split('T')[0]
  }, [period])

  // Fetch all data for this channel
  const { data: dailyData = [] } = useQuery({
    queryKey: ['youtube-daily-channel', channelId, sinceDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('youtube_daily')
        .select('*')
        .eq('channel_id', channelId)
        .gte('date', sinceDate)
        .order('date', { ascending: true })
      return data || []
    },
  })

  // Fetch ALL daily data for monthly growth (last 365 days)
  const { data: allDailyData = [] } = useQuery({
    queryKey: ['youtube-daily-all', channelId],
    queryFn: async () => {
      const yearAgo = new Date()
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      const { data } = await supabase
        .from('youtube_daily')
        .select('date, subscribers, views_gained')
        .eq('channel_id', channelId)
        .gte('date', yearAgo.toISOString().split('T')[0])
        .order('date', { ascending: true })
      return data || []
    },
  })

  // Top videos for this channel
  const { data: videos = [] } = useQuery({
    queryKey: ['youtube-videos-channel', channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('channel_id', channelId)
        .order('view_count', { ascending: false })
        .limit(10)
      return data || []
    },
  })

  // KPI calculations
  const latest = dailyData[dailyData.length - 1]
  const prev = dailyData.length > 1 ? dailyData[dailyData.length - 2] : null
  const subscribers = latest?.subscribers || 0
  const subsDelta = latest && prev ? latest.subscribers - prev.subscribers : 0
  const totalViewsGained = dailyData.reduce((s, d) => s + (d.views_gained || 0), 0)
  const totalVideos = latest?.total_videos || 0
  const avgViewsDay = period > 0 ? Math.round(totalViewsGained / period) : 0

  // Subscriber growth chart
  const subsChart = dailyData.map((d) => ({
    date: d.date.slice(5),
    inscritos: d.subscribers,
  }))

  // Views bar chart
  const viewsChart = dailyData.map((d) => ({
    date: d.date.slice(5),
    views: d.views_gained || 0,
  }))

  // Monthly growth table
  const monthlyGrowth = useMemo(() => {
    if (allDailyData.length === 0) return []

    const byMonth: Record<string, { first: number; last: number; views: number; firstDate: string; lastDate: string }> = {}

    for (const row of allDailyData) {
      const month = row.date.slice(0, 7) // "2026-02"
      if (!byMonth[month]) {
        byMonth[month] = { first: row.subscribers, last: row.subscribers, views: 0, firstDate: row.date, lastDate: row.date }
      }
      if (row.date < byMonth[month].firstDate) {
        byMonth[month].first = row.subscribers
        byMonth[month].firstDate = row.date
      }
      if (row.date > byMonth[month].lastDate) {
        byMonth[month].last = row.subscribers
        byMonth[month].lastDate = row.date
      }
      byMonth[month].views += row.views_gained || 0
    }

    return Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => {
        const growth = data.last - data.first
        const pct = data.first > 0 ? ((growth / data.first) * 100).toFixed(2) : '0.00'
        const [y, m] = month.split('-')
        const label = `${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(m) - 1]} ${y}`
        return {
          month: label,
          start: data.first,
          end: data.last,
          growth,
          pct,
          views: data.views,
        }
      })
  }, [allDailyData])

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-neutral-950 shadow-lg'
                  : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Inscritos"
          value={fmt(subscribers)}
          delta={subsDelta}
          accentColor={channel.color}
        />
        <KPICard
          icon={Eye}
          label={`Views (${period}d)`}
          value={fmt(totalViewsGained)}
          subtitle={`${fmt(avgViewsDay)}/dia`}
          accentColor={channel.color}
        />
        <KPICard
          icon={Play}
          label="Total Videos"
          value={fmt(totalVideos)}
          accentColor={channel.color}
        />
        <KPICard
          icon={TrendingUp}
          label="Views/dia"
          value={fmt(avgViewsDay)}
          subtitle={`Media no periodo`}
          accentColor={channel.color}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscriber Growth */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Crescimento de Inscritos</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={subsChart}>
              <defs>
                <linearGradient id={`grad-subs-${channelId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={channel.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={channel.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), 'Inscritos']} />
              <Area type="monotone" dataKey="inscritos" stroke={channel.color} fill={`url(#grad-subs-${channelId})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Views */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Views Diarias</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={viewsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), 'Views']} />
              <Bar dataKey="views" fill={channel.color} radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Growth Table */}
      {monthlyGrowth.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-gray-400 dark:text-neutral-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Crescimento Mensal</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-neutral-500 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-3">Mes</th>
                  <th className="text-right py-3 px-3">Inicio</th>
                  <th className="text-right py-3 px-3">Fim</th>
                  <th className="text-right py-3 px-3">Crescimento</th>
                  <th className="text-right py-3 px-3">%</th>
                  <th className="text-right py-3 px-3">Views</th>
                </tr>
              </thead>
              <tbody>
                {monthlyGrowth.map((row) => (
                  <tr key={row.month} className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{row.month}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.start)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.end)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`flex items-center justify-end gap-0.5 font-medium ${row.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {row.growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {row.growth >= 0 ? '+' : ''}{fmt(row.growth)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-medium ${Number(row.pct) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {Number(row.pct) >= 0 ? '+' : ''}{row.pct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Videos */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Top Videos — {channel.short}</h2>
        {videos.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-500 text-sm">Nenhum video sincronizado ainda.</p>
        ) : (
          <div className="space-y-2">
            {videos.map((video, i) => (
              <div key={video.video_id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <span className="text-gray-400 dark:text-neutral-600 font-bold w-6 text-center text-sm">{i + 1}</span>
                {video.thumbnail_url && (
                  <img src={video.thumbnail_url} alt="" className="w-28 h-16 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{video.title}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">
                    {video.published_at ? new Date(video.published_at).toLocaleDateString('pt-BR') : ''}
                  </p>
                </div>
                <div className="flex gap-5 text-sm text-gray-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1.5"><Eye size={14} /> {fmt(video.view_count)}</span>
                  <span className="flex items-center gap-1.5"><Heart size={14} /> {fmt(video.like_count)}</span>
                  <span className="flex items-center gap-1.5"><MessageCircle size={14} /> {fmt(video.comment_count)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== SHARED COMPONENTS ====================

function KPICard({
  icon: Icon,
  label,
  value,
  delta,
  subtitle,
  accentColor,
}: {
  icon: any
  label: string
  value: string
  delta?: number
  subtitle?: string
  accentColor: string
}) {
  return (
    <div className="card p-5 hover:border-gray-200 dark:hover:border-neutral-700/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="p-2 rounded-xl" style={{ backgroundColor: accentColor + '15' }}>
          <Icon size={18} style={{ color: accentColor }} />
        </span>
        {delta !== undefined && delta !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {delta > 0 ? '+' : ''}{fmt(delta)}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color: accentColor }}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{subtitle}</p>}
    </div>
  )
}
