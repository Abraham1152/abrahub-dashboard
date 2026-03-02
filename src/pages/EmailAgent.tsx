import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Mail, CheckCircle2, Clock, Bot, CreditCard, ChevronDown, ChevronUp, AlertCircle, History, X, Send, RefreshCw } from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jdodenbjohnqvhvldfqu.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
  email_body?: string
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
  cobranca_id?: string
  assinatura_id?: string
  tem_assinatura?: boolean
  nome?: string
  produto?: string
  valor?: number
  moeda?: string
  data_compra?: string
  dias_passados?: number
  prazo_dias?: number
  motivo_inelegivel?: string
  motivo?: string
}

async function apiCall(path: string, method = 'GET', body?: any, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/email-agent${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ─── Badge Component ─────────────────────────────────────────────────────────
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

// ─── Email Card ──────────────────────────────────────────────────────────────
function EmailCard({ task, onDone, onSend, onRefund, onViewHistory }: {
  task: Task
  onDone: (id: number) => void
  onSend: (id: number, emailSent: string) => Promise<boolean>
  onRefund: (id: number, cobrancaId: string, assinaturaId?: string) => void
  onViewHistory: (email: string) => void
}) {
  const { t } = useTranslation()
  const tipoInfo = getTipo(task.tipo)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [replyExpanded, setReplyExpanded] = useState(task.status !== 'done')
  const [editedReply, setEditedReply] = useState(task.email_sent || '')
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState(false)
  const [analysis, setAnalysis] = useState<StripeAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const isPending = task.status === 'pending'
  const isDone = task.status === 'done'

  const handleAnalyze = async () => {
    setAnalyzing(true)
    const data = await apiCall(`/analisar/${task.id}`)
    setAnalyzing(false)
    if (data.sucesso) {
      setAnalysis(data.analise)
    }
  }

  const handleSend = async () => {
    setSending(true)
    const ok = await onSend(task.id, editedReply)
    setSending(false)
    if (ok) {
      setSentOk(true)
      setTimeout(() => setSentOk(false), 3000)
    }
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border overflow-hidden shadow-sm ${
      isPending
        ? 'border-amber-300 dark:border-amber-500/30'
        : isDone
          ? 'border-gray-200 dark:border-neutral-800 opacity-70'
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

        {/* Action needed */}
        {isPending && task.description && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
              <AlertCircle size={13} />
              {t('emailagent.action_needed')}
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-300">{task.description}</p>
          </div>
        )}

        {/* Received email (collapsible) */}
        {task.email_body && (
          <div className="mb-3">
            <button
              onClick={() => setBodyExpanded(!bodyExpanded)}
              className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 mb-1"
            >
              {bodyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {t('emailagent.received_email')}
            </button>
            {bodyExpanded && (
              <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-lg p-3 text-xs text-gray-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                {task.email_body}
              </div>
            )}
          </div>
        )}

        {/* Draft reply (editable) */}
        <div className="mb-3">
          <button
            onClick={() => setReplyExpanded(!replyExpanded)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 mb-1"
          >
            {replyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {t('emailagent.draft_reply')}
          </button>
          {replyExpanded && (
            <textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              disabled={isDone}
              rows={7}
              className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-xs text-gray-600 dark:text-neutral-300 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          )}
        </div>

        {/* Stripe Analysis Area */}
        {task.tipo === 'REEMBOLSO' && analysis && (
          <div className={`border rounded-lg p-4 text-sm space-y-1 mb-3 ${
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

        {/* Action Buttons */}
        {!isDone && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              {task.tipo === 'REEMBOLSO' && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <CreditCard size={16} />
                  {analyzing ? t('emailagent.consulting') : t('emailagent.analyze_stripe')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={sending || sentOk || !editedReply.trim()}
                className={`flex items-center gap-2 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 ${
                  sentOk
                    ? 'bg-green-500 cursor-default'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Send size={15} />
                {sentOk ? t('emailagent.sent_ok') : sending ? t('emailagent.sending') : t('emailagent.send_reply')}
              </button>
              {isPending && (
                <button
                  onClick={() => onDone(task.id)}
                  className="flex items-center gap-2 border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <CheckCircle2 size={16} />
                  {t('emailagent.mark_done')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Feedback Card ───────────────────────────────────────────────────────────
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

// ─── Main Page ───────────────────────────────────────────────────────────────
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
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const since = new Date()
      since.setDate(since.getDate() - period)
      const sinceStr = period === 0
        ? new Date().toISOString().split('T')[0] + 'T00:00:00'
        : since.toISOString()

      const { data } = await supabase
        .from('email_tasks')
        .select('*')
        .gte('created_at', sinceStr)
        .order('created_at', { ascending: false })

      const allTasks = data || []
      setTasks(allTasks)
      setStats({
        total: allTasks.length,
        pending: allTasks.filter((t: Task) => t.status === 'pending').length,
        auto: allTasks.filter((t: Task) => t.status === 'auto').length,
        done: allTasks.filter((t: Task) => t.status === 'done').length,
      })
    } catch { /* ignore */ }
    setLoading(false)
  }, [period])

  const loadFeedbacks = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('email_feedbacks')
        .select('*')
        .order('created_at', { ascending: false })
      setFeedbacks(data || [])
    } catch { /* ignore */ }
  }, [])

  const viewHistory = useCallback(async (email: string) => {
    const clean = email.includes('<') ? email.split('<')[1].replace('>', '').trim() : email.trim()
    setHistoryEmail(clean)
    setLoadingHistory(true)
    try {
      const { data } = await supabase
        .from('email_tasks')
        .select('*')
        .ilike('email_from', `%${clean}%`)
        .order('created_at', { ascending: false })
        .limit(50)
      setHistoryTasks(data || [])
    } catch { /* ignore */ }
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    loadTasks()
    loadFeedbacks()
  }, [loadTasks, loadFeedbacks])

  // Realtime subscription — tasks and feedbacks update instantly
  useEffect(() => {
    const channel = supabase
      .channel('email_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_tasks' }, () => {
        loadTasks()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_feedbacks' }, () => {
        loadFeedbacks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadTasks, loadFeedbacks])

  const handleDone = async (id: number) => {
    await supabase.from('email_tasks').update({ status: 'done' }).eq('id', id)
    loadTasks()
  }

  const handleSend = async (id: number, emailSent: string): Promise<boolean> => {
    try {
      const data = await apiCall(`/send/${id}`, 'POST', { email_sent: emailSent })
      if (data.sucesso) {
        await loadTasks()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const handleRefund = async (id: number, cobrancaId: string, assinaturaId?: string) => {
    await apiCall(`/reembolsar/${id}`, 'POST', {
      cobranca_id: cobrancaId,
      assinatura_id: assinaturaId || null,
    })
    loadTasks()
  }

  const handleRun = async () => {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const data = await apiCall('/run', 'POST', undefined, 90000)
      if (data.sucesso) {
        setVerifyResult(`${data.processados} e-mail(s) processados${data.erros > 0 ? `, ${data.erros} erro(s)` : ''}`)
        await loadTasks()
        await loadFeedbacks()
      } else {
        setVerifyResult(`Erro: ${data.erro || 'desconhecido'}`)
      }
    } catch (e: any) {
      setVerifyResult(e?.name === 'AbortError' ? 'Timeout — tente novamente' : `Erro de conexão: ${e?.message || ''}`)
    }
    setVerifying(false)
    setTimeout(() => setVerifyResult(null), 8000)
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Mail size={28} />
            {t('emailagent.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            {t('emailagent.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {verifyResult && (
            <span className="text-xs text-gray-500 dark:text-neutral-400">{verifyResult}</span>
          )}
          <button
            onClick={handleRun}
            disabled={verifying}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} className={verifying ? 'animate-spin' : ''} />
            {verifying ? t('emailagent.verifying') : t('emailagent.verify_emails')}
          </button>
        </div>
      </div>

      {/* Agent Status Notice */}
      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
        <Bot size={20} className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
            {t('emailagent.local_agent')}
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {t('emailagent.local_desc')} {t('emailagent.realtime_desc')}
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

      {/* Tab: Emails */}
      {tab === 'emails' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw size={28} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3 animate-spin" />
              <p className="text-sm text-gray-400 dark:text-neutral-500">{t('emailagent.loading')}...</p>
            </div>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <EmailCard
                key={task.id}
                task={task}
                onDone={handleDone}
                onSend={handleSend}
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

      {/* Tab: Feedbacks */}
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
                    {ht.email_body && (
                      <details className="text-xs">
                        <summary className="text-gray-400 dark:text-neutral-500 cursor-pointer hover:text-gray-600 dark:hover:text-neutral-300">
                          {t('emailagent.received_email')}
                        </summary>
                        <div className="mt-1 bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-lg p-2 text-gray-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {ht.email_body}
                        </div>
                      </details>
                    )}
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
