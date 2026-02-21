import { useState, useEffect, useCallback } from 'react'
import { Mail, RefreshCw, CheckCircle2, Clock, Bot, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jdodenbjohnqvhvldfqu.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const TIPOS: Record<string, { label: string; color: string; bg: string; darkBg: string }> = {
  REEMBOLSO:    { label: 'Reembolso',       color: '#ef4444', bg: 'bg-red-50',    darkBg: 'dark:bg-red-500/10' },
  ACESSO_CURSO: { label: 'Acesso ao Curso', color: '#3b82f6', bg: 'bg-blue-50',   darkBg: 'dark:bg-blue-500/10' },
  PAGAMENTO:    { label: 'Pagamento / PIX', color: '#10b981', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-500/10' },
  RECLAMACAO:   { label: 'Reclamação',      color: '#a855f7', bg: 'bg-purple-50',  darkBg: 'dark:bg-purple-500/10' },
  DUVIDA:       { label: 'Dúvida',          color: '#6b7280', bg: 'bg-gray-50',    darkBg: 'dark:bg-neutral-800' },
  OUTRO:        { label: 'Outro',           color: '#6b7280', bg: 'bg-gray-50',    darkBg: 'dark:bg-neutral-800' },
}

function getTipo(tipo: string) {
  return TIPOS[tipo] || { label: tipo, color: '#6b7280', bg: 'bg-gray-50', darkBg: 'dark:bg-neutral-800' }
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
  const t = getTipo(tipo)
  return (
    <span
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: t.color + '22', color: t.color }}
    >
      {t.label}
    </span>
  )
}

