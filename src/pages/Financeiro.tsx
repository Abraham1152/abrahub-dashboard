import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useState, useMemo } from 'react'
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
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  Zap,
  Minus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type Period = 7 | 30 | 90

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

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function FinanceiroPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [period, setPeriod] = useState<Period>(30)

  // Monthly P&L state
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()) // 0-indexed

  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`

  // Calculate month date range
  const monthStart = `${monthKey}-01`
  const monthEndDate = new Date(selectedYear, selectedMonth + 1, 0)
  const monthEnd = `${monthKey}-${String(monthEndDate.getDate()).padStart(2, '0')}`

  const tooltipStyle = {
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  }

  const sinceDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - period)
    return d.toISOString().split('T')[0]
  }, [period])

  // === Monthly P&L Queries ===

  // Revenue for selected month
  const { data: monthlyRevenue = [] } = useQuery({
    queryKey: ['monthly-revenue', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('revenue_transactions')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
      return data || []
    },
  })

  // Expenses for selected month
  const { data: monthlyExpenses = [] } = useQuery({
    queryKey: ['monthly-expenses', monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('month', monthKey)
        .order('category')
      return data || []
    },
  })

  // Previous month for comparison
  const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1)
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
  const prevMonthStart = `${prevMonthKey}-01`
  const prevMonthEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0)
  const prevMonthEnd = `${prevMonthKey}-${String(prevMonthEndDate.getDate()).padStart(2, '0')}`

  const { data: prevMonthRevenue = [] } = useQuery({
    queryKey: ['monthly-revenue', prevMonthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('revenue_transactions')
        .select('*')
        .gte('date', prevMonthStart)
        .lte('date', prevMonthEnd)
      return data || []
    },
  })

  // Monthly P&L Calculations
  const monthPaidTx = monthlyRevenue.filter((t: any) => t.status === 'paid' || t.status === 'approved')
  const monthRefundTx = monthlyRevenue.filter((t: any) => t.status === 'refunded' || t.status === 'chargedback')
  const monthTotalRevenue = monthPaidTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const monthTotalRefunds = monthRefundTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const monthNetRevenue = monthTotalRevenue - monthTotalRefunds

  const prevPaidTx = prevMonthRevenue.filter((t: any) => t.status === 'paid' || t.status === 'approved')
  const prevTotalRevenue = prevPaidTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const revenueChange = prevTotalRevenue > 0 ? ((monthTotalRevenue - prevTotalRevenue) / prevTotalRevenue * 100) : 0

  const totalExpenses = monthlyExpenses.reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const toolExpenses = monthlyExpenses.filter((e: any) => e.category === 'tool').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const salaryExpenses = monthlyExpenses.filter((e: any) => e.category === 'salary' || e.category === 'prolabore').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const taxExpenses = monthlyExpenses.filter((e: any) => e.category === 'tax').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)
  const otherExpenses = monthlyExpenses.filter((e: any) => e.category === 'other').reduce((s: number, e: any) => s + (e.price_brl || 0), 0)

  const lucroLiquido = monthNetRevenue - totalExpenses
  const margem = monthNetRevenue > 0 ? (lucroLiquido / monthNetRevenue * 100) : 0

  // Month navigation
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }
  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  // === Period Queries (existing) ===
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['revenue-transactions', sinceDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('revenue_transactions')
        .select('*')
        .gte('date', sinceDate)
        .order('date', { ascending: true })
      return data || []
    },
  })

  const { data: dailyData = [] } = useQuery({
    queryKey: ['financial-daily', sinceDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_daily')
        .select('*')
        .gte('date', sinceDate)
        .order('date', { ascending: true })
      return data || []
    },
  })

  // --- Period Calculations ---
  const paidTx = transactions.filter((t: any) => t.status === 'paid' || t.status === 'approved')
  const refundTx = transactions.filter((t: any) => t.status === 'refunded' || t.status === 'chargedback')

  const totalRevenue = paidTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const totalRefunds = refundTx.reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
  const netRevenue = totalRevenue - totalRefunds

  const stripeRevenue = paidTx.filter((t: any) => t.source === 'stripe').reduce((s: number, t: any) => s + t.amount, 0)
  const stripeMonthlyRev = paidTx.filter((t: any) => t.source === 'stripe' && t.type === 'recurring').reduce((s: number, t: any) => s + t.amount, 0)
  const stripeAnnualRev = paidTx.filter((t: any) => t.source === 'stripe' && t.type === 'annual').reduce((s: number, t: any) => s + t.amount, 0)
  const stripeOtherRev = stripeRevenue - stripeMonthlyRev - stripeAnnualRev
  const kiwifyRevenue = paidTx.filter((t: any) => t.source === 'kiwify').reduce((s: number, t: any) => s + t.amount, 0)
  const adsenseRevenue = paidTx.filter((t: any) => t.source === 'adsense').reduce((s: number, t: any) => s + t.amount, 0)

  const recurringRevenue = paidTx.filter((t: any) => t.type === 'recurring').reduce((s: number, t: any) => s + t.amount, 0)
  const annualRevenue = paidTx.filter((t: any) => t.type === 'annual').reduce((s: number, t: any) => s + t.amount, 0)
  const oneTimeRevenue = paidTx.filter((t: any) => t.type === 'one_time').reduce((s: number, t: any) => s + t.amount, 0)

  const productMap: Record<string, number> = {}
  paidTx.forEach((t: any) => {
    const name = t.product_name || 'Outros'
    productMap[name] = (productMap[name] || 0) + t.amount
  })
  const productData = Object.entries(productMap)
    .map(([name, value]) => ({ name: name.length > 30 ? name.substring(0, 30) + '...' : name, fullName: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const sourceData = [
    { name: 'Stripe Mensal', value: stripeMonthlyRev, color: COLORS.stripe_monthly },
    { name: 'Stripe Anual', value: stripeAnnualRev, color: COLORS.stripe_annual },
    ...(stripeOtherRev > 0 ? [{ name: 'Stripe Avulso', value: stripeOtherRev, color: '#a78bfa' }] : []),
    { name: 'Kiwify', value: kiwifyRevenue, color: COLORS.kiwify },
    { name: 'AdSense', value: adsenseRevenue, color: COLORS.adsense },
  ].filter((d) => d.value > 0)

  const typeData = [
    { name: 'Recorrente', value: recurringRevenue, color: COLORS.recurring },
    { name: 'Anual', value: annualRevenue, color: COLORS.annual },
    { name: 'Avulso', value: oneTimeRevenue, color: COLORS.one_time },
  ].filter((d) => d.value > 0)

  const chartData = dailyData.map((d: any) => ({
    date: d.date.slice(5),
    stripe: d.revenue_stripe || 0,
    kiwify: d.revenue_kiwify || 0,
    adsense: d.revenue_adsense || 0,
    total: (d.revenue_stripe || 0) + (d.revenue_kiwify || 0) + (d.revenue_adsense || 0),
  }))

  const avgDaily = totalRevenue / period

  const recentTx = [...transactions]
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 15)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400 dark:text-neutral-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {/* ====================== */}
      {/* MONTHLY P&L SECTION */}
      {/* ====================== */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financeiro</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">P&L mensal e analise de receitas</p>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl min-w-[140px] text-center">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{monthLabel}</span>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Monthly P&L Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <TrendingUp size={18} className="text-emerald-500" />
              </span>
              {revenueChange !== 0 && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${revenueChange > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {revenueChange > 0 ? '+' : ''}{revenueChange.toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-emerald-500">{BRL(monthNetRevenue)}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Receita Liquida</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10">
                <TrendingDown size={18} className="text-red-500" />
              </span>
            </div>
            <p className="text-2xl font-bold text-red-500">{BRL(totalExpenses)}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Gastos Totais</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`p-2 rounded-xl ${lucroLiquido >= 0 ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
                <DollarSign size={18} className={lucroLiquido >= 0 ? 'text-blue-500' : 'text-red-500'} />
              </span>
            </div>
            <p className={`text-2xl font-bold ${lucroLiquido >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {BRL(lucroLiquido)}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Lucro Liquido</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10">
                <Minus size={18} className="text-purple-500" />
              </span>
            </div>
            <p className={`text-2xl font-bold ${margem >= 0 ? 'text-purple-500' : 'text-red-500'}`}>
              {margem.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Margem</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10">
                <RefreshCw size={18} className="text-amber-500" />
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-500">{BRL(monthTotalRefunds)}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Reembolsos</p>
          </div>
        </div>

        {/* P&L Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receitas */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Receitas - {monthLabel}</h3>
            {(() => {
              const stripeMonthly = monthPaidTx.filter((t: any) => t.source === 'stripe' && t.type === 'recurring').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
              const stripeAnnual = monthPaidTx.filter((t: any) => t.source === 'stripe' && t.type === 'annual').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
              const stripeOther = monthPaidTx.filter((t: any) => t.source === 'stripe' && t.type !== 'recurring' && t.type !== 'annual').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
              const stripeTotal = stripeMonthly + stripeAnnual + stripeOther
              const kiwifyTotal = monthPaidTx.filter((t: any) => t.source === 'kiwify').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
              const adsenseTotal = monthPaidTx.filter((t: any) => t.source === 'adsense').reduce((s: number, t: any) => s + Math.abs(t.amount), 0)
              return (
                <div className="space-y-3">
                  {/* Stripe breakdown */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.stripe }} />
                    <span className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Stripe</span>
                  </div>
                  {stripeMonthly > 0 && <PLRow label="  Assinaturas Mensais" value={stripeMonthly} color={COLORS.stripe_monthly} />}
                  {stripeAnnual > 0 && <PLRow label="  Assinaturas Anuais" value={stripeAnnual} color={COLORS.stripe_annual} />}
                  {stripeOther > 0 && <PLRow label="  Vendas Avulsas" value={stripeOther} color={COLORS.one_time} />}
                  {stripeTotal > 0 && <PLRow label="  Subtotal Stripe" value={stripeTotal} color={COLORS.stripe} bold />}

                  {/* Kiwify */}
                  {kiwifyTotal > 0 && (
                    <>
                      <div className="border-t border-gray-100 dark:border-neutral-800/50 pt-2 mt-2" />
                      <PLRow label="Kiwify" value={kiwifyTotal} color={COLORS.kiwify} />
                    </>
                  )}

                  {/* AdSense */}
                  {adsenseTotal > 0 && (
                    <>
                      <div className="border-t border-gray-100 dark:border-neutral-800/50 pt-2 mt-2" />
                      <PLRow label="YouTube AdSense" value={adsenseTotal} color={COLORS.adsense} />
                    </>
                  )}

                  <div className="border-t border-gray-200 dark:border-neutral-800 pt-2">
                    <PLRow label="Receita Bruta" value={monthTotalRevenue} bold />
                  </div>
                  <PLRow label="(-) Reembolsos" value={-monthTotalRefunds} color={COLORS.refund} />
                  <div className="border-t border-gray-200 dark:border-neutral-800 pt-2">
                    <PLRow label="Receita Liquida" value={monthNetRevenue} bold color="#10b981" />
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Despesas */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Despesas - {monthLabel}</h3>
            {monthlyExpenses.length > 0 ? (
              <div className="space-y-3">
                {toolExpenses > 0 && <PLRow label="Ferramentas & Software" value={-toolExpenses} color="#3b82f6" />}
                {salaryExpenses > 0 && <PLRow label="Salarios & Prolabore" value={-salaryExpenses} color="#8b5cf6" />}
                {taxExpenses > 0 && <PLRow label="Impostos" value={-taxExpenses} color="#ef4444" />}
                {otherExpenses > 0 && <PLRow label="Outros" value={-otherExpenses} color="#6b7280" />}
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-2">
                  <PLRow label="Total Despesas" value={-totalExpenses} bold color="#ef4444" />
                </div>
                <div className="border-t-2 border-gray-300 dark:border-neutral-700 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">LUCRO LIQUIDO</span>
                    <span className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {BRL(lucroLiquido)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-neutral-500 text-sm">Nenhum gasto cadastrado para {monthLabel}</p>
                <a href="/gastos" className="text-blue-500 text-sm hover:underline mt-1 inline-block">
                  Cadastrar gastos
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================== */}
      {/* DETAILED PERIOD VIEW */}
      {/* ====================== */}
      <div className="border-t border-gray-200 dark:border-neutral-800 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analise por Periodo</h2>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-white dark:bg-white text-neutral-950 shadow-lg'
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
            label="Receita Total"
            value={BRL(totalRevenue)}
            icon={DollarSign}
            iconBg="bg-emerald-50 dark:bg-emerald-500/10"
            iconColor="text-emerald-500"
            subtitle={`${BRL(avgDaily)}/dia`}
            trend="up"
          />
          <KPICard
            label="Receita Recorrente"
            value={BRL(recurringRevenue + annualRevenue)}
            icon={Repeat}
            iconBg="bg-blue-50 dark:bg-blue-500/10"
            iconColor="text-blue-500"
            subtitle={`${totalRevenue > 0 ? ((recurringRevenue + annualRevenue) / totalRevenue * 100).toFixed(0) : 0}% do total`}
            trend="up"
          />
          <KPICard
            label="Vendas Avulsas"
            value={BRL(oneTimeRevenue)}
            icon={Zap}
            iconBg="bg-amber-50 dark:bg-amber-500/10"
            iconColor="text-amber-500"
            subtitle={`${paidTx.filter((t: any) => t.type === 'one_time').length} transacoes`}
          />
          <KPICard
            label="Reembolsos"
            value={BRL(totalRefunds)}
            icon={TrendingDown}
            iconBg="bg-red-50 dark:bg-red-500/10"
            iconColor="text-red-500"
            subtitle={`${totalRevenue > 0 ? (totalRefunds / totalRevenue * 100).toFixed(1) : 0}% da receita`}
            trend="down"
          />
        </div>
      </div>

      {/* Revenue Chart + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Receita Diaria</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.stripe }} />
                Stripe
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.kiwify }} />
                Kiwify
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.adsense }} />
                AdSense
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
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-3">Receita Liquida</p>
            <p className={`text-3xl font-bold ${netRevenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {BRL(netRevenue)}
            </p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">Stripe</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.stripe }}>{BRL(stripeRevenue)}</p>
            <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400 dark:text-neutral-500">
              {stripeMonthlyRev > 0 && <span>Mensal: {BRL(stripeMonthlyRev)}</span>}
              {stripeAnnualRev > 0 && <span>Anual: {BRL(stripeAnnualRev)}</span>}
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${totalRevenue > 0 ? (stripeRevenue / totalRevenue * 100) : 0}%`, backgroundColor: COLORS.stripe }} />
            </div>
          </div>
          <div className="card p-5">
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">Kiwify</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.kiwify }}>{BRL(kiwifyRevenue)}</p>
            <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${totalRevenue > 0 ? (kiwifyRevenue / totalRevenue * 100) : 0}%`, backgroundColor: COLORS.kiwify }} />
            </div>
          </div>
          {adsenseRevenue > 0 && (
            <div className="card p-5">
              <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">YouTube AdSense</p>
              <p className="text-2xl font-bold" style={{ color: COLORS.adsense }}>{BRL(adsenseRevenue)}</p>
              <div className="mt-2 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${totalRevenue > 0 ? (adsenseRevenue / totalRevenue * 100) : 0}%`, backgroundColor: COLORS.adsense }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Receita por Fonte</h2>
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
                      <p className="text-xs text-gray-500 dark:text-neutral-500">{totalRevenue > 0 ? (d.value / totalRevenue * 100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">Sem dados no periodo</p>}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tipo de Receita</h2>
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
                      <p className="text-xs text-gray-500 dark:text-neutral-500">{totalRevenue > 0 ? (d.value / totalRevenue * 100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">Sem dados no periodo</p>}
        </div>
      </div>

      {/* Products */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Receita por Produto</h2>
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
        ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">Sem dados no periodo</p>}
      </div>

      {/* Recent Transactions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transacoes Recentes</h2>
        {recentTx.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-neutral-500 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-2">Data</th>
                  <th className="text-left py-3 px-2">Produto</th>
                  <th className="text-left py-3 px-2">Fonte</th>
                  <th className="text-left py-3 px-2">Tipo</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-right py-3 px-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((tx: any) => (
                  <tr key={tx.transaction_id} className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-2 text-gray-500 dark:text-neutral-400">
                      {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-3 px-2 max-w-[200px] truncate text-gray-900 dark:text-white" title={tx.product_name}>
                      {tx.product_name || '\u2014'}
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: tx.source === 'stripe' ? COLORS.stripe + '20' : COLORS.kiwify + '20', color: tx.source === 'stripe' ? COLORS.stripe : COLORS.kiwify }}>
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
        ) : <p className="text-gray-500 dark:text-neutral-500 text-sm">Nenhuma transacao no periodo</p>}
      </div>
    </div>
  )
}

// --- Sub Components ---

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

function KPICard({ label, value, icon: Icon, iconBg, iconColor, subtitle, trend }: {
  label: string; value: string; icon: any; iconBg: string; iconColor: string; subtitle?: string; trend?: 'up' | 'down'
}) {
  return (
    <div className="card p-5 hover:border-gray-200 dark:hover:border-neutral-700/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-xl ${iconBg}`}><Icon size={18} className={iconColor} /></span>
        {trend === 'up' && <ArrowUpRight size={16} className="text-emerald-500" />}
        {trend === 'down' && <ArrowDownRight size={16} className="text-red-500" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    recurring: { label: 'Recorrente', color: COLORS.recurring },
    annual: { label: 'Anual', color: COLORS.annual },
    one_time: { label: 'Avulso', color: COLORS.one_time },
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
