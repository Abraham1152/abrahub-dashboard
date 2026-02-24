import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useState, useRef, useEffect } from 'react'
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
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Check,
  Loader2,
  Upload,
  FileText,
  Trash2,
  BookOpen,
} from 'lucide-react'

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type DateRange = '7d' | '30d' | '90d' | '365d' | 'ytd'
const DATE_RANGES: DateRange[] = ['7d', '30d', '90d', '365d', 'ytd']

function getDateRange(range: DateRange): { startDate: string; endDate: string; days: number } {
  const now = new Date()
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let start: Date
  switch (range) {
    case '7d': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); break
    case '30d': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); break
    case '90d': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89); break
    case '365d': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 364); break
    case 'ytd': start = new Date(now.getFullYear(), 0, 1); break
  }
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const diffMs = now.getTime() - start.getTime()
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1)
  return { startDate, endDate, days }
}

function getMonthsInRange(startDate: string, endDate: string): string[] {
  const months: string[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  let current = new Date(start.getFullYear(), start.getMonth(), 1)
  while (current <= end) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`)
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }
  return months
}

const SYNC_FUNCTIONS = [
  'sync-stripe',
  'sync-kiwify',
  'sync-youtube',
  'sync-instagram',
  'sync-ads',
  'sync-adsense',
]

const SUPABASE_URL = 'https://jdodenbjohnqvhvldfqu.supabase.co'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec'

export default function HomePage() {
  const { theme } = useTheme()
  const { t, lang } = useTranslation()
  const queryClient = useQueryClient()
  const isDark = theme === 'dark'
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [syncProgress, setSyncProgress] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange>('7d')

  const MONTH_NAMES = lang === 'pt' ? MONTH_NAMES_PT : MONTH_NAMES_EN
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'

  const { startDate, endDate, days } = getDateRange(dateRange)
  const monthsInRange = getMonthsInRange(startDate, endDate)

  const rangeLabels: Record<DateRange, string> = {
    '7d': t('home.last_7d'),
    '30d': t('home.last_30d'),
    '90d': t('home.last_90d'),
    '365d': t('home.last_365d'),
    'ytd': t('home.ytd'),
  }

  // Sync with timeout per function (30s max) and sequential batches of 2
  const syncAll = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncStatus('syncing')
    setSyncProgress(0)
    let completed = 0
    let errors = 0

    const fetchWithTimeout = (fn: string) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      return fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))
    }

    // Run in batches of 2 to avoid overloading
    for (let i = 0; i < SYNC_FUNCTIONS.length; i += 2) {
      const batch = SYNC_FUNCTIONS.slice(i, i + 2)
      await Promise.all(batch.map(async (fn) => {
        try {
          await fetchWithTimeout(fn)
        } catch {
          errors++
        }
        completed++
        setSyncProgress(Math.round((completed / SYNC_FUNCTIONS.length) * 100))
      }))
    }

    // Refresh all data after sync
    queryClient.invalidateQueries()
    setSyncing(false)
    setSyncStatus(errors > 0 ? 'error' : 'done')
    setTimeout(() => setSyncStatus('idle'), 3000)
  }

  // Auto-sync on mount + every 10 minutes (realtime handles instant updates)
  useEffect(() => {
    syncAll()
    const interval = setInterval(syncAll, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase Realtime: auto-refresh when revenue_transactions or financial_daily change
  useEffect(() => {
    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue_transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-revenue-tx'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_daily' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-financial-daily'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads_campaigns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  // Revenue transactions for selected period
  const { data: periodTransactions = [] } = useQuery({
    queryKey: ['home-revenue-tx', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('revenue_transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
      return data || []
    },
  })

  // financial_daily for chart + AdSense
  const { data: financialData = [] } = useQuery({
    queryKey: ['home-financial-daily', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_daily')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      return data || []
    },
  })


  // Monthly expenses for all months in range
  const { data: periodExpenses = [] } = useQuery({
    queryKey: ['home-expenses', monthsInRange.join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_expenses')
        .select('*')
        .in('month', monthsInRange)
      return data || []
    },
  })

  // Revenue calculations
  const paidTx = periodTransactions.filter((tx: any) => tx.status === 'paid' || tx.status === 'approved' || tx.status === 'completed')
  const refundTx = periodTransactions.filter((tx: any) => tx.status === 'refunded' || tx.status === 'chargedback')

  const totalStripe = paidTx.filter((tx: any) => tx.source === 'stripe').reduce((s: number, tx: any) => s + Math.abs(tx.amount), 0)
  const totalKiwify = paidTx.filter((tx: any) => tx.source === 'kiwify').reduce((s: number, tx: any) => s + Math.abs(tx.amount), 0)
  const totalAdsense = financialData.reduce((sum: number, d: any) => sum + (d.revenue_adsense || 0), 0)
  const totalRefunds = refundTx.reduce((s: number, tx: any) => s + Math.abs(tx.amount), 0)
  // grossRevenue includes refunded sales (add them back since upsert removes paid records)
  const grossRevenue = totalStripe + totalKiwify + totalAdsense + totalRefunds
  // netRevenue = gross minus refunds (= just the paid/approved transactions)
  const netRevenue = grossRevenue - totalRefunds
  const rawExpenses = periodExpenses.reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  // Prorate expenses: calculate total calendar days in the months, then scale to actual period
  const totalDaysInMonths = monthsInRange.reduce((sum, m) => {
    const [y, mo] = m.split('-').map(Number)
    return sum + new Date(y, mo, 0).getDate()
  }, 0)
  const totalExpenses = totalDaysInMonths > 0 ? rawExpenses * (days / totalDaysInMonths) : rawExpenses
  const profit = netRevenue - totalExpenses
  const avgDaily = days > 0 ? grossRevenue / days : 0

  // Churn (cancellations + refunds from all sources in the selected period)
  const churnCount = refundTx.length
  const totalTxCount = paidTx.length + refundTx.length
  const churnRate = totalTxCount > 0 ? (churnCount / totalTxCount) * 100 : 0
  const isChurnHigh = churnRate > 5

  // Margin (profit / revenue)
  const marginPct = grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0
  const isMarginHealthy = marginPct > 20
  const refundPct = grossRevenue > 0 ? (totalRefunds / grossRevenue) * 100 : 0

  // Generate all dates in range for filling gaps
  const allDatesInRange = (() => {
    const dates: string[] = []
    const start = new Date(startDate + 'T12:00:00')
    const end = new Date(endDate + 'T12:00:00')
    const cur = new Date(start)
    while (cur <= end) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  })()

  // Build a lookup from financial_daily
  const financialByDate: Record<string, number> = {}
  financialData.forEach((d: any) => {
    financialByDate[d.date] = (d.revenue_stripe || 0) + (d.revenue_kiwify || 0) + (d.revenue_adsense || 0)
  })

  // Chart data - adapt granularity based on range
  const chartData = (() => {
    if (dateRange === '7d' || dateRange === '30d') {
      // Daily granularity — fill ALL days in range (0 for missing)
      return allDatesInRange.map((dateStr) => {
        const dt = new Date(dateStr + 'T12:00:00')
        const label = dateRange === '7d'
          ? `${dt.getDate()}/${dt.getMonth() + 1}`
          : `${dt.getDate()}`
        return {
          date: label,
          total: financialByDate[dateStr] || 0,
        }
      })
    } else if (dateRange === '90d') {
      // Weekly granularity
      const weeks: Record<string, number> = {}
      const weekOrder: string[] = []
      financialData.forEach((d: any) => {
        const dt = new Date(d.date + 'T12:00:00')
        const weekStart = new Date(dt)
        weekStart.setDate(dt.getDate() - dt.getDay())
        const key = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`
        if (!weeks[key]) weekOrder.push(key)
        weeks[key] = (weeks[key] || 0) + (d.revenue_stripe || 0) + (d.revenue_kiwify || 0) + (d.revenue_adsense || 0)
      })
      return weekOrder.map((date) => ({ date, total: weeks[date] }))
    } else {
      // Monthly granularity (365d, ytd)
      const months: Record<string, number> = {}
      const monthOrder: string[] = []
      financialData.forEach((d: any) => {
        const dt = new Date(d.date + 'T12:00:00')
        const key = MONTH_NAMES[dt.getMonth()]
        if (!months[key]) monthOrder.push(key)
        months[key] = (months[key] || 0) + (d.revenue_stripe || 0) + (d.revenue_kiwify || 0) + (d.revenue_adsense || 0)
      })
      return monthOrder.map((date) => ({ date, total: months[date] }))
    }
  })()

  const chartTotal = chartData.reduce((s, d) => s + d.total, 0)

  // Today's revenue — from financial_daily + revenue_transactions as fallback
  const todayStr = endDate
  const todayFinancial = financialData.find((d: any) => d.date === todayStr)
  const todayFromFinancial = todayFinancial
    ? (todayFinancial.revenue_stripe || 0) + (todayFinancial.revenue_kiwify || 0) + (todayFinancial.revenue_adsense || 0)
    : 0
  const todayFromTx = periodTransactions
    .filter((tx: any) => tx.date === todayStr && (tx.status === 'paid' || tx.status === 'approved'))
    .reduce((s: number, tx: any) => s + Math.abs(tx.amount), 0)
  const todayRevenue = todayFromFinancial > 0 ? todayFromFinancial : todayFromTx

  const BRL = (v: number) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL' })

  const tooltipStyle = {
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  }

  // 5 Questions - real financial health
  const questions = [
    {
      q: t('home.making_money'),
      ok: profit > 0,
      answer: profit > 0
        ? `${t('home.yes')} (${BRL(profit)})`
        : `${t('home.no')} (${BRL(profit)})`,
    },
    {
      q: t('home.growing'),
      ok: avgDaily > 0,
      answer: avgDaily > 0 ? `${t('home.yes')} (${BRL(avgDaily)}/${t('home.day')})` : t('home.no'),
    },
    {
      q: t('home.losing_clients'),
      ok: !isChurnHigh,
      answer: isChurnHigh ? `${t('home.yes')} (${churnRate.toFixed(1)}%)` : `${t('home.no')} (${churnRate.toFixed(1)}%)`,
    },
    {
      q: t('home.cash_risk'),
      ok: isMarginHealthy,
      answer: isMarginHealthy
        ? `${t('home.no')} (${marginPct.toFixed(0)}%)`
        : `${t('home.yes')} (${marginPct.toFixed(0)}%)`,
    },
    {
      q: t('home.action_needed'),
      ok: profit > 0 && !isChurnHigh && isMarginHealthy,
      answer: profit <= 0 ? t('home.review_churn') : isChurnHigh ? t('home.review_churn') : t('home.keep_growing'),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('home.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">{t('home.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>

          <button
            onClick={syncAll}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              syncStatus === 'done'
                ? 'bg-emerald-500 text-white'
                : syncStatus === 'error'
                ? 'bg-red-500 text-white'
                : syncing
                ? 'bg-blue-600 text-white cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-80`}
          >
            {syncStatus === 'done' ? (
              <><Check size={16} /> {t('home.synced')}</>
            ) : syncStatus === 'error' ? (
              <><AlertCircle size={16} /> {t('home.partial_errors')}</>
            ) : syncing ? (
              <><Loader2 size={16} className="animate-spin" /> {t('home.syncing', { progress: String(syncProgress) })}</>
            ) : (
              <><RefreshCw size={16} /> {t('home.sync_all')}</>
            )}
          </button>
        </div>
      </div>

      {/* 5 Questions */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {questions.map((q, i) => (
          <div key={i} className={`card p-4 border-l-4 ${q.ok ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
            <p className="text-[11px] text-gray-500 dark:text-neutral-500 mb-2">{q.q}</p>
            <div className="flex items-center gap-1.5">
              {q.ok
                ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                : <AlertCircle size={14} className="text-amber-500 shrink-0" />
              }
              <span className={`text-xs font-semibold ${q.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {q.answer}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={DollarSign} label={t('home.total_revenue')} value={BRL(grossRevenue)} sub={`${days} ${t('home.day')}s`} accent="emerald" trend={avgDaily > 0 ? 'up' : undefined} trendVal={`${BRL(avgDaily)}/${t('home.day')}`} />
        <KPICard icon={TrendingUp} label={t('home.net_revenue')} value={BRL(netRevenue)} sub={t('home.revenue_minus_refunds')} accent={netRevenue > 0 ? 'blue' : 'red'} trend={netRevenue > 0 ? 'up' : 'down'} />
        <KPICard icon={Users} label={t('home.churn_rate')} value={`${churnRate.toFixed(1)}%`} sub={`${churnCount} ${t('home.cancellations_refunds')}`} accent={isChurnHigh ? 'amber' : 'emerald'} />
        <KPICard icon={AlertCircle} label={t('home.refunds')} value={BRL(totalRefunds)} sub={grossRevenue > 0 ? `${refundPct.toFixed(1)}% ${t('home.of_revenue')}` : ''} accent={totalRefunds > 0 ? 'red' : 'gray'} warning={refundPct > 10 ? t('home.above_10') : undefined} />
      </div>

      {/* Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('home.daily_revenue')}</h2>
              <p className="text-2xl font-bold text-emerald-500 mt-1">
                {BRL(chartTotal)}
                <span className="text-xs text-gray-400 dark:text-neutral-500 font-normal ml-2">{t('home.period')}</span>
              </p>
              <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mt-0.5">
                {BRL(todayRevenue)}
                <span className="text-xs text-gray-400 dark:text-neutral-500 font-normal ml-1">{t('home.today')}</span>
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {dateRange === '365d' || dateRange === 'ytd' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
                <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [BRL(value), t('home.revenue')]} />
                <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="hgTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
                <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [BRL(value), t('home.revenue')]} />
                <Area type="monotone" dataKey="total" stroke="#10b981" fill="url(#hgTotal)" strokeWidth={2.5} dot={dateRange === '7d' ? { r: 4, fill: '#10b981', strokeWidth: 0 } : false} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <SideCard label="Stripe" value={BRL(totalStripe)} color="blue" pct={grossRevenue > 0 ? totalStripe / grossRevenue * 100 : 0} />
          <SideCard label="Kiwify" value={BRL(totalKiwify)} color="emerald" pct={grossRevenue > 0 ? totalKiwify / grossRevenue * 100 : 0} />
          <SideCard label="YouTube" value={BRL(totalAdsense)} color="red" pct={grossRevenue > 0 ? totalAdsense / grossRevenue * 100 : 0} />
          <SideCard label={t('home.net_revenue')} value={BRL(netRevenue)} color="violet" pct={grossRevenue > 0 ? netRevenue / grossRevenue * 100 : 100} />
        </div>
      </div>

      {/* Alerts */}
      {isChurnHigh && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t('home.high_churn')}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">{churnRate.toFixed(1)}% ({t('home.target_5')})</p>
          </div>
        </div>
      )}

      {/* AI Insights Chat */}
      <AIInsightsChat dateRange={dateRange} />
    </div>
  )
}

// ==================== MARKDOWN RENDERER ====================

function renderMarkdown(text: string): string {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Headers (must be before bold)
  html = html.replace(/^### (.+)$/gm, '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Italic: _text_ (use underscore to avoid conflict with bold *)
  html = html.replace(/(?:^|[\s(])_([^_]+)_(?:[\s).,;!?]|$)/g, (match, p1) => match.replace(`_${p1}_`, `<em>${p1}</em>`))

  // Process numbered lists (1. 2. 3.)
  html = html.replace(/((?:^\d+\.\s+.+$\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line =>
      `<li class="ml-4">${line.replace(/^\d+\.\s+/, '')}</li>`
    ).join('')
    return `<ol class="list-decimal pl-4 my-2 space-y-1">${items}</ol>`
  })

  // Process bullet lists (- item)
  html = html.replace(/((?:^- .+$\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(line =>
      `<li class="ml-4">${line.replace(/^- /, '')}</li>`
    ).join('')
    return `<ul class="list-disc pl-4 my-2 space-y-1">${items}</ul>`
  })

  // Line breaks
  html = html.replace(/\n/g, '<br/>')
  // Clean br around block elements
  html = html.replace(/(<\/(?:ol|ul|h[2-4]|li)>)<br\/>/g, '$1')
  html = html.replace(/<br\/>(<(?:ol|ul|h[2-4]))/g, '$1')

  return html
}

// ==================== AI INSIGHTS CHAT ====================

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

function AIInsightsChat({ dateRange }: { dateRange: DateRange }) {
  const { t, lang } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showKB, setShowKB] = useState(false)
  const [uploading, setUploading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch knowledge base docs
  const { data: kbDocs = [] } = useQuery({
    queryKey: ['ai-knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge_base' as any)
        .select('id, name, char_count, created_at')
        .order('created_at', { ascending: true })
      if (error) console.error('KB fetch error:', error)
      return (data as any[]) || []
    },
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const text = await file.text()
      if (!text.trim()) {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      const name = file.name.replace(/\.[^.]+$/, '')

      const { error } = await supabase.from('ai_knowledge_base' as any).insert({
        name,
        content: text,
      })

      if (error) {
        console.error('KB insert error:', error)
      } else {
        queryClient.invalidateQueries({ queryKey: ['ai-knowledge-base'] })
      }
    } catch (err) {
      console.error('File upload error:', err)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const deleteDoc = async (id: string) => {
    const { error } = await supabase.from('ai_knowledge_base' as any).delete().eq('id', id)
    if (error) console.error('KB delete error:', error)
    queryClient.invalidateQueries({ queryKey: ['ai-knowledge-base'] })
  }

  const quickQuestions = [
    t('home.summary'),
    t('home.improve'),
    t('home.analyze_churn'),
    t('home.how_revenue'),
  ]

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', text: text.trim() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(
        `https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/ai-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec'}`,
          },
          body: JSON.stringify({
            question: text.trim(),
            history: updatedMessages.slice(-10),
            dateRange,
          }),
        }
      )
      const data = await res.json()
      const aiMsg: ChatMessage = { role: 'model', text: data.answer || data.error || t('home.process_error') }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: t('home.connection_error') }])
    }
    setLoading(false)
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('home.ai_consultant')}</h2>
              <p className="text-xs text-gray-400 dark:text-neutral-500">
                {t('home.ai_subtitle')}
                {kbDocs.length > 0 && ` + ${kbDocs.length} doc${kbDocs.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowKB(!showKB)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showKB
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
            }`}
          >
            <BookOpen size={14} />
            {t('home.knowledge_base')}
          </button>
        </div>
      </div>

      {/* Knowledge Base Panel */}
      {showKB && (
        <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">{t('home.docs_loaded')}</p>
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              uploading ? 'bg-gray-200 dark:bg-neutral-700 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? t('home.loading') : t('home.upload')}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {kbDocs.length === 0 ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
              <p className="text-xs text-gray-400 dark:text-neutral-500">{t('home.no_docs')}</p>
              <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-1">{t('home.accept_files')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {kbDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                        {(doc.char_count || 0).toLocaleString(locale)} {t('home.characters')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto min-h-[200px]">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Bot className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-neutral-500">{t('home.ask_business')}</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-md'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                )}
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

      {/* Quick questions */}
      {messages.length === 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder={t('home.ask_placeholder')}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon: Icon, label, value, sub, accent, trend, trendVal, warning }: { icon: any; label: string; value: string; sub: string; accent: string; trend?: 'up' | 'down'; trendVal?: string; warning?: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500' },
    red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-500' },
    gray: { bg: 'bg-gray-50 dark:bg-neutral-800', text: 'text-gray-400' },
  }
  const c = colors[accent] || colors.gray
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2.5 rounded-xl ${c.bg}`}><Icon size={20} className={c.text} /></span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trendVal}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-neutral-600 mt-0.5">{sub}</p>}
      {warning && (
        <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
          <AlertTriangle size={11} /> {warning}
        </p>
      )}
    </div>
  )
}

function SideCard({ label, value, color, pct }: { label: string; value: string; color: string; pct: number }) {
  const barColors: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', red: 'bg-red-500' }
  const txtColors: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', violet: 'text-violet-500', red: 'text-red-500' }
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 dark:text-neutral-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${txtColors[color] || 'text-gray-900 dark:text-white'}`}>{value}</p>
      <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColors[color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}