// ─── Pending Task Card ──────────────────────────────────────────────
function PendingCard({ task, onDone, onRefund }: {
  task: Task
  onDone: (id: number) => void
  onRefund: (id: number, cobrancaId: string, assinaturaId?: string) => void
}) {
  const t = getTipo(task.tipo)
  const [expanded, setExpanded] = useState(false)
  const [analysis, setAnalysis] = useState<StripeAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    setAnalyzing(true)
    const data = await apiCall(`/analisar/${task.id}`)
    setAnalyzing(false)
    if (data.sucesso) {
      setAnalysis(data.analise)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      <div className="p-5" style={{ borderLeft: `4px solid ${t.color}` }}>
        <div className="flex items-center gap-2 mb-3">
          <TipoBadge tipo={task.tipo} />
          <span className="text-xs text-gray-400 dark:text-neutral-500">{formatTime(task.created_at)}</span>
        </div>

        <p className="font-semibold text-gray-800 dark:text-white">{task.email_from}</p>
        <p className="text-gray-500 dark:text-neutral-400 text-sm mb-4">"{task.email_subject}"</p>

        {task.description && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Ação necessária:</p>
            <p className="text-sm text-amber-900 dark:text-amber-300">{task.description}</p>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 mb-4"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Ocultar resposta' : 'Ver resposta enviada ao cliente'}
        </button>

        {expanded && (
          <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-xs text-gray-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed mb-4">
            {task.email_sent}
          </div>
        )}

        {/* Stripe Analysis Area */}
        {task.tipo === 'REEMBOLSO' && analysis && (
          <div className={`border rounded-lg p-4 text-sm space-y-1 mb-4 ${
            analysis.encontrado && analysis.elegivel
              ? 'border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10'
              : 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10'
          }`}>
            {!analysis.encontrado ? (
              <p className="text-red-700 dark:text-red-400">⚠️ {analysis.motivo}</p>
            ) : (
              <>
                <p className={`font-bold mb-2 ${analysis.elegivel ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                  {analysis.elegivel
                    ? `✅ Elegível — compra há ${analysis.dias_passados} dia(s), dentro do prazo`
                    : `❌ Fora do prazo — compra há ${analysis.dias_passados} dias (máx. ${analysis.prazo_dias} dias)`
                  }
                </p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">Cliente:</span> {analysis.nome}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">Produto:</span> {analysis.produto}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">Valor:</span> {analysis.moeda} {analysis.valor?.toFixed(2)}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">Comprado em:</span> {analysis.data_compra}</p>
                <p className="text-gray-700 dark:text-neutral-300"><span className="font-medium">Assinatura ativa:</span> {analysis.tem_assinatura ? 'Sim (será cancelada)' : 'Não'}</p>
                {analysis.elegivel && (
                  <div className="pt-3 border-t border-green-200 dark:border-green-500/20 mt-3">
                    <p className="text-xs text-green-700 dark:text-green-400 mb-2">
                      Ao confirmar: reembolso de {analysis.moeda} {analysis.valor?.toFixed(2)} + {analysis.tem_assinatura ? 'cancelamento da assinatura' : 'sem assinatura para cancelar'}.
                    </p>
                    <button
                      onClick={() => {
                        if (confirm('Tem certeza? Esta ação não pode ser desfeita.')) {
                          onRefund(task.id, analysis.cobranca_id!, analysis.assinatura_id || undefined)
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm px-5 py-2 rounded-lg font-semibold transition-colors w-full"
                    >
                      ⚠️ Confirmar Reembolso
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

        <div className="flex items-center justify-between gap-3">
          {task.tipo === 'REEMBOLSO' ? (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <CreditCard size={16} />
              {analyzing ? 'Consultando...' : 'Analisar no Stripe'}
            </button>
          ) : <div />}
          <button
            onClick={() => onDone(task.id)}
            className="flex items-center gap-2 border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <CheckCircle2 size={16} />
            Concluído
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function EmailAgentPage() {
  const [tab, setTab] = useState<'tarefas' | 'emails' | 'feedbacks'>('tarefas')
  const [tasks, setTasks] = useState<Task[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, auto: 0, done: 0 })
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState('')

  const loadTasks = useCallback(async () => {
    try {
      const data = await apiCall('/tasks')
      if (data.tasks) setTasks(data.tasks)
      if (data.stats) setStats(data.stats)
    } catch { /* ignore */ }
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
  }, [loadTasks, loadFeedbacks])

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

  const handleRun = async () => {
    setRunning(true)
    setRunResult('')
    try {
      const data = await apiCall('/process', 'POST', {
        remetente: '',
        assunto: '',
        corpo: '',
      })
      if (data.sucesso) {
        setRunResult(`${data.tipo || 'OK'} processado`)
        loadTasks()
      } else {
        setRunResult(data.erro || 'Erro')
      }
    } catch {
      setRunResult('Erro de conexão')
    } finally {
      setTimeout(() => { setRunning(false); setRunResult('') }, 3000)
    }
  }

  const pending = tasks.filter(t => t.status === 'pending')
  const auto = tasks.filter(t => t.status === 'auto')
  const done = tasks.filter(t => t.status === 'done')

  const statCards = [
    { label: 'e-mails hoje', value: stats.total, icon: Mail, color: 'text-gray-700 dark:text-white' },
    { label: 'tarefas pendentes', value: stats.pending, icon: Clock, color: 'text-red-500' },
    { label: 'auto-respondidos', value: stats.auto, icon: Bot, color: 'text-gray-500 dark:text-neutral-400' },
    { label: 'concluídos', value: stats.done, icon: CheckCircle2, color: 'text-green-500' },
  ]

  const tabs = [
    { key: 'tarefas' as const, label: 'Tarefas', badge: pending.length },
    { key: 'emails' as const, label: 'E-mails respondidos', badge: 0 },
    { key: 'feedbacks' as const, label: 'Feedbacks', badge: feedbacks.length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Mail size={28} />
            Agente de E-mails
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Suporte automatizado com IA para suporte@abrahub.com
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
          {running ? 'Verificando...' : runResult || 'Verificar E-mails'}
        </button>
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
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              if (t.key === 'feedbacks') loadFeedbacks()
            }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300'
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full text-white ${
                t.key === 'feedbacks' ? 'bg-purple-500' : 'bg-red-500'
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'tarefas' && (
        <div className="space-y-6">
          {/* Pending */}
          <div className="space-y-3">
            {pending.length > 0 ? (
              pending.map((t) => (
                <PendingCard
                  key={t.id}
                  task={t}
                  onDone={handleDone}
                  onRefund={handleRefund}
                />
              ))
            ) : (
              <p className="text-sm text-gray-400 dark:text-neutral-500 py-4 text-center">
                Nenhuma tarefa pendente ✓
              </p>
            )}
          </div>

          {/* Done */}
          {done.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px bg-gray-200 dark:bg-neutral-800 flex-1" />
                <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Concluídos</p>
                <div className="h-px bg-gray-200 dark:bg-neutral-800 flex-1" />
              </div>
              <div className="space-y-2">
                {done.map((t) => (
                  <div key={t.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-3 flex items-center gap-3 opacity-50">
                    <TipoBadge tipo={t.tipo} />
                    <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">{formatTime(t.created_at)}</span>
                    <span className="text-sm text-gray-600 dark:text-neutral-300 truncate">{t.email_from}</span>
                    <span className="text-sm text-gray-400 dark:text-neutral-500 truncate flex-1">"{t.email_subject}"</span>
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold shrink-0">✓ Concluído</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'emails' && (
        <div className="space-y-2">
          {auto.length > 0 ? (
            auto.map((t) => (
              <AutoEmailCard key={t.id} task={t} />
            ))
          ) : (
            <p className="text-sm text-gray-400 dark:text-neutral-500 py-4 text-center">
              Nenhum e-mail respondido hoje ainda.
            </p>
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
            <p className="text-sm text-gray-400 dark:text-neutral-500 py-4 text-center">
              Nenhum feedback recebido ainda.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Auto Email Card ────────────────────────────────────────────────
function AutoEmailCard({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-3 flex items-center gap-3 shadow-sm">
      <TipoBadge tipo={task.tipo} />
      <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">{formatTime(task.created_at)}</span>
      <span className="text-sm text-gray-700 dark:text-neutral-300 font-medium truncate">{task.email_from}</span>
      <span className="text-sm text-gray-400 dark:text-neutral-500 truncate flex-1">"{task.email_subject}"</span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 shrink-0"
      >
        {expanded ? 'ocultar ▴' : 'ver resposta ▾'}
      </button>
      {expanded && (
        <div className="absolute right-4 mt-1 w-80 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-xl p-3 text-xs text-gray-600 dark:text-neutral-300 whitespace-pre-wrap z-30">
          {task.email_sent}
        </div>
      )}
    </div>
  )
}

// ─── Feedback Card ──────────────────────────────────────────────────
function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-purple-100 dark:border-purple-500/20 overflow-hidden shadow-sm">
      <div className="p-5" style={{ borderLeft: '4px solid #a855f7' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: '#a855f722', color: '#a855f7' }}>
            Feedback
          </span>
          <span className="text-xs text-gray-400 dark:text-neutral-500">{formatDateTime(feedback.created_at)}</span>
        </div>
        <p className="font-semibold text-gray-800 dark:text-white">{feedback.email_from}</p>
        {feedback.motivo && (
          <p className="text-sm text-purple-700 dark:text-purple-400 font-medium mt-1 mb-3">📌 {feedback.motivo}</p>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 mt-2"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Ocultar mensagem' : 'Ver mensagem completa'}
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
