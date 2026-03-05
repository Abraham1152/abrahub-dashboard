import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/stores/themeStore'
import { supabase } from '@/integrations/supabase'
import { BarChart2, TrendingUp, Tag, AlertCircle, MousePointerClick, Mail } from 'lucide-react'

type Tx = {
  date: string
  amount: number
  source: string
  product_name: string
  customer_email: string | null
  metadata: Record<string, unknown>
}

type Click = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  ref: string | null
  clicked_at: string
}

type EmailCapture = {
  email: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  ref: string | null
  captured_at: string
}

const DAYS_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
  { label: 'Tudo', value: 0 },
]

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(part: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function getUtm(meta: Record<string, unknown>, key: string): string {
  return (meta?.[key] as string) || ''
}

type Row = { key: string; count: number; revenue: number; clicks: number; captures: number }

function FunnelTable({ rows, label }: { rows: Row[]; label: string }) {
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-400 dark:text-neutral-500 border-b border-gray-100 dark:border-neutral-800">
          <th className="pb-2 font-medium">{label}</th>
          <th className="pb-2 font-medium text-right">Cliques</th>
          <th className="pb-2 font-medium text-right">Cadastros</th>
          <th className="pb-2 font-medium text-right">Vendas</th>
          <th className="pb-2 font-medium text-right">Receita</th>
          <th className="pb-2 font-medium text-right">Conv.</th>
          <th className="pb-2 font-medium text-right">% Rec.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/40">
            <td className="py-2 text-gray-800 dark:text-neutral-200 font-medium max-w-[140px] truncate">
              {r.key || <span className="text-gray-400 italic">(sem dado)</span>}
            </td>
            <td className="py-2 text-right text-blue-600 dark:text-blue-400 font-medium">
              {r.clicks > 0 ? r.clicks : <span className="text-gray-300 dark:text-neutral-700">—</span>}
            </td>
            <td className="py-2 text-right text-amber-600 dark:text-amber-400 font-medium">
              {r.captures > 0 ? r.captures : <span className="text-gray-300 dark:text-neutral-700">—</span>}
            </td>
            <td className="py-2 text-right text-gray-500 dark:text-neutral-400">{r.count}</td>
            <td className="py-2 text-right text-gray-900 dark:text-white font-semibold">{fmt(r.revenue)}</td>
            <td className="py-2 text-right">
              {r.clicks > 0
                ? <span className={`font-medium ${r.count / r.clicks >= 0.05 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-neutral-400'}`}>
                    {pct(r.count, r.clicks)}
                  </span>
                : <span className="text-gray-300 dark:text-neutral-700">—</span>
              }
            </td>
            <td className="py-2 text-right text-gray-400 dark:text-neutral-500">{pct(r.revenue, totalRevenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GroupTable({ rows, label }: { rows: Row[]; label: string }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-400 dark:text-neutral-500 border-b border-gray-100 dark:border-neutral-800">
          <th className="pb-2 font-medium">{label}</th>
          <th className="pb-2 font-medium text-right">Transações</th>
          <th className="pb-2 font-medium text-right">Receita</th>
          <th className="pb-2 font-medium text-right">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/40">
            <td className="py-2 text-gray-800 dark:text-neutral-200 font-medium max-w-[180px] truncate">
              {r.key || <span className="text-gray-400 italic">(sem dado)</span>}
            </td>
            <td className="py-2 text-right text-gray-500 dark:text-neutral-400">{r.count}</td>
            <td className="py-2 text-right text-gray-900 dark:text-white font-semibold">{fmt(r.revenue)}</td>
            <td className="py-2 text-right text-gray-400 dark:text-neutral-500">{pct(r.revenue, total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function UTMAnalyticsPage() {
  useTheme()
  const [days, setDays] = useState(30)
  const [tab, setTab] = useState<'funil' | 'source' | 'campaign' | 'content' | 'leads' | 'txs'>('funil')

  const startDate = useMemo(() => {
    if (!days) return null
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
  }, [days])

  const { data: transactions = [], isLoading: loadingTx } = useQuery<Tx[]>({
    queryKey: ['utm-analytics', startDate],
    queryFn: async () => {
      let q = supabase
        .from('revenue_transactions')
        .select('date, amount, source, product_name, customer_email, metadata')
        .gt('amount', 0)
        .eq('status', 'paid')
        .order('date', { ascending: false })
      if (startDate) q = q.gte('date', startDate)
      const { data } = await q
      return (data || []) as Tx[]
    },
  })

  const { data: clicks = [], isLoading: loadingClicks } = useQuery<Click[]>({
    queryKey: ['utm-clicks', startDate],
    queryFn: async () => {
      let q = supabase
        .from('utm_link_clicks')
        .select('utm_source, utm_medium, utm_campaign, utm_content, utm_term, ref, clicked_at')
        .order('clicked_at', { ascending: false })
      if (startDate) q = q.gte('clicked_at', startDate)
      const { data } = await q
      return (data || []) as Click[]
    },
  })

  const { data: emailCaptures = [], isLoading: loadingCaptures } = useQuery<EmailCapture[]>({
    queryKey: ['utm-email-captures', startDate],
    queryFn: async () => {
      let q = supabase
        .from('utm_email_captures')
        .select('email, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ref, captured_at')
        .order('captured_at', { ascending: false })
      if (startDate) q = q.gte('captured_at', startDate)
      const { data } = await q
      return (data || []) as EmailCapture[]
    },
  })

  const isLoading = loadingTx || loadingClicks || loadingCaptures

  function clicksByKey(key: keyof Click): Map<string, number> {
    const map = new Map<string, number>()
    for (const c of clicks) {
      const k = (c[key] as string) || ''
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }

  function capturesByKey(key: keyof EmailCapture): Map<string, number> {
    const map = new Map<string, number>()
    for (const c of emailCaptures) {
      const k = (c[key] as string) || ''
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }

  const clicksSource      = clicksByKey('utm_source')
  const clicksCampaign    = clicksByKey('utm_campaign')
  const clicksContent     = clicksByKey('utm_content')
  const clicksMedium      = clicksByKey('utm_medium')

  const capturesSource    = capturesByKey('utm_source')
  const capturesCampaign  = capturesByKey('utm_campaign')
  const capturesContent   = capturesByKey('utm_content')
  const capturesMedium    = capturesByKey('utm_medium')

  const tracked = transactions.filter(t => getUtm(t.metadata, 'utm_source'))
  const untracked = transactions.filter(t => !getUtm(t.metadata, 'utm_source'))
  const totalRevenue = transactions.reduce((s, t) => s + t.amount, 0)
  const trackedRevenue = tracked.reduce((s, t) => s + t.amount, 0)
  const untrackedRevenue = untracked.reduce((s, t) => s + t.amount, 0)
  const totalClicks = clicks.length
  const totalCaptures = emailCaptures.length

  function groupBy(
    utmKey: string,
    clickMap: Map<string, number>,
    captureMap: Map<string, number>,
  ): Row[] {
    const map = new Map<string, Row>()
    for (const t of tracked) {
      const k = getUtm(t.metadata, utmKey)
      const cur = map.get(k) || { key: k, count: 0, revenue: 0, clicks: clickMap.get(k) || 0, captures: captureMap.get(k) || 0 }
      cur.count++
      cur.revenue += t.amount
      map.set(k, cur)
    }
    // Add keys that have clicks or captures but no sales yet
    for (const [k, c] of clickMap.entries()) {
      if (!map.has(k)) map.set(k, { key: k, count: 0, revenue: 0, clicks: c, captures: captureMap.get(k) || 0 })
    }
    for (const [k, c] of captureMap.entries()) {
      if (!map.has(k)) map.set(k, { key: k, count: 0, revenue: 0, clicks: clickMap.get(k) || 0, captures: c })
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.captures - a.captures || b.clicks - a.clicks)
  }

  const bySource   = groupBy('utm_source',   clicksSource,   capturesSource)
  const byCampaign = groupBy('utm_campaign', clicksCampaign, capturesCampaign)
  const byContent  = groupBy('utm_content',  clicksContent,  capturesContent)
  const byMedium   = groupBy('utm_medium',   clicksMedium,   capturesMedium)

  const TABS = [
    { id: 'funil',    label: 'Funil' },
    { id: 'source',   label: 'Por Origem' },
    { id: 'campaign', label: 'Por Campanha' },
    { id: 'content',  label: 'Por Conteúdo' },
    { id: 'leads',    label: 'Leads' },
    { id: 'txs',      label: 'Transações' },
  ] as const

  const convRate = totalClicks > 0 ? pct(tracked.length, totalClicks) : '—'
  const captureRate = totalClicks > 0 ? pct(totalCaptures, totalClicks) : '—'

  const hasData = totalClicks > 0 || tracked.length > 0 || totalCaptures > 0

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center">
            <BarChart2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">UTM Analytics</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm">Cliques, cadastros, vendas e funil por origem de tráfego</p>
          </div>
        </div>

        {/* Date range */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-neutral-800 rounded-xl">
          {DAYS_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setDays(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === o.value
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400 dark:text-neutral-600 text-sm">Carregando...</div>
      )}

      {!isLoading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-1">Cliques rastreados</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalClicks}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">visitas com UTM</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-1">Cadastros</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totalCaptures}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{captureRate} dos cliques</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-1">Vendas rastreadas</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{tracked.length}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{fmt(trackedRevenue)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-1">Sem tracking</p>
              <p className="text-xl font-bold text-gray-500 dark:text-neutral-400">{fmt(untrackedRevenue)}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{untracked.length} vendas · {pct(untrackedRevenue, totalRevenue)}</p>
            </div>
          </div>

          {!hasData && (
            <div className="card p-6 flex items-center gap-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <AlertCircle size={18} className="flex-shrink-0" />
              <p>Nenhum dado rastreado neste período. Use o <strong>Gerador de Links</strong> para criar links com UTMs — cliques, cadastros e vendas vão aparecer aqui automaticamente.</p>
            </div>
          )}

          {hasData && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-200 dark:border-neutral-700 overflow-x-auto">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                      tab === t.id
                        ? 'border-violet-600 text-violet-600 dark:text-violet-400 dark:border-violet-400'
                        : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    {t.label}
                    {t.id === 'leads' && totalCaptures > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                        {totalCaptures}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab: Funil */}
              {tab === 'funil' && (
                <div className="space-y-4">
                  {/* Mini funil visual — 3 etapas */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MousePointerClick size={15} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Funil geral</h3>
                    </div>
                    <div className="space-y-2">
                      {/* Cliques */}
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-xs text-gray-500 dark:text-neutral-400 text-right flex-shrink-0">Cliques</div>
                        <div className="flex-1 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center px-3">
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{totalClicks}</span>
                        </div>
                        <div className="w-12 text-xs text-gray-400 dark:text-neutral-500 text-right">100%</div>
                      </div>
                      {/* Cadastros */}
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-xs text-gray-500 dark:text-neutral-400 text-right flex-shrink-0">Cadastros</div>
                        <div
                          className="flex-1 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-lg flex items-center px-3"
                          style={{ maxWidth: totalClicks > 0 ? `${Math.max(8, (totalCaptures / totalClicks) * 100)}%` : totalCaptures > 0 ? '60%' : '8%' }}
                        >
                          <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{totalCaptures}</span>
                        </div>
                        <div className="w-12 text-xs text-gray-400 dark:text-neutral-500 text-right">{captureRate}</div>
                      </div>
                      {/* Vendas */}
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-xs text-gray-500 dark:text-neutral-400 text-right flex-shrink-0">Vendas</div>
                        <div
                          className="flex-1 h-8 bg-green-100 dark:bg-green-500/20 rounded-lg flex items-center px-3"
                          style={{ maxWidth: totalClicks > 0 ? `${Math.max(4, (tracked.length / totalClicks) * 100)}%` : tracked.length > 0 ? '20%' : '4%' }}
                        >
                          <span className="text-sm font-bold text-green-700 dark:text-green-300">{tracked.length}</span>
                        </div>
                        <div className="w-12 text-xs text-gray-400 dark:text-neutral-500 text-right">{convRate}</div>
                      </div>
                    </div>
                  </div>

                  {/* Funil por origem */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cliques → Cadastros → Vendas por Origem</h3>
                      <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto">Conv. verde = ≥5%</span>
                    </div>
                    {bySource.length === 0
                      ? <p className="text-xs text-gray-400 dark:text-neutral-600 py-4 text-center">Nenhum dado ainda.</p>
                      : <FunnelTable rows={bySource} label="Origem" />
                    }
                  </div>

                  {/* Funil por campanha */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={15} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cliques → Cadastros → Vendas por Campanha</h3>
                    </div>
                    {byCampaign.filter(r => r.key).length === 0
                      ? <p className="text-xs text-gray-400 dark:text-neutral-600 py-4 text-center">Nenhuma campanha encontrada.</p>
                      : <FunnelTable rows={byCampaign.filter(r => r.key)} label="Campanha" />
                    }
                  </div>
                </div>
              )}

              {/* Tab: Por Origem */}
              {tab === 'source' && (
                <div className="space-y-4">
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Origem (utm_source)</h3>
                    </div>
                    <GroupTable rows={bySource} label="Origem" />
                  </div>
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Tag size={15} className="text-violet-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Formato (utm_medium)</h3>
                    </div>
                    <GroupTable rows={byMedium} label="Formato" />
                  </div>
                </div>
              )}

              {/* Tab: Por Campanha */}
              {tab === 'campaign' && (
                <div className="card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={15} className="text-violet-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Campanhas (utm_campaign)</h3>
                  </div>
                  {byCampaign.filter(r => r.key).length === 0
                    ? <p className="text-xs text-gray-400 dark:text-neutral-600 py-4 text-center">Nenhuma campanha encontrada. Adicione utm_campaign nos seus links.</p>
                    : <GroupTable rows={byCampaign.filter(r => r.key)} label="Campanha" />
                  }
                </div>
              )}

              {/* Tab: Por Conteúdo */}
              {tab === 'content' && (
                <div className="card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Tag size={15} className="text-violet-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Conteúdo (utm_content)</h3>
                  </div>
                  {byContent.filter(r => r.key).length === 0
                    ? <p className="text-xs text-gray-400 dark:text-neutral-600 py-4 text-center">Nenhum conteúdo encontrado. Adicione utm_content nos seus links para identificar vídeos/posts específicos.</p>
                    : <GroupTable rows={byContent.filter(r => r.key)} label="Conteúdo" />
                  }
                </div>
              )}

              {/* Tab: Leads */}
              {tab === 'leads' && (
                <div className="card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="text-amber-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cadastros rastreados ({totalCaptures})</h3>
                    <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto">email + UTMs capturados no formulário</span>
                  </div>
                  {totalCaptures === 0
                    ? <p className="text-xs text-gray-400 dark:text-neutral-600 py-8 text-center">Nenhum cadastro ainda. Quando alguém preencher o formulário com UTMs rastreados, aparecerá aqui.</p>
                    : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-400 dark:text-neutral-500 border-b border-gray-100 dark:border-neutral-800">
                              <th className="pb-2 font-medium">Data</th>
                              <th className="pb-2 font-medium">Email</th>
                              <th className="pb-2 font-medium">Source</th>
                              <th className="pb-2 font-medium">Medium</th>
                              <th className="pb-2 font-medium">Campaign</th>
                              <th className="pb-2 font-medium">Ref</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emailCaptures.map((c, i) => (
                              <tr key={i} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/40">
                                <td className="py-1.5 text-gray-500 dark:text-neutral-500 whitespace-nowrap">
                                  {new Date(c.captured_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-1.5 text-gray-700 dark:text-neutral-300 max-w-[180px] truncate">{c.email}</td>
                                <td className="py-1.5">
                                  {c.utm_source && (
                                    <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-medium">
                                      {c.utm_source}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5">
                                  {c.utm_medium && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium">
                                      {c.utm_medium}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5">
                                  {c.utm_campaign && (
                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium">
                                      {c.utm_campaign}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 text-gray-400 dark:text-neutral-500">{c.ref || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              )}

              {/* Tab: Transações */}
              {tab === 'txs' && (
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transações rastreadas ({tracked.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-400 dark:text-neutral-500 border-b border-gray-100 dark:border-neutral-800">
                          <th className="pb-2 font-medium">Data</th>
                          <th className="pb-2 font-medium">Produto</th>
                          <th className="pb-2 font-medium text-right">Valor</th>
                          <th className="pb-2 font-medium">Source</th>
                          <th className="pb-2 font-medium">Medium</th>
                          <th className="pb-2 font-medium">Campaign</th>
                          <th className="pb-2 font-medium">Content</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tracked.map((t, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/40">
                            <td className="py-1.5 text-gray-500 dark:text-neutral-500 whitespace-nowrap">{t.date}</td>
                            <td className="py-1.5 text-gray-700 dark:text-neutral-300 max-w-[150px] truncate">{t.product_name || '-'}</td>
                            <td className="py-1.5 text-right text-gray-900 dark:text-white font-semibold whitespace-nowrap">{fmt(t.amount)}</td>
                            <td className="py-1.5">
                              {getUtm(t.metadata, 'utm_source') && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-medium">
                                  {getUtm(t.metadata, 'utm_source')}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5">
                              {getUtm(t.metadata, 'utm_medium') && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-medium">
                                  {getUtm(t.metadata, 'utm_medium')}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5">
                              {getUtm(t.metadata, 'utm_campaign') && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-medium">
                                  {getUtm(t.metadata, 'utm_campaign')}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5">
                              {getUtm(t.metadata, 'utm_content') && (
                                <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 font-medium">
                                  {getUtm(t.metadata, 'utm_content')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
