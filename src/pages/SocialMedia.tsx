import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  BarChart,
  Bar,
} from 'recharts'
import {
  Youtube,
  Instagram,
  Users,
  Eye,
  Play,
  TrendingUp,
  Heart,
  MessageCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  Bookmark,
  Share2,
  Image,
} from 'lucide-react'

type Period = 7 | 30 | 90

const CHANNELS: Record<string, { name: string; color: string; short: string }> = {
  'UCJDekPfdOi9gDg-1dw_GDng': { name: '@abrahubstudio', color: '#CCFF00', short: 'Studio' },
  'UC0qgDFuPmvDRNz_tXO90fBg': { name: '@Abraham_tv', color: '#ef4444', short: 'Abraham TV' },
  'UCNHMvXsxOBlUUd3k-Zvtr1Q': { name: '@rodrigoabraham', color: '#3b82f6', short: 'Rodrigo Abraham' },
}

const CHANNEL_IDS = Object.keys(CHANNELS)

type SocialTab = 'youtube' | 'instagram'

export default function SocialMediaPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<SocialTab>('youtube')
  const [activeChannel, setActiveChannel] = useState(CHANNEL_IDS[0])

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {tab === 'youtube' ? t('social.title') : t('social.ig_title')}
          </h1>
          <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">
            {tab === 'youtube' ? t('social.subtitle') : t('social.ig_subtitle')}
          </p>
        </div>
        {/* Platform Toggle */}
        <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1">
          <button
            onClick={() => setTab('youtube')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'youtube'
                ? 'bg-red-500 text-white shadow-lg'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Youtube size={18} /> YouTube
          </button>
          <button
            onClick={() => setTab('instagram')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'instagram'
                ? 'text-white shadow-lg'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            style={tab === 'instagram' ? { background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' } : undefined}
          >
            <Instagram size={18} /> Instagram
          </button>
        </div>
      </div>

      {tab === 'youtube' ? (
        <>
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
        </>
      ) : (
        <InstagramTab />
      )}
    </div>
  )
}

function ChannelTab({ channelId }: { channelId: string }) {
  const [period, setPeriod] = useState<Period>(30)
  const { theme } = useTheme()
  const { t, lang } = useTranslation()
  const isDark = theme === 'dark'
  const channel = CHANNELS[channelId]
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'

  const fmt = (n: number) => n?.toLocaleString(locale) || '0'

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

  // Revenue for this channel
  const { data: revenueData = [] } = useQuery({
    queryKey: ['youtube-revenue-channel', channelId, sinceDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('youtube_revenue_daily')
        .select('*')
        .eq('channel_id', channelId)
        .gte('date', sinceDate)
        .order('date', { ascending: true })
      return data || []
    },
  })

  const BRL = (v: number) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL' })

  // KPI calculations
  const latest = dailyData[dailyData.length - 1]
  const prev = dailyData.length > 1 ? dailyData[dailyData.length - 2] : null
  const subscribers = latest?.subscribers || 0
  const subsDelta = latest && prev ? latest.subscribers - prev.subscribers : 0
  const totalViewsGained = dailyData.reduce((s, d) => s + (d.views_gained || 0), 0)
  const totalVideos = latest?.total_videos || 0
  const avgViewsDay = period > 0 ? Math.round(totalViewsGained / period) : 0
  const totalChannelRevenue = revenueData.reduce((s, d) => s + (Number(d.revenue) || 0), 0)

  // Subscriber growth chart — weekly aggregation (7-day intervals)
  const subsChart = useMemo(() => {
    if (dailyData.length < 2) return []
    const dailyDeltas = dailyData.slice(1).map((d, i) => ({
      date: d.date,
      novos: d.subscribers - dailyData[i].subscribers,
    }))
    const weeks: { date: string; novos: number }[] = []
    for (let i = 0; i < dailyDeltas.length; i += 7) {
      const chunk = dailyDeltas.slice(i, i + 7)
      const lastDay = chunk[chunk.length - 1].date
      const [, m, d] = lastDay.split('-')
      const novos = chunk.reduce((s, c) => s + c.novos, 0)
      weeks.push({ date: `${m}/${d}`, novos })
    }
    return weeks
  }, [dailyData])

  // Views chart — weekly aggregation (7-day intervals)
  const viewsChart = useMemo(() => {
    if (dailyData.length === 0) return []
    const weeks: { date: string; views: number }[] = []
    for (let i = 0; i < dailyData.length; i += 7) {
      const chunk = dailyData.slice(i, i + 7)
      const lastDay = chunk[chunk.length - 1].date
      const [, m, d] = lastDay.split('-')
      const views = chunk.reduce((s, c) => s + (c.views_gained || 0), 0)
      weeks.push({ date: `${m}/${d}`, views })
    }
    return weeks
  }, [dailyData])

  // Monthly growth table
  const MONTH_LABELS = lang === 'pt'
    ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const monthlyGrowth = useMemo(() => {
    if (allDailyData.length === 0) return []

    const byMonth: Record<string, { first: number; last: number; views: number; firstDate: string; lastDate: string }> = {}

    for (const row of allDailyData) {
      const month = row.date.slice(0, 7)
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
        const label = `${MONTH_LABELS[parseInt(m) - 1]} ${y}`
        return {
          month: label,
          start: data.first,
          end: data.last,
          growth,
          pct,
          views: data.views,
        }
      })
  }, [allDailyData, MONTH_LABELS])

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={Users}
          label={t('social.subscribers')}
          value={fmt(subscribers)}
          delta={subsDelta}
          accentColor={channel.color}
          locale={locale}
        />
        <KPICard
          icon={Eye}
          label={`${t('social.views')} (${period}d)`}
          value={fmt(totalViewsGained)}
          subtitle={`${fmt(avgViewsDay)}/${t('social.day')}`}
          accentColor={channel.color}
          locale={locale}
        />
        <KPICard
          icon={Play}
          label={t('social.total_videos')}
          value={fmt(totalVideos)}
          accentColor={channel.color}
          locale={locale}
        />
        <KPICard
          icon={TrendingUp}
          label={t('social.views_day')}
          value={fmt(avgViewsDay)}
          subtitle={t('social.avg_period')}
          accentColor={channel.color}
          locale={locale}
        />
        <KPICard
          icon={DollarSign}
          label={`${t('social.revenue')} (${period}d)`}
          value={BRL(totalChannelRevenue)}
          subtitle={totalChannelRevenue > 0 ? `${BRL(totalChannelRevenue / period)}/${t('social.day')}` : t('social.no_monetization')}
          accentColor={totalChannelRevenue > 0 ? '#10b981' : '#6b7280'}
          locale={locale}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscriber Growth */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('social.new_subs_day')}</h2>
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v >= 0 ? '+' : ''}${fmt(v)}`, t('social.new_subs')]} />
              <Area type="natural" dataKey="novos" stroke={channel.color} fill={`url(#grad-subs-${channelId})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Views */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('social.daily_views')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={viewsChart}>
              <defs>
                <linearGradient id={`grad-views-${channelId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={channel.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={channel.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), t('social.views')]} />
              <Area type="natural" dataKey="views" stroke={channel.color} fill={`url(#grad-views-${channelId})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Growth Table */}
      {monthlyGrowth.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-gray-400 dark:text-neutral-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('social.monthly_growth')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-neutral-500 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-3">{t('social.month')}</th>
                  <th className="text-right py-3 px-3">{t('social.start')}</th>
                  <th className="text-right py-3 px-3">{t('social.end')}</th>
                  <th className="text-right py-3 px-3">{t('social.growth')}</th>
                  <th className="text-right py-3 px-3">%</th>
                  <th className="text-right py-3 px-3">{t('social.views')}</th>
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
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('social.top_videos')} — {channel.short}</h2>
        {videos.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('social.no_videos')}</p>
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
                    {video.published_at ? new Date(video.published_at).toLocaleDateString(locale) : ''}
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

// ==================== INSTAGRAM TAB ====================

function InstagramTab() {
  const [period, setPeriod] = useState<Period>(30)
  const { theme } = useTheme()
  const { t, lang } = useTranslation()
  const isDark = theme === 'dark'
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'
  const fmt = (n: number) => n?.toLocaleString(locale) || '0'
  const IG_COLOR = '#E1306C'

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

  const sinceISO = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - period)
    return d.toISOString()
  }, [period])

  // Fetch latest daily Instagram metrics (last row)
  const { data: latestDaily } = useQuery({
    queryKey: ['instagram-daily-latest'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single()
      return data
    },
  })

  // Fetch ALL daily data for charts & monthly growth
  const { data: allDailyData = [] } = useQuery({
    queryKey: ['instagram-daily-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_daily')
        .select('*')
        .order('date', { ascending: true })
      return data || []
    },
  })

  // Fetch ALL posts (for charts based on post dates)
  const { data: allPosts = [] } = useQuery({
    queryKey: ['instagram-all-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_posts')
        .select('*')
        .order('timestamp', { ascending: true })
      return data || []
    },
  })

  // Filter posts by selected period
  const filteredPosts = useMemo(() => {
    return allPosts.filter(p => p.timestamp && p.timestamp >= sinceISO)
  }, [allPosts, sinceISO])

  // Top posts sorted by engagement (within period)
  const topPosts = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => {
        const ea = (a.like_count || 0) + (a.comments_count || 0) + (a.saves || 0) + (a.shares || 0)
        const eb = (b.like_count || 0) + (b.comments_count || 0) + (b.saves || 0) + (b.shares || 0)
        return eb - ea
      })
      .slice(0, 10)
  }, [filteredPosts])

  // KPIs from latest daily + filtered posts
  const followers = latestDaily?.followers || 0
  const totalReach = latestDaily?.reach || 0
  const totalImpressions = latestDaily?.impressions || 0
  const totalProfileViews = latestDaily?.profile_views || 0

  // Engagement rate from filtered posts
  const avgLikes = filteredPosts.length > 0 ? Math.round(filteredPosts.reduce((s, p) => s + (p.like_count || 0), 0) / filteredPosts.length) : 0
  const avgComments = filteredPosts.length > 0 ? Math.round(filteredPosts.reduce((s, p) => s + (p.comments_count || 0), 0) / filteredPosts.length) : 0
  const engagementRate = followers > 0 && filteredPosts.length > 0
    ? (((avgLikes + avgComments) / followers) * 100).toFixed(2)
    : '0.00'

  // Total metrics from filtered posts
  const totalPostReach = filteredPosts.reduce((s, p) => s + (p.reach || 0), 0)
  const totalPostSaves = filteredPosts.reduce((s, p) => s + (p.saves || 0), 0)
  const totalPostShares = filteredPosts.reduce((s, p) => s + (p.shares || 0), 0)
  const totalPostLikes = filteredPosts.reduce((s, p) => s + (p.like_count || 0), 0)
  const totalPostComments = filteredPosts.reduce((s, p) => s + (p.comments_count || 0), 0)

  // Post engagement chart — group posts by week based on their timestamp
  const postEngagementChart = useMemo(() => {
    if (filteredPosts.length === 0) return []
    const byWeek: Record<string, { likes: number; comments: number; saves: number; shares: number; reach: number; count: number }> = {}
    for (const post of filteredPosts) {
      if (!post.timestamp) continue
      const d = new Date(post.timestamp)
      // Get the Monday of this week
      const day = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((day + 6) % 7))
      const weekKey = monday.toISOString().split('T')[0]
      if (!byWeek[weekKey]) {
        byWeek[weekKey] = { likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, count: 0 }
      }
      byWeek[weekKey].likes += post.like_count || 0
      byWeek[weekKey].comments += post.comments_count || 0
      byWeek[weekKey].saves += post.saves || 0
      byWeek[weekKey].shares += post.shares || 0
      byWeek[weekKey].reach += post.reach || 0
      byWeek[weekKey].count++
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => {
        const [, m, d] = week.split('-')
        return {
          date: `${m}/${d}`,
          engagement: data.likes + data.comments + data.saves + data.shares,
          reach: data.reach,
          posts: data.count,
        }
      })
  }, [filteredPosts])

  // Reach per post chart
  const reachChart = useMemo(() => {
    if (filteredPosts.length === 0) return []
    // Show individual posts sorted by date
    return filteredPosts
      .filter(p => p.timestamp && p.reach > 0)
      .map(p => {
        const d = new Date(p.timestamp)
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
        return {
          date: label,
          reach: p.reach || 0,
          engagement: (p.like_count || 0) + (p.comments_count || 0),
        }
      })
  }, [filteredPosts])

  // Daily data chart (if we have daily metrics)
  const dailyChart = useMemo(() => {
    if (allDailyData.length === 0) return []
    return allDailyData.map(d => {
      const [, m, day] = d.date.split('-')
      return {
        date: `${m}/${day}`,
        reach: d.reach || 0,
        impressions: d.impressions || 0,
        profile_views: d.profile_views || 0,
      }
    })
  }, [allDailyData])

  // Monthly growth table from posts
  const MONTH_LABELS = lang === 'pt'
    ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const monthlyStats = useMemo(() => {
    if (filteredPosts.length === 0) return []
    const byMonth: Record<string, { likes: number; comments: number; saves: number; shares: number; reach: number; posts: number }> = {}
    for (const post of filteredPosts) {
      if (!post.timestamp) continue
      const month = post.timestamp.slice(0, 7)
      if (!byMonth[month]) byMonth[month] = { likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, posts: 0 }
      byMonth[month].likes += post.like_count || 0
      byMonth[month].comments += post.comments_count || 0
      byMonth[month].saves += post.saves || 0
      byMonth[month].shares += post.shares || 0
      byMonth[month].reach += post.reach || 0
      byMonth[month].posts++
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => {
        const [y, m] = month.split('-')
        const label = `${MONTH_LABELS[parseInt(m) - 1]} ${y}`
        const totalEng = data.likes + data.comments + data.saves + data.shares
        const avgEng = data.posts > 0 ? Math.round(totalEng / data.posts) : 0
        return { month: label, posts: data.posts, reach: data.reach, likes: data.likes, comments: data.comments, saves: data.saves, shares: data.shares, avgEng }
      })
  }, [filteredPosts, MONTH_LABELS])

  if (filteredPosts.length === 0 && !latestDaily) {
    return (
      <div className="text-center py-16">
        <Instagram size={48} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
        <p className="text-gray-500 dark:text-neutral-500">{t('social.ig_no_data')}</p>
      </div>
    )
  }

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard icon={Users} label={t('social.ig_followers')} value={fmt(followers)} accentColor={IG_COLOR} locale={locale} />
        <KPICard icon={Eye} label={`${t('social.ig_reach')} (${period}d)`} value={fmt(totalReach > 0 ? totalReach : totalPostReach)} subtitle={`${filteredPosts.length} posts`} accentColor={IG_COLOR} locale={locale} />
        <KPICard icon={TrendingUp} label={`${t('social.ig_impressions')} (${period}d)`} value={fmt(totalImpressions > 0 ? totalImpressions : totalPostLikes + totalPostComments)} accentColor={IG_COLOR} locale={locale} />
        <KPICard icon={Eye} label={`${t('social.ig_profile_views')} (${period}d)`} value={fmt(totalProfileViews)} accentColor="#8b5cf6" locale={locale} />
        <KPICard icon={Heart} label={t('social.ig_engagement_rate')} value={`${engagementRate}%`} subtitle={`${fmt(avgLikes)} ${t('social.ig_likes')} / ${fmt(avgComments)} ${t('social.ig_comments')}`} accentColor={Number(engagementRate) >= 3 ? '#10b981' : '#f59e0b'} locale={locale} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(filteredPosts.length)}</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Posts ({period}d)</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalPostReach)}</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{t('social.ig_reach')} Total</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalPostSaves)}</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{t('social.ig_saves')} Total</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalPostShares)}</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{t('social.ig_shares')} Total</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement per Week */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('social.ig_engagement')} / {t('social.week')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={postEngagementChart}>
              <defs>
                <linearGradient id="grad-ig-eng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={IG_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={IG_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmt(v), name === 'engagement' ? t('social.ig_engagement') : t('social.ig_reach')]} />
              <Area type="natural" dataKey="engagement" stroke={IG_COLOR} fill="url(#grad-ig-eng)" strokeWidth={2.5} dot={{ r: 3, fill: IG_COLOR }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Reach per Post */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('social.ig_reach')} / Post</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={reachChart}>
              <defs>
                <linearGradient id="grad-ig-reach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmt(v), name === 'reach' ? t('social.ig_reach') : t('social.ig_engagement')]} />
              <Area type="natural" dataKey="reach" stroke="#8b5cf6" fill="url(#grad-ig-reach)" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Account insights chart (daily data if available) */}
      {dailyChart.length > 1 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('social.ig_daily_reach')} & {t('social.ig_profile_views')}</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyChart}>
              <defs>
                <linearGradient id="grad-ig-dreac" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={IG_COLOR} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={IG_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-ig-pv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="natural" dataKey="reach" stroke={IG_COLOR} fill="url(#grad-ig-dreac)" strokeWidth={2.5} name={t('social.ig_reach')} dot={{ r: 3, fill: IG_COLOR }} />
              <Area type="natural" dataKey="profile_views" stroke="#8b5cf6" fill="url(#grad-ig-pv)" strokeWidth={2.5} name={t('social.ig_profile_views')} dot={{ r: 3, fill: '#8b5cf6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly Stats Table */}
      {monthlyStats.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-gray-400 dark:text-neutral-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('social.ig_monthly_growth')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-neutral-500 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-3">{t('social.month')}</th>
                  <th className="text-right py-3 px-3">Posts</th>
                  <th className="text-right py-3 px-3">{t('social.ig_reach')}</th>
                  <th className="text-right py-3 px-3">{t('social.ig_likes')}</th>
                  <th className="text-right py-3 px-3">{t('social.ig_comments')}</th>
                  <th className="text-right py-3 px-3">{t('social.ig_saves')}</th>
                  <th className="text-right py-3 px-3">{t('social.ig_shares')}</th>
                  <th className="text-right py-3 px-3">Eng/Post</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((row) => (
                  <tr key={row.month} className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{row.month}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{row.posts}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.reach)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.likes)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.comments)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.saves)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-neutral-400">{fmt(row.shares)}</td>
                    <td className="py-3 px-3 text-right font-medium" style={{ color: IG_COLOR }}>{fmt(row.avgEng)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Posts */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('social.ig_top_posts')}</h2>
        {topPosts.length === 0 ? (
          <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('social.ig_no_data')}</p>
        ) : (
          <div className="space-y-2">
            {topPosts.map((post, i) => (
              <a key={post.media_id} href={post.permalink || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <span className="text-gray-400 dark:text-neutral-600 font-bold w-6 text-center text-sm">{i + 1}</span>
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                    <Image size={20} className="text-gray-300 dark:text-neutral-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                    {post.caption ? post.caption.slice(0, 80) + (post.caption.length > 80 ? '...' : '') : '—'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">
                    {post.media_type} · {post.timestamp ? new Date(post.timestamp).toLocaleDateString(locale) : ''}
                    {post.reach > 0 && ` · Reach: ${fmt(post.reach)}`}
                  </p>
                </div>
                <div className="flex gap-4 text-sm text-gray-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1" title={t('social.ig_likes')}><Heart size={14} /> {fmt(post.like_count)}</span>
                  <span className="flex items-center gap-1" title={t('social.ig_comments')}><MessageCircle size={14} /> {fmt(post.comments_count)}</span>
                  <span className="flex items-center gap-1" title={t('social.ig_saves')}><Bookmark size={14} /> {fmt(post.saves || 0)}</span>
                  <span className="flex items-center gap-1" title={t('social.ig_shares')}><Share2 size={14} /> {fmt(post.shares || 0)}</span>
                </div>
              </a>
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
  locale,
}: {
  icon: any
  label: string
  value: string
  delta?: number
  subtitle?: string
  accentColor: string
  locale: string
}) {
  const fmt = (n: number) => n?.toLocaleString(locale) || '0'
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
