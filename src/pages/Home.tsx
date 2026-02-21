import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useState, useRef, useEffect } from 'react'
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
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Bot,
  Send,
  Sparkles,
} from 'lucide-react'

export default function HomePage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const { data: financialData = [] } = useQuery({
    queryKey: ['financial-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data } = await supabase
        .from('financial_daily')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true })
      return data || []
    },
  })

  const { data: churnData } = useQuery({
    queryKey: ['churn-metrics'],
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

  const totalRevenue = financialData.reduce((sum, d) => sum + d.revenue_stripe + d.revenue_kiwify, 0)
  const totalRefunds = financialData.reduce((sum, d) => sum + d.refunds, 0)
  const netRevenue = totalRevenue - totalRefunds
  const avgDaily = totalRevenue / 30

  const chartData = financialData.map((d) => ({
    date: d.date.slice(5),
    stripe: d.revenue_stripe,
    kiwify: d.revenue_kiwify,
    total: d.revenue_stripe + d.revenue_kiwify,
  }))

  const churnRate = churnData?.churn_percentage || 0
  const isChurnHigh = churnRate > 5

  const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const tooltipStyle = {
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  }

  const questions = [
    { q: 'Estamos ganhando dinheiro?', ok: netRevenue > 0, answer: netRevenue > 0 ? `Sim (${BRL(netRevenue)})` : 'Nao' },
    { q: 'Estamos crescendo?', ok: avgDaily > 0, answer: avgDaily > 0 ? `Sim (${BRL(avgDaily)}/dia)` : 'Nao' },
    { q: 'Perdendo clientes?', ok: !isChurnHigh, answer: isChurnHigh ? `Sim (${churnRate.toFixed(1)}%)` : `Nao (${churnRate.toFixed(1)}%)` },
    { q: 'Risco no caixa?', ok: true, answer: 'Nao' },
    { q: 'Acao necessaria?', ok: !isChurnHigh, answer: isChurnHigh ? 'Revisar churn' : 'Manter crescimento' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centro de Comando</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Visao geral do negocio</p>
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
        <KPICard icon={DollarSign} label="Receita Total" value={BRL(totalRevenue)} sub="Ultimos 30 dias" accent="emerald" trend={avgDaily > 0 ? 'up' : undefined} trendVal={`${BRL(avgDaily)}/dia`} />
        <KPICard icon={TrendingUp} label="Receita Liquida" value={BRL(netRevenue)} sub="Receita - reembolsos" accent="blue" trend={netRevenue > 0 ? 'up' : 'down'} />
        <KPICard icon={Users} label="Churn Rate" value={`${churnRate.toFixed(1)}%`} sub={`${churnData?.total_customers || 0} clientes`} accent={isChurnHigh ? 'amber' : 'emerald'} />
        <KPICard icon={AlertCircle} label="Reembolsos" value={BRL(totalRefunds)} sub={totalRevenue > 0 ? `${(totalRefunds / totalRevenue * 100).toFixed(1)}% da receita` : ''} accent={totalRefunds > 0 ? 'red' : 'gray'} />
      </div>

      {/* Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Receita Diaria</h2>
            <div className="flex gap-4 text-xs text-gray-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-blue-500" /> Stripe</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-emerald-500" /> Kiwify</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="hgS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="hgK" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f3f4f6'} vertical={false} />
              <XAxis dataKey="date" stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={isDark ? '#52525b' : '#9ca3af'} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [BRL(value), name === 'stripe' ? 'Stripe' : 'Kiwify']} />
              <Area type="monotone" dataKey="stripe" stroke="#3b82f6" fill="url(#hgS)" strokeWidth={2} />
              <Area type="monotone" dataKey="kiwify" stroke="#22c55e" fill="url(#hgK)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <SideCard label="Stripe" value={BRL(financialData.reduce((s, d) => s + d.revenue_stripe, 0))} color="blue" pct={totalRevenue > 0 ? financialData.reduce((s, d) => s + d.revenue_stripe, 0) / totalRevenue * 100 : 0} />
          <SideCard label="Kiwify" value={BRL(financialData.reduce((s, d) => s + d.revenue_kiwify, 0))} color="emerald" pct={totalRevenue > 0 ? financialData.reduce((s, d) => s + d.revenue_kiwify, 0) / totalRevenue * 100 : 0} />
          <SideCard label="Liquida" value={BRL(netRevenue)} color="violet" pct={100} />
        </div>
      </div>

      {/* Alerts */}
      {(isChurnHigh || totalRefunds > totalRevenue * 0.1) && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" /> Alertas
          </h2>
          <div className="space-y-3">
            {isChurnHigh && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Churn Elevado</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">{churnRate.toFixed(1)}% (meta: 5%)</p>
                </div>
              </div>
            )}
            {totalRefunds > totalRevenue * 0.1 && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20">
                <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Reembolsos Altos</p>
                  <p className="text-xs text-red-600 dark:text-red-500">{(totalRefunds / totalRevenue * 100).toFixed(1)}% da receita</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Insights Chat */}
      <AIInsightsChat />
    </div>
  )
}

// ==================== AI INSIGHTS CHAT ====================

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

function AIInsightsChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const quickQuestions = [
    'Resumo geral do negocio',
    'Onde posso melhorar?',
    'Analise o churn',
    'Como esta a receita?',
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: text.trim(),
            history: updatedMessages.slice(-10),
          }),
        }
      )
      const data = await res.json()
      const aiMsg: ChatMessage = { role: 'model', text: data.answer || data.error || 'Erro ao processar.' }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: 'Erro de conexao. Tente novamente.' }])
    }
    setLoading(false)
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Consultor IA</h2>
            <p className="text-xs text-gray-400 dark:text-neutral-500">Insights estrategicos baseados nos seus dados</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto min-h-[120px]">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Bot className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-neutral-500">Pergunte sobre o seu negocio</p>
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
            placeholder="Pergunte sobre seus dados..."
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

function KPICard({ icon: Icon, label, value, sub, accent, trend, trendVal }: { icon: any; label: string; value: string; sub: string; accent: string; trend?: 'up' | 'down'; trendVal?: string }) {
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
    </div>
  )
}

function SideCard({ label, value, color, pct }: { label: string; value: string; color: string; pct: number }) {
  const barColors: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500' }
  const txtColors: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', violet: 'text-violet-500' }
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
