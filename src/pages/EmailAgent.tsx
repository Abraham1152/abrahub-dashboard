import { useState, useEffect, useCallback } from 'react'
import { Mail, CheckCircle2, Clock, Bot, CreditCard, ChevronDown, ChevronUp, Monitor, AlertCircle, History, X } from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jdodenbjohnqvhvldfqu.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const TIPOS: Record<string, { key: string; color: string }> = {
  REEMBOLSO:    { key: 'emailagent.refund',        color: '#ef4444' },
  ACESSO_CURSO: { key: 'emailagent.course_access',  color: '#3b82f6' },
  PAGAMENTO:    { key: 'emailagent.payment_pix',    color: '#10b981' },
  RECLAMACAO:   { key: 'emailagent.complaint',      color: '#a855f7' },
  DUVIDA:       { key: 'emailagent.question',       color: '#6b7280' },
  OUTRO:        { key: 'emailagent.other',          color: '#6b7280' },
}

function getTipo(tipo: string) {
  return TIPOS[tipo] || { key: tipo, color: '#6b7280' }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Task {
  id: number
  created_at: string
  email_from: string
  email_subject: string
  tipo: string
  description: string
  email_sent: string
  precisa_acao: boolean
  status: string
  history_count?: number
}

interface Feedback {
  id: number
  created_at: string
  email_from: string
  motivo: string
  feedback: string
}

interface Stats {
  total: number
  pending: number
  auto: number
  done: number
}

interface StripeAnalysis {
  encontrado: boolean
  elegivel?: boolean
  cliente_id?: string
  cobranca_id?: string
  assinatura_id?: string
  tem_assinatura?: boolean
  nome?: string
  email?: string
  produto?: string
  valor?: number
  moeda?: string
  data_compra?: string
  dias_passados?: number
  prazo_dias?: number
  motivo_inelegivel?: string
  motivo?: string
}

async function apiCall(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/email-agent${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// ─── Badge Component ────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: string }) {
  const { t } = useTranslation()
  const tipoInfo = getTipo(tipo)
  return (
    <span
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: tipoInfo.color + '22', color: tipoInfo.color }}
    >
      {t(tipoInfo.key)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === 'pending') {
    return (
      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 whitespace-nowrap flex items-center gap-1">
        <Clock size={12} />
        {t('emailagent.pending_status')}
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 whitespace-nowrap flex items-center gap-1">
        <CheckCircle2 size={12} />
        {t('emailagent.done_status')}
      </span>
    )
  }
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 whitespace-nowrap flex items-center gap-1">
      <Bot size={12} />
      {t('emailagent.auto_status')}
    </span>
  )
}

