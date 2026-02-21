import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useState } from 'react'
import {
  MessageCircle,
  Send,
  Users,
  Bot,
  Save,
  Power,
  PowerOff,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Settings,
} from 'lucide-react'

// ==================== TYPES ====================

interface AgentConfig {
  id: string
  is_active: boolean
  agent_name: string
  system_prompt: string
  knowledge_base: string
  max_history_messages: number
  gemini_model: string
  created_at: string
  updated_at: string
}

interface Conversation {
  id: string
  ig_user_id: string
  ig_username: string | null
  status: string
  messages_count: number
  last_message_at: string
  created_at: string
}

interface Message {
  id: string
  conversation_id: string
  ig_user_id: string
  direction: 'incoming' | 'outgoing'
  message_text: string
  ig_message_id: string | null
  status: string
  error_message: string | null
  created_at: string
}

type ActiveTab = 'config' | 'conversations'

// ==================== HELPERS ====================

const fmt = (n: number) => n?.toLocaleString('pt-BR') || '0'

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ==================== MAIN PAGE ====================

export default function HumanAgentPage() {
  useTheme()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('config')
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Config form state
  const [editName, setEditName] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editKnowledge, setEditKnowledge] = useState('')
  const [editMaxHistory, setEditMaxHistory] = useState(10)
  const [configLoaded, setConfigLoaded] = useState(false)

  // Queries
  const { data: config } = useQuery<AgentConfig>({
    queryKey: ['human_agent_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agent_config')
        .select('*')
        .limit(1)
        .single()
      if (error) throw error
      return data
    },
  })

  // Load config into form on first fetch
  if (config && !configLoaded) {
    setEditName(config.agent_name || '')
    setEditPrompt(config.system_prompt || '')
    setEditKnowledge(config.knowledge_base || '')
    setEditMaxHistory(config.max_history_messages || 10)
    setConfigLoaded(true)
  }

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['human_agent_conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agent_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data || []
    },
  })

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['human_agent_messages', selectedConvo?.id],
    enabled: !!selectedConvo,
    queryFn: async () => {
      if (!selectedConvo) return []
      const { data, error } = await supabase
        .from('human_agent_messages')
        .select('*')
        .eq('conversation_id', selectedConvo.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  // Derived stats
  const today = new Date().toISOString().split('T')[0]
  const activeConvos = conversations.filter(c => c.status === 'active').length
  const todayConvos = conversations.filter(c => c.last_message_at?.startsWith(today)).length
  const totalConvos = conversations.length

  // Handlers
  const handleToggleAgent = async () => {
    if (!config) return
    setToggling(true)
    try {
      await supabase
        .from('human_agent_config')
        .update({ is_active: !config.is_active, updated_at: new Date().toISOString() })
        .eq('id', config.id)
      queryClient.invalidateQueries({ queryKey: ['human_agent_config'] })
    } catch (e) {
      console.error('Toggle error:', e)
    }
    setToggling(false)
  }

  const handleSaveConfig = async () => {
    if (!config) return
    setSaving(true)
    try {
      await supabase
        .from('human_agent_config')
        .update({
          agent_name: editName,
          system_prompt: editPrompt,
          knowledge_base: editKnowledge,
          max_history_messages: editMaxHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id)
      queryClient.invalidateQueries({ queryKey: ['human_agent_config'] })
    } catch (e) {
      console.error('Save error:', e)
    }
    setSaving(false)
  }

  const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Human Agent</h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Atendente IA para Instagram DMs</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
            config?.is_active
              ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${config?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {config?.is_active ? 'Ativo' : 'Inativo'}
          </span>

          {/* Toggle button */}
          <button
            onClick={handleToggleAgent}
            disabled={toggling}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              config?.is_active
                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20'
                : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20'
            }`}
          >
            {config?.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            {toggling ? 'Aguarde...' : config?.is_active ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={MessageCircle} label="Conversas Ativas" value={fmt(activeConvos)} color="blue" />
        <StatCard icon={Send} label="Conversas Hoje" value={fmt(todayConvos)} color="green" />
        <StatCard icon={Users} label="Total Conversas" value={fmt(totalConvos)} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['config', 'conversations'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
            }`}
          >
            {tab === 'config' ? <Settings className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
            {tab === 'config' ? 'Configuracao' : 'Conversas'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'config' ? (
        <ConfigSection
          editName={editName}
          setEditName={setEditName}
          editPrompt={editPrompt}
          setEditPrompt={setEditPrompt}
          editKnowledge={editKnowledge}
          setEditKnowledge={setEditKnowledge}
          editMaxHistory={editMaxHistory}
          setEditMaxHistory={setEditMaxHistory}
          saving={saving}
          onSave={handleSaveConfig}
          inputClass={inputClass}
        />
      ) : selectedConvo ? (
        <ChatView
          conversation={selectedConvo}
          messages={messages}
          onBack={() => setSelectedConvo(null)}
        />
      ) : (
        <ConversationsList
          conversations={conversations}
          onSelect={setSelectedConvo}
        />
      )}
    </div>
  )
}

// ==================== STAT CARD ====================

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof MessageCircle
  label: string
  value: string
  color: 'blue' | 'green' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-neutral-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ==================== CONFIG SECTION ====================

function ConfigSection({
  editName, setEditName,
  editPrompt, setEditPrompt,
  editKnowledge, setEditKnowledge,
  editMaxHistory, setEditMaxHistory,
  saving, onSave, inputClass,
}: {
  editName: string; setEditName: (v: string) => void
  editPrompt: string; setEditPrompt: (v: string) => void
  editKnowledge: string; setEditKnowledge: (v: string) => void
  editMaxHistory: number; setEditMaxHistory: (v: number) => void
  saving: boolean; onSave: () => void; inputClass: string
}) {
  return (
    <div className="space-y-6">
      {/* Agent settings */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configuracoes do Agente</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Nome do Agente
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex: Assistente ABRAhub"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Historico de Mensagens (max por conversa)
            </label>
            <input
              type="number"
              value={editMaxHistory}
              onChange={(e) => setEditMaxHistory(parseInt(e.target.value) || 10)}
              min={2}
              max={50}
              className={inputClass + ' max-w-32'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              System Prompt
            </label>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">
              Instrucoes gerais de comportamento do agente IA
            </p>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={4}
              placeholder="Voce e um assistente virtual da ABRAhub Studio..."
              className={inputClass + ' resize-y'}
            />
          </div>
        </div>
      </div>

      {/* Knowledge base */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Base de Conhecimento</h2>
        </div>

        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-3">
          Cole aqui todo o conteudo que o agente deve usar para responder. Informacoes sobre produtos,
          precos, links, FAQs, etc. O agente so vai responder com base nesse conteudo.
        </p>

        <textarea
          value={editKnowledge}
          onChange={(e) => setEditKnowledge(e.target.value)}
          rows={12}
          placeholder={`Exemplo:\n\n# ABRAhub Studio\n\n## Produtos\n- Curso X: R$497\n- Mentoria Y: R$1.997\n\n## FAQ\nP: Como funciona o suporte?\nR: Atendemos via DM e email...\n\n## Links\n- Site: https://abrahub.com\n- Whatsapp: https://wa.me/...`}
          className={inputClass + ' resize-y font-mono text-xs'}
        />

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            {editKnowledge.length} caracteres
          </span>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Salvando...' : 'Salvar Configuracao'}
      </button>
    </div>
  )
}

// ==================== CONVERSATIONS LIST ====================

function ConversationsList({
  conversations,
  onSelect,
}: {
  conversations: Conversation[]
  onSelect: (c: Conversation) => void
}) {
  if (conversations.length === 0) {
    return (
      <div className="card p-12 text-center">
        <MessageCircle className="w-12 h-12 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
        <p className="text-gray-500 dark:text-neutral-400 font-medium">Nenhuma conversa ainda</p>
        <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">
          As conversas aparecerao aqui quando alguem enviar uma DM
        </p>
      </div>
    )
  }

  return (
    <div className="card divide-y divide-gray-100 dark:divide-neutral-800">
      {conversations.map((convo) => (
        <button
          key={convo.id}
          onClick={() => onSelect(convo)}
          className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {(convo.ig_username || convo.ig_user_id)?.[0]?.toUpperCase() || '?'}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {convo.ig_username ? `@${convo.ig_username}` : `User ${convo.ig_user_id.substring(0, 8)}...`}
              </p>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                convo.status === 'active'
                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'
              }`}>
                {convo.status === 'active' ? 'Ativa' : convo.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              {convo.messages_count} mensagens · {timeAgo(convo.last_message_at)}
            </p>
          </div>

          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-neutral-500 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ==================== CHAT VIEW ====================

function ChatView({
  conversation,
  messages,
  onBack,
}: {
  conversation: Conversation
  messages: Message[]
  onBack: () => void
}) {
  return (
    <div className="card overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-neutral-800">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">
            {(conversation.ig_username || conversation.ig_user_id)?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {conversation.ig_username ? `@${conversation.ig_username}` : `User ${conversation.ig_user_id.substring(0, 12)}...`}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-500">
            {conversation.messages_count} mensagens
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-neutral-500 py-8">
            Nenhuma mensagem
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.direction === 'outgoing'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                <div className={`flex items-center gap-1 mt-1 ${
                  msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                }`}>
                  <span className={`text-[10px] ${
                    msg.direction === 'outgoing' ? 'text-blue-200' : 'text-gray-400 dark:text-neutral-500'
                  }`}>
                    {formatDate(msg.created_at)}
                  </span>
                  {msg.direction === 'outgoing' && (
                    msg.status === 'sent' ? (
                      <CheckCircle2 className="w-3 h-3 text-blue-200" />
                    ) : msg.status === 'failed' ? (
                      <AlertCircle className="w-3 h-3 text-red-300" />
                    ) : null
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
