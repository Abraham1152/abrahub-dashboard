import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Repeat,
  Zap,
  Minus,
  ChevronLeft,
  ChevronRight,
  Users,
  Target,
  Clock,
  UserMinus,
  UserPlus,
  Info,
} from 'lucide-react'

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COLORS = {
  stripe: '#635bff',
  stripe_monthly: '#635bff',
  stripe_annual: '#8b5cf6',
  kiwify: '#00c853',
  adsense: '#fbbc04',
  recurring: '#3b82f6',
  annual: '#8b5cf6',
  one_time: '#f59e0b',
  refund: '#ef4444',
}

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function FinanceiroPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { t, lang } = useTranslation()

  const MONTH_NAMES = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_PT
  const dateLocale = lang === 'en' ? 'en-US' : 'pt-BR'

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`

  const monthStart = `${monthKey}-01`
  const monthEndDate = new Date(selectedYear, selectedMonth + 1, 0)
  const monthEnd = `${monthKey}-${String(monthEndDate.getDate()).padStart(2, '0')}`

  const tooltipStyle = {
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  }

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1) }
    else { setSelectedMonth(selectedMonth - 1) }
  }
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1) }
    else { setSelectedMonth(selectedMonth + 1) }
  }

  // ===================== QUERIES =====================

  const { data: monthlyRevenue = [], isLoading } = useQuery({
    queryKey: ['fin-revenue', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('revenue_transactions')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
      return data || []
    },
  })

  const { data: monthlyExpenses = [] } = useQuery({
    queryKey: ['fin-expenses', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('month', monthKey)
        .order('category')
      return data || []
    },
  })

  const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1)
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
  const prevMonthStart = `${prevMonthKey}-01`
  const prevMonthEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0)
  const prevMonthEnd = `${prevMonthKey}-${String(prevMonthEndDate.getDate()).padStart(2, '0')}`

  const { data: prevMonthRevenue = [] } = useQuery({
    queryKey: ['fin-revenue', prevMonthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('revenue_transactions')
        .select('*')
        .gte('date', prevMonthStart)
        .lte('date', prevMonthEnd)
      return data || []
    },
  })

  const { data: dailyData = [] } = useQuery({
    queryKey: ['fin-daily', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_daily')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true })
      return data || []
    },
  })

  const { data: churnData } = useQuery({
    queryKey: ['fin-churn'],
    queryFn: async () => {
      const { data } = await supabase
        .from('churn_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single()
      return data
    },
  })

  const { data: adsData = [] } = useQuery({
    queryKey: ['fin-ads', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_daily')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
      return data || []
    },
  })

  // ===================== CALCULATIONS =====================

  // Revenue by status
  const monthPaidTx = monthlyRevenue.filter((t: any) => t.status === 'paid' || t.status === 'approved' || t.status === 'completed')
  const monthRefundTx = monthlyRevenue.filter((t: any) => t.status === 'refunded' || t.status === 'chargedback')
  const monthPaidTotal = monthPaidTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const monthTotalRefunds = monthRefundTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  // grossRevenue includes refunded sales (add them back since upsert removes paid records)
  const monthTotalRevenue = monthPaidTotal + monthTotalRefunds
  // netRevenue = gross - refunds = just the paid/approved transactions
  const monthNetRevenue = monthTotalRevenue - monthTotalRefunds

  // Previous month comparison
  const prevPaidTx = prevMonthRevenue.filter((t: any) => t.status === 'paid' || t.status === 'approved' || t.status === 'completed')
  const prevTotalRevenue = prevPaidTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const revenueChange = prevTotalRevenue > 0 ? ((monthTotalRevenue - prevTotalRevenue) / prevTotalRevenue * 100) : 0

  // Revenue by source
  const stripeRevenue = monthPaidTx.filter((t: any) => t.source === 'stripe').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const stripeMonthlyRev = monthPaidTx.filter((t: any) => t.source === 'stripe' && t.type === 'recurring').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const stripeAnnualRev = monthPaidTx.filter((t: any) => t.source === 'stripe' && t.type === 'annual').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const stripeOtherRev = stripeRevenue - stripeMonthlyRev - stripeAnnualRev
  const kiwifyRevenue = monthPaidTx.filter((t: any) => t.source === 'kiwify').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const adsenseRevenue = dailyData.reduce((s: number, d: any) => s + (d.revenue_adsense || 0), 0)

  // Revenue by type
  const recurringTx = monthPaidTx.filter((t: any) => t.type === 'recurring')
  const annualTx = monthPaidTx.filter((t: any) => t.type === 'annual')
  const monthlyRecurringTotal = recurringTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const annualRevenue = annualTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const oneTimeRevenue = monthPaidTx.filter((t: any) => t.type === 'one_time').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)

  // Subscriber counts
  const monthlySubCount = recurringTx.length
  const annualSubCount = annualTx.length

  // MRR = somente assinaturas mensais (anual já pagou a lapada, não é recorrente mensal)
  const mrr = monthlyRecurringTotal

  // Ticket medio por plano
  const ticketMedioMensal = monthlySubCount > 0 ? monthlyRecurringTotal / monthlySubCount : 0
  const ticketMedioAnual = annualSubCount > 0 ? annualRevenue / annualSubCount : 0

  // Subscriptions & Churn
  const activeSubscribers = churnData?.total_customers || 0
  const newCustomers = churnData?.new_customers || 0
  const churnedCustomers = churnData?.churned_customers || 0
  const churnRate = churnData?.churn_percentage || 0
  const ltvEstimated = churnData?.ltv_estimated || 0

  // Ticket Medio geral
  const ticketMedio = activeSubscribers > 0 ? mrr / activeSubscribers : 0

  // LTV
  const ltv = ltvEstimated > 0 ? ltvEstimated : (churnRate > 0 ? ticketMedio * (100 / churnRate) : 0)

  // Ads & CAC
  const totalAdSpend = adsData.reduce((s: number, d: any) => s + (d.total_spend || 0), 0)
  const cac = newCustomers > 0 ? totalAdSpend / newCustomers : 0
  const roas = totalAdSpend > 0 ? monthTotalRevenue / totalAdSpend : 0
  const revenueFromChurn = churnedCustomers * ticketMedio

  // Expenses
  const totalExpenses = monthlyExpenses.reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const toolExpenses = monthlyExpenses.filter((e: any) => e.category === 'tool').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const salaryExpenses = monthlyExpenses.filter((e: any) => e.category === 'salary' || e.category === 'prolabore').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const taxExpenses = monthlyExpenses.filter((e: any) => e.category === 'tax').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const otherExpenses = monthlyExpenses.filter((e: any) => e.category === 'other').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)

  // Profitability
  const lucroLiquido = monthNetRevenue - totalExpenses
  const margem = monthNetRevenue > 0 ? (lucroLiquido / monthNetRevenue * 100) : 0

  // Runway: months of expenses covered by monthly net revenue
  const runway = totalExpenses > 0 ? monthNetRevenue / totalExpenses : 0

  // Chart data — fill ALL days in the selected month (0 for missing)
  const chartData = (() => {
    const dailyByDate: Record<string, any> = {}
    dailyData.forEach((d: any) => { dailyByDate[d.date] = d })
    const allDays: { date: string; stripe: number; kiwify: number; adsense: number; total: number }[] = []
    const start = new Date(monthStart + 'T12:00:00')
    const end = new Date(monthEnd + 'T12:00:00')
    const cur = new Date(start)
    while (cur <= end) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      const d = dailyByDate[dateStr]
      allDays.push({
        date: dateStr.slice(5),
        stripe: d?.revenue_stripe || 0,
        kiwify: d?.revenue_kiwify || 0,
        adsense: d?.revenue_adsense || 0,
        total: (d?.revenue_stripe || 0) + (d?.revenue_kiwify || 0) + (d?.revenue_adsense || 0),
      })
      cur.setDate(cur.getDate() + 1)
    }
    return allDays
  })()

  // Pie data
  const sourceData = [
    { name: `Stripe ${t('financeiro.monthlies')}`, value: stripeMonthlyRev, color: COLORS.stripe_monthly },
    { name: `Stripe ${t('financeiro.annuals')}`, value: stripeAnnualRev, color: COLORS.stripe_annual },
    ...(stripeOtherRev > 0 ? [{ name: `Stripe ${t('financeiro.one_time_sales')}`, value: stripeOtherRev, color: '#a78bfa' }] : []),
    { name: 'Kiwify', value: kiwifyRevenue, color: COLORS.kiwify },
    ...(adsenseRevenue > 0 ? [{ name: 'AdSense', value: adsenseRevenue, color: COLORS.adsense }] : []),
  ].filter((d) => d.value > 0)

  const typeData = [
    { name: t('financeiro.monthlies'), value: monthlyRecurringTotal, color: COLORS.recurring },
    { name: t('financeiro.annuals'), value: annualRevenue, color: COLORS.annual },
    { name: t('financeiro.one_time_sales'), value: oneTimeRevenue, color: COLORS.one_time },
  ].filter((d) => d.value > 0)

  // Product breakdown
  const productMap: Record<string, number> = {}
  monthPaidTx.forEach((t: any) => {
    const name = t.product_name || 'Outros'
    productMap[name] = (productMap[name] || 0) + Math.abs(t.amount)
  })
  const productData = Object.entries(productMap)
    .map(([name, value]) => ({ name: name.length > 30 ? name.substring(0, 30) + '...' : name, fullName: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Recent transactions
  const recentTx = [...monthlyRevenue]
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 20)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400 dark:text-neutral-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">

      {/* ========== HEADER ========== */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('financeiro.title')}</h1>
          <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">{t('financeiro.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToPrevMonth} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <select
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); setSelectedYear(y); setSelectedMonth(m) }}
            className="px-4 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl min-w-[140px] text-center text-sm font-semibold text-gray-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            {Array.from({ length: 24 }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
              return (
                <option key={i} value={`${d.getFullYear()}-${d.getMonth()}`}>
                  {MONTH_NAMES[d.getMonth()]} {d.getFullYear()}
                </option>
              )
            })}
          </select>
          <button onClick={goToNextMonth} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* ========== KPI CARDS ROW 1: RECEITA ========== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          label={t('financeiro.gross_revenue')}
          value={BRL(monthTotalRevenue)}
          icon={DollarSign}
          accent="emerald"
          badge={revenueChange !== 0 ? `${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(0)}%` : undefined}
          badgeColor={revenueChange >= 0 ? 'emerald' : 'red'}
          info={t('financeiro.gross_revenue_desc')}
        />
        <MetricCard
          label={t('financeiro.mrr')}
          value={BRL(mrr)}
          icon={Repeat}
          accent="blue"
          sub={`${monthlySubCount} ${t('financeiro.monthly_subscribers')}`}
          info={t('financeiro.mrr_desc')}
        />
        <MetricCard
          label={t('financeiro.avg_ticket')}
          value={ticketMedio > 0 ? BRL(ticketMedio) : 'N/A'}
          icon={Minus}
          accent="purple"
          sub={activeSubscribers > 0 ? `${activeSubscribers} ${t('financeiro.subscribers')}` : undefined}
          info={t('financeiro.avg_ticket_desc')}
        />
        <MetricCard
          label={t('financeiro.active_subscribers')}
          value={activeSubscribers > 0 ? activeSubscribers.toString() : 'N/A'}
          icon={Users}
          accent="cyan"
          sub={newCustomers > 0 ? `+${newCustomers} ${t('financeiro.new')}` : undefined}
          info={t('financeiro.active_desc')}
        />
        <MetricCard
          label={t('financeiro.churn')}
          value={churnRate > 0 ? `${churnRate.toFixed(1)}%` : 'N/A'}
          icon={UserMinus}
          accent={churnRate > 5 ? 'red' : 'amber'}
          sub={churnedCustomers > 0 ? `${churnedCustomers} ${t('financeiro.cancelled')}` : undefined}
          info={t('financeiro.churn_desc')}
        />
      </div>

      {/* ========== KPI CARDS ROW 2: SAUDE FINANCEIRA ========== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          label={t('financeiro.ltv')}
          value={ltv > 0 ? BRL(ltv) : 'N/A'}
          icon={TrendingUp}
          accent="emerald"
          sub={ltv > 0 && cac > 0 ? `${t('financeiro.ltv_cac')} ${(ltv / cac).toFixed(1)}x` : undefined}
          info={t('financeiro.ltv_desc')}
        />
        <MetricCard
          label={t('financeiro.cac')}
          value={cac > 0 ? BRL(cac) : 'N/A'}
          icon={Target}
          accent="amber"
          sub={totalAdSpend > 0 ? `${t('financeiro.spend')} ${BRL(totalAdSpend)}` : t('financeiro.no_ads_data')}
          info={t('financeiro.cac_desc')}
        />
        <MetricCard
          label={t('financeiro.net_margin')}
          value={`${margem.toFixed(1)}%`}
          icon={Zap}
          accent={margem >= 0 ? 'blue' : 'red'}
          sub={BRL(lucroLiquido)}
          info={t('financeiro.net_margin_desc')}
        />
        <MetricCard
          label={t('financeiro.cash_flow')}
          value={BRL(lucroLiquido)}
          icon={DollarSign}
          accent={lucroLiquido >= 0 ? 'emerald' : 'red'}
          sub={t('financeiro.revenue_minus_expenses')}
          info={t('financeiro.cash_flow_desc')}
        />
        <MetricCard
          label={t('financeiro.runway')}
          value={totalExpenses > 0 ? (runway >= 1 ? `${runway.toFixed(1)}x` : `${(runway * 100).toFixed(0)}%`) : 'N/A'}
          icon={Clock}
          accent={runway >= 1 ? 'emerald' : 'red'}
          sub={totalExpenses > 0 ? (runway >= 1 ? t('financeiro.sustainable') : t('financeiro.not_covering')) : t('financeiro.no_expenses')}
          info={t('financeiro.runway_desc')}
        />
      </div>

      {/* ========== P&L BREAKDOWN ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.revenues')} - {monthLabel}</h3>
          <div className="space-y-3">
            {/* Stripe */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.stripe }} />
              <span className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Stripe</span>
            </div>
            {stripeMonthlyRev > 0 && <PLRow label={`  ${t('financeiro.monthly_subs')}`} value={stripeMonthlyRev} color={COLORS.stripe_monthly} />}
            {stripeAnnualRev > 0 && <PLRow label={`  ${t('financeiro.annual_subs')}`} value={stripeAnnualRev} color={COLORS.stripe_annual} />}
            {stripeOtherRev > 0 && <PLRow label={`  ${t('financeiro.one_time')}`} value={stripeOtherRev} color={COLORS.one_time} />}
            {stripeRevenue > 0 && <PLRow label={`  ${t('financeiro.subtotal_stripe')}`} value={stripeRevenue} color={COLORS.stripe} bold />}

            {kiwifyRevenue > 0 && (
              <>
                <div className="border-t border-gray-100 dark:border-neutral-800/50 pt-2 mt-2" />
                <PLRow label="Kiwify" value={kiwifyRevenue} color={COLORS.kiwify} />
              </>
            )}

            {adsenseRevenue > 0 && (
              <>
                <div className="border-t border-gray-100 dark:border-neutral-800/50 pt-2 mt-2" />
                <PLRow label={t('financeiro.youtube_adsense')} value={adsenseRevenue} color={COLORS.adsense} />
              </>
            )}

            <div className="border-t border-gray-200 dark:border-neutral-800 pt-2">
              <PLRow label={t('financeiro.gross_revenue')} value={monthTotalRevenue} bold />
            </div>
            <PLRow label={t('financeiro.refunds_label')} value={-monthTotalRefunds} color={COLORS.refund} />
            <div className="border-t border-gray-200 dark:border-neutral-800 pt-2">
              <PLRow label={t('financeiro.net_revenue')} value={monthNetRevenue} bold color="#10b981" />
            </div>
          </div>
        </div>

        {/* Despesas */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.expenses_label')} - {monthLabel}</h3>
          {monthlyExpenses.length > 0 ? (
            <div className="space-y-3">
              {toolExpenses > 0 && <PLRow label={t('financeiro.tools_software')} value={-toolExpenses} color="#3b82f6" />}
              {salaryExpenses > 0 && <PLRow label={t('financeiro.salaries')} value={-salaryExpenses} color="#8b5cf6" />}
              {taxExpenses > 0 && <PLRow label={t('financeiro.taxes')} value={-taxExpenses} color="#ef4444" />}
              {otherExpenses > 0 && <PLRow label={t('financeiro.other')} value={-otherExpenses} color="#6b7280" />}
              <div className="border-t border-gray-200 dark:border-neutral-800 pt-2">
                <PLRow label={t('financeiro.total_expenses')} value={-totalExpenses} bold color="#ef4444" />
              </div>
              <div className="border-t-2 border-gray-300 dark:border-neutral-700 pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{t('financeiro.net_profit')}</span>
                  <span className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {BRL(lucroLiquido)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('financeiro.no_expenses_for')} {monthLabel}</p>
              <a href="/gastos" className="text-blue-500 text-sm hover:underline mt-1 inline-block">{t('financeiro.register_expenses')}</a>
            </div>
          )}
        </div>
      </div>

      {/* ========== ASSINATURAS ========== */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.subscriptions_saas')}</h3>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-blue-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('financeiro.monthly_plan')}</span>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-500">{monthlySubCount} {t('financeiro.subscribers')}</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{BRL(monthlyRecurringTotal)}</p>
            <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">
              {t('financeiro.avg_ticket_label')} {ticketMedioMensal > 0 ? BRL(ticketMedioMensal) : '-'}/{t('financeiro.month')}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-purple-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('financeiro.annual_plan')}</span>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/10 text-purple-500">{annualSubCount} {t('financeiro.subscribers')}</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">{BRL(annualRevenue)}</p>
            <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">
              {t('financeiro.avg_ticket_label')} {ticketMedioAnual > 0 ? BRL(ticketMedioAnual) : '-'}/{t('financeiro.year')} ({ticketMedioAnual > 0 ? BRL(ticketMedioAnual / 12) : '-'}/{t('financeiro.month')})
            </p>
          </div>
        </div>

        {/* Metricas de assinatura */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MiniStat label={t('financeiro.active_total')} value={activeSubscribers > 0 ? activeSubscribers.toString() : '-'} icon={Users} color="blue" />
          <MiniStat label={t('financeiro.new_month')} value={newCustomers > 0 ? `+${newCustomers}` : '-'} icon={UserPlus} color="emerald" />
          <MiniStat label={t('financeiro.cancelled_label')} value={churnedCustomers > 0 ? churnedCustomers.toString() : '-'} icon={UserMinus} color="red" />
          <MiniStat label={t('financeiro.churn_pct')} value={churnRate > 0 ? `${churnRate.toFixed(1)}%` : '-'} icon={TrendingDown} color={churnRate > 5 ? 'red' : 'amber'} />
          <MiniStat label={t('financeiro.lost_revenue')} value={revenueFromChurn > 0 ? BRL(revenueFromChurn) : '-'} icon={DollarSign} color="red" />
          <MiniStat label={t('financeiro.roas')} value={roas > 0 ? `${roas.toFixed(1)}x` : '-'} icon={Target} color={roas >= 2 ? 'emerald' : 'amber'} />
        </div>
      </div>

      {/* ========== REVENUE CHART ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('financeiro.daily_revenue')} - {monthLabel}</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.stripe }} />
                {t('financeiro.stripe')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.kiwify }} />
                {t('financeiro.kiwify')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.adsense }} />
                {t('financeiro.adsense')}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradStripe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.stripe} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.stripe} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradKiwify" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.kiwify} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.kiwify} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAdsense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.adsense} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.adsense} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { stripe: 'Stripe', kiwify: 'Kiwify', adsense: 'AdSense' }
                  return [BRL(value), labels[name] || name]
                }}
                labelStyle={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
              />
              <Area type="monotone" dataKey="stripe" stroke={COLORS.stripe} fill="url(#gradStripe)" strokeWidth={2} />
              <Area type="monotone" dataKey="kiwify" stroke={COLORS.kiwify} fill="url(#gradKiwify)" strokeWidth={2} />
              <Area type="monotone" dataKey="adsense" stroke={COLORS.adsense} fill="url(#gradAdsense)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-3">{t('financeiro.net_revenue')}</p>
            <p className={`text-3xl font-bold ${monthNetRevenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {BRL(monthNetRevenue)}
            </p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">{t('financeiro.stripe')}</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.stripe }}>{BRL(stripeRevenue)}</p>
            <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400 dark:text-neutral-500">
              {stripeMonthlyRev > 0 && <span>{t('financeiro.monthlies')}: {BRL(stripeMonthlyRev)}</span>}
              {stripeAnnualRev > 0 && <span>{t('financeiro.annuals')}: {BRL(stripeAnnualRev)}</span>}
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${monthTotalRevenue > 0 ? (stripeRevenue / monthTotalRevenue * 100) : 0}%`, backgroundColor: COLORS.stripe }} />
            </div>
          </div>
          <div className="card p-5">
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">{t('financeiro.kiwify')}</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.kiwify }}>{BRL(kiwifyRevenue)}</p>
            <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${monthTotalRevenue > 0 ? (kiwifyRevenue / monthTotalRevenue * 100) : 0}%`, backgroundColor: COLORS.kiwify }} />
            </div>
          </div>
          {adsenseRevenue > 0 && (
            <div className="card p-5">
              <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">{t('financeiro.youtube_adsense')}</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.adsense }}>{BRL(adsenseRevenue)}</p>
              <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${monthTotalRevenue > 0 ? (adsenseRevenue / monthTotalRevenue * 100) : 0}%`, backgroundColor: COLORS.adsense }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== PIE CHARTS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.revenue_by_source')}</h2>
          {sourceData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {sourceData.map((entry, i) => (<Cell key={i} fill={entry.color} stroke="transparent" />))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => BRL(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {sourceData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-sm text-gray-600 dark:text-neutral-300">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{BRL(d.value)}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-500">{monthTotalRevenue > 0 ? (d.value / monthTotalRevenue * 100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('financeiro.no_data_period')}</p>}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.revenue_type')}</h2>
          {typeData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {typeData.map((entry, i) => (<Cell key={i} fill={entry.color} stroke="transparent" />))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => BRL(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {typeData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-sm text-gray-600 dark:text-neutral-300">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{BRL(d.value)}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-500">{monthTotalRevenue > 0 ? (d.value / monthTotalRevenue * 100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('financeiro.no_data_period')}</p>}
        </div>
      </div>

      {/* ========== PRODUCTS ========== */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.revenue_by_product')} - {monthLabel}</h2>
        {productData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(productData.length * 48, 200)}>
            <BarChart data={productData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} horizontal={false} />
              <XAxis type="number" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} width={200} tick={{ fill: isDark ? '#a1a1aa' : '#6b7280' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => BRL(value)} labelFormatter={(label) => { const item = productData.find((p) => p.name === label); return item?.fullName || label }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {productData.map((_, i) => (<Cell key={i} fill={i % 2 === 0 ? COLORS.stripe : COLORS.kiwify} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('financeiro.no_data_period')}</p>}
      </div>

      {/* ========== RECENT TRANSACTIONS ========== */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('financeiro.transactions')} - {monthLabel}</h2>
        {recentTx.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-neutral-500 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-2">{t('financeiro.date')}</th>
                  <th className="text-left py-3 px-2">{t('financeiro.product')}</th>
                  <th className="text-left py-3 px-2">{t('financeiro.source')}</th>
                  <th className="text-left py-3 px-2">{t('financeiro.type')}</th>
                  <th className="text-left py-3 px-2">{t('financeiro.status')}</th>
                  <th className="text-right py-3 px-2">{t('financeiro.value')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((tx: any) => (
                  <tr key={tx.transaction_id} className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-2 text-gray-500 dark:text-neutral-400">
                      {new Date(tx.date + 'T00:00:00').toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-3 px-2 max-w-[200px] truncate text-gray-900 dark:text-white" title={tx.product_name}>
                      {tx.product_name || '\u2014'}
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                        backgroundColor: tx.source === 'stripe' ? COLORS.stripe + '20' : COLORS.kiwify + '20',
                        color: tx.source === 'stripe' ? COLORS.stripe : COLORS.kiwify
                      }}>
                        {tx.source === 'stripe' ? 'Stripe' : 'Kiwify'}
                      </span>
                    </td>
                    <td className="py-3 px-2"><TypeBadge type={tx.type} /></td>
                    <td className="py-3 px-2"><StatusBadge status={tx.status} /></td>
                    <td className={`py-3 px-2 text-right font-medium ${tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {BRL(Math.abs(tx.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('financeiro.no_transactions')}</p>}
      </div>
    </div>
  )
}

// ===================== SUB COMPONENTS =====================

function MetricCard({ label, value, icon: Icon, accent, badge, badgeColor, sub, info }: {
  label: string; value: string; icon: any; accent: string; badge?: string; badgeColor?: string; sub?: string; info?: string
}) {
  const accents: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-500' },
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500' },
    red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-500' },
  }
  const a = accents[accent] || accents.blue
  const badgeAccent = badgeColor ? accents[badgeColor] : undefined

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`p-2 rounded-xl ${a.bg}`}><Icon size={16} className={a.text} /></span>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badgeAccent ? `${badgeAccent.bg} ${badgeAccent.text}` : `${a.bg} ${a.text}`}`}>
              {badge}
            </span>
          )}
          {info && (
            <span className="relative group">
              <Info size={14} className="text-gray-300 dark:text-neutral-600 hover:text-gray-500 dark:hover:text-neutral-400 cursor-help transition-colors" />
              <span className="absolute right-0 top-6 z-50 hidden group-hover:block w-56 p-2.5 text-[11px] leading-relaxed text-gray-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg">
                {info}
              </span>
            </span>
          )}
        </div>
      </div>
      <p className={`text-xl font-bold ${a.text}`}>{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function MiniStat({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: any; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
  }
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-xl">
      <Icon size={16} className={colors[color] || 'text-gray-500'} />
      <div>
        <p className={`text-sm font-bold ${colors[color] || 'text-gray-900 dark:text-white'}`}>{value}</p>
        <p className="text-[10px] text-gray-500 dark:text-neutral-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 dark:text-neutral-600">{sub}</p>}
      </div>
    </div>
  )
}

function PLRow({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-neutral-400'}`}>
        {label}
      </span>
      <span
        className={`text-sm ${bold ? 'font-bold' : 'font-medium'}`}
        style={{ color: color || (value >= 0 ? undefined : '#ef4444') }}
      >
        {BRL(Math.abs(value))}
        {value < 0 && !bold && ' '}
      </span>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const { t } = useTranslation()
  const config: Record<string, { label: string; color: string }> = {
    recurring: { label: t('financeiro.monthly_type'), color: COLORS.recurring },
    annual: { label: t('financeiro.annual_type'), color: COLORS.annual },
    one_time: { label: t('financeiro.one_time_type'), color: COLORS.one_time },
  }
  const c = config[type] || { label: type, color: '#737373' }
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: c.color + '20', color: c.color }}>
      {c.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isPositive = status === 'paid' || status === 'approved'
  const isNegative = status === 'refunded' || status === 'chargedback'
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
      isPositive ? 'bg-emerald-500/10 text-emerald-400' : isNegative ? 'bg-red-500/10 text-red-400' : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'
    }`}>
      {status}
    </span>
  )
}