// ─── Email Card ─────────────────────────────────────────────────────
function EmailCard({ task, onDone, onRefund, onViewHistory }: {
  task: Task
  onDone: (id: number) => void
  onRefund: (id: number, cobrancaId: string, assinaturaId?: string) => void
  onViewHistory: (email: string) => void
}) {
  const { t } = useTranslation()
  const tipoInfo = getTipo(task.tipo)
  const [expanded, setExpanded] = useState(false)
  const [analysis, setAnalysis] = useState<StripeAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const isPending = task.status === 'pending'

  const handleAnalyze = async () => {
    setAnalyzing(true)
    const data = await apiCall(`/analisar/${task.id}`)
    setAnalyzing(false)
    if (data.sucesso) {
      setAnalysis(data.analise)
    }
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border overflow-hidden shadow-sm ${
      isPending
        ? 'border-amber-300 dark:border-amber-500/30'
        : 'border-gray-200 dark:border-neutral-800'
    }`}>
      <div className="p-5" style={{ borderLeft: `4px solid ${tipoInfo.color}` }}>
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <TipoBadge tipo={task.tipo} />
          <StatusBadge status={task.status} />
          {(task.history_count ?? 0) > 0 && (
            <button
              onClick={() => onViewHistory(task.email_from)}
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors"
            >
              <History size={11} />
              {task.history_count} {t('emailagent.previous')}
            </button>
          )}
          <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto">{formatTime(task.created_at)}</span>
        </div>

        {/* Sender + Subject */}
        <p className="font-semibold text-gray-800 dark:text-white text-sm">{task.email_from}</p>
        <p className="text-gray-500 dark:text-neutral-400 text-sm mb-3">"{task.email_subject}"</p>

        {/* Action needed highlight */}
        {isPending && task.description && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
              <AlertCircle size={13} />
              {t('emailagent.action_needed')}
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-300">{task.description}</p>
          </div>
        )}

        {/* Expand to see response */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? t('emailagent.hide_reply') : t('emailagent.show_reply')}
        </button>

        {expanded && (
          <div className="mt-3 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4 text-sm text-gray-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
            {task.email_sent || t('emailagent.no_reply')}
          </div>
        )}

        {/* Stripe Analysis Area */}
        {task.tipo === 'REEMBOLSO' && analysis && (
          <div className={`border rounded-lg p-4 text-sm space-y-1 mt-3 ${
            analysis.encontrado && analysis.elegivel
              ? 'border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10'
              : 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10'
          }`}>
            {!analysis.encontrado ? (
              <p className="text-red-700 dark:text-red-400">{analysis.motivo}</p>
            ) : (
              <>
                <p className={`font-bold mb-2 ${analysis.elegivel ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                  {analysis.elegivel
                    ? `${t('emailagent.eligible')} ${analysis.dias_passados} ${t('emailagent.days_within')}`
                    : `${t('emailagent.expired')} ${analysis.dias_passados} ${t('emailagent.days_max')} ${analysis.prazo_dias} ${t('emailagent.days_close')}`
                  }
                </p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">{t('emailagent.client')}</span> {analysis.nome}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">{t('emailagent.product')}</span> {analysis.produto}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">{t('emailagent.amount')}</span> {analysis.moeda} {analysis.valor?.toFixed(2)}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">{t('emailagent.purchased_at')}</span> {analysis.data_compra}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">{t('emailagent.active_sub')}</span> {analysis.tem_assinatura ? t('emailagent.will_cancel') : t('emailagent.no_label')}</p>
                {analysis.elegivel && (
                  <div className="pt-3 border-t border-green-200 dark:border-green-500/20 mt-3">
                    <p className="text-xs text-green-700 dark:text-green-400 mb-2">
                      {t('emailagent.confirm_refund_msg')} {analysis.moeda} {analysis.valor?.toFixed(2)} {t('emailagent.plus')} {analysis.tem_assinatura ? t('emailagent.cancel_sub') : t('emailagent.no_sub_cancel')}.
                    </p>
                    <button
                      onClick={() => {
                        if (confirm(t('emailagent.irreversible'))) {
                          onRefund(task.id, analysis.cobranca_id!, analysis.assinatura_id || undefined)
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm px-5 py-2 rounded-lg font-semibold transition-colors w-full"
                    >
                      {t('emailagent.confirm_refund')}
                    </button>
                  </div>
                )}
                {!analysis.elegivel && (
                  <p className="text-xs text-red-700 dark:text-red-400 pt-2">{analysis.motivo_inelegivel}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Action Buttons for pending */}
        {isPending && (
          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
            {task.tipo === 'REEMBOLSO' ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <CreditCard size={16} />
                {analyzing ? t('emailagent.consulting') : t('emailagent.analyze_stripe')}
              </button>
            ) : <div />}
            <button
              onClick={() => onDone(task.id)}
              className="flex items-center gap-2 border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <CheckCircle2 size={16} />
              {t('emailagent.mark_done')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function EmailAgentPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'emails' | 'feedbacks'>('emails')
  const [tasks, setTasks] = useState<Task[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, auto: 0, done: 0 })
  const [period, setPeriod] = useState(0)
  const [historyEmail, setHistoryEmail] = useState<string | null>(null)
  const [historyTasks, setHistoryTasks] = useState<Task[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadTasks = useCallback(async () => {
    try {
      const data = await apiCall(`/tasks?days=${period}`)
      if (data.tasks) setTasks(data.tasks)
      if (data.stats) setStats(data.stats)
    } catch { /* ignore */ }
  }, [period])

  const viewHistory = useCallback(async (email: string) => {
    const clean = email.includes('<') ? email.split('<')[1].replace('>', '').trim() : email.trim()
    setHistoryEmail(clean)
    setLoadingHistory(true)
    try {
      const data = await apiCall(`/history/${encodeURIComponent(clean)}`)
      setHistoryTasks(data.history || [])
    } catch { /* ignore */ }
    setLoadingHistory(false)
  }, [])

  const loadFeedbacks = useCallback(async () => {
    try {
      const data = await apiCall('/feedbacks')
      if (data.feedbacks) setFeedbacks(data.feedbacks)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadTasks()
    loadFeedbacks()
    const interval = setInterval(loadTasks, 60000)
    return () => clearInterval(interval)
  }, [loadTasks, loadFeedbacks, period])

  const handleDone = async (id: number) => {
    await apiCall(`/done/${id}`, 'POST')
    loadTasks()
  }

  const handleRefund = async (id: number, cobrancaId: string, assinaturaId?: string) => {
    await apiCall(`/reembolsar/${id}`, 'POST', {
      cobranca_id: cobrancaId,
      assinatura_id: assinaturaId || null,
    })
    loadTasks()
  }

  const pending = tasks.filter(task => task.status === 'pending')

  const statCards = [
    { label: t('emailagent.emails_today'), value: stats.total, icon: Mail, color: 'text-gray-700 dark:text-white' },
    { label: t('emailagent.pending'), value: stats.pending, icon: Clock, color: 'text-amber-500' },
    { label: t('emailagent.auto_replied'), value: stats.auto, icon: Bot, color: 'text-blue-500' },
    { label: t('emailagent.completed'), value: stats.done, icon: CheckCircle2, color: 'text-green-500' },
  ]

  const tabs = [
    { key: 'emails' as const, label: t('emailagent.processed_tab'), badge: pending.length },
    { key: 'feedbacks' as const, label: t('emailagent.feedback_tab'), badge: feedbacks.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Mail size={28} />
            {t('emailagent.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            {t('emailagent.subtitle')}
          </p>
        </div>
      </div>

      {/* Agent Status Notice */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Monitor size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {t('emailagent.local_agent')}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {t('emailagent.local_desc')} <span className="font-mono">localhost:8000</span>.
            {' '}{t('emailagent.realtime_desc')}
          </p>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
        {[
          { value: 0, label: t('emailagent.today') },
          { value: 7, label: t('emailagent.last_7d') },
          { value: 30, label: t('emailagent.last_30d') },
        ].map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-gray-200 dark:border-neutral-800 text-center">
            <s.icon size={20} className={`mx-auto mb-2 ${s.color}`} />
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => {
              setTab(tabItem.key)
              if (tabItem.key === 'feedbacks') loadFeedbacks()
            }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === tabItem.key
                ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300'
            }`}
          >
            {tabItem.label}
            {tabItem.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full text-white ${
                tabItem.key === 'feedbacks' ? 'bg-purple-500' : 'bg-amber-500'
              }`}>
                {tabItem.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'emails' && (
        <div className="space-y-3">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <EmailCard
                key={task.id}
                task={task}
                onDone={handleDone}
                onRefund={handleRefund}
                onViewHistory={viewHistory}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <Mail size={40} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
              <p className="text-sm text-gray-400 dark:text-neutral-500">
                {t('emailagent.no_emails')}
              </p>
              <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">
                {t('emailagent.agent_auto')}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'feedbacks' && (
        <div className="space-y-3">
          {feedbacks.length > 0 ? (
            feedbacks.map((f) => (
              <FeedbackCard key={f.id} feedback={f} />
            ))
          ) : (
            <div className="text-center py-12">
              <Mail size={40} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
              <p className="text-sm text-gray-400 dark:text-neutral-500">
                {t('emailagent.no_feedbacks')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* History Slide-Over */}
      {historyEmail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryEmail(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History size={18} />
                  {t('emailagent.history_title')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{historyEmail}</p>
              </div>
              <button onClick={() => setHistoryEmail(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {loadingHistory ? (
                <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-8">{t('emailagent.loading')}...</p>
              ) : historyTasks.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-8">{t('emailagent.no_history')}</p>
              ) : (
                historyTasks.map((ht) => (
                  <div key={ht.id} className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <TipoBadge tipo={ht.tipo} />
                      <StatusBadge status={ht.status} />
                      <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto">{formatDateTime(ht.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">"{ht.email_subject}"</p>
                    {ht.email_sent && (
                      <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-xs text-gray-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {ht.email_sent}
                      </div>
                    )}
                    {ht.description && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">{ht.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feedback Card ──────────────────────────────────────────────────
function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-purple-100 dark:border-purple-500/20 overflow-hidden shadow-sm">
      <div className="p-5" style={{ borderLeft: '4px solid #a855f7' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: '#a855f722', color: '#a855f7' }}>
            {t('emailagent.feedback')}
          </span>
          <span className="text-xs text-gray-400 dark:text-neutral-500">{formatDateTime(feedback.created_at)}</span>
        </div>
        <p className="font-semibold text-gray-800 dark:text-white">{feedback.email_from}</p>
        {feedback.motivo && (
          <p className="text-sm text-purple-700 dark:text-purple-400 font-medium mt-1 mb-3">{feedback.motivo}</p>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 mt-2"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? t('emailagent.hide_full') : t('emailagent.show_full')}
        </button>
        {expanded && (
          <div className="mt-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-xs text-gray-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
            {feedback.feedback}
          </div>
        )}
      </div>
    </div>
  )
}
