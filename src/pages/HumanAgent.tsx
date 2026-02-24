import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n/useTranslation'
import {
  MessageCircle,
  Users,
  Bot,
  Save,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Settings,
  Plus,
  Trash2,
  Instagram,
  X,
  ShoppingBag,
  DollarSign,
} from 'lucide-react'

const SUPABASE_URL = 'https://jdodenbjohnqvhvldfqu.supabase.co'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec'

// ==================== TYPES ====================

interface AgentConfig {
  id: string
  is_active: boolean
  agent_name: string
  agent_type: 'support' | 'sales'
  system_prompt: string
  knowledge_base: string
  max_history_messages: number
  gemini_model: string
  trigger_keywords: string[]
  require_keyword: boolean
  created_at: string
  updated_at: string
}

interface Product {
  id: string
  name: string
  description: string | null
  price_brl: number
  payment_link: string
  payment_source: 'kiwify' | 'stripe'
  is_active: boolean
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

interface IGAccount {
  id: string
  username: string | null
  name: string | null
  profile_picture_url: string | null
  followers_count: number
  media_count: number
}

type View = 'agents' | 'conversations' | 'edit-agent' | 'chat' | 'products'

// ==================== HELPERS ====================

const fmt = (n: number) => n?.toLocaleString('pt-BR') || '0'

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// ==================== MAIN PAGE ====================

export default function HumanAgentPage() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [view, setView] = useState<View>('agents')
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null)
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  // Fetch connected IG account
  const { data: igAccount } = useQuery<IGAccount>({
    queryKey: ['ig-account'],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-account`, {
        headers: { 'Authorization': `Bearer ${ANON_KEY}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // Fetch all agents
  const { data: agents = [] } = useQuery<AgentConfig[]>({
    queryKey: ['human_agent_configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agent_config')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  // Fetch products (for sales agents)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  // Conversations
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

  // Messages for selected conversation
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

  // Real-time subscriptions for conversations and messages
  useEffect(() => {
    const channel = supabase
      .channel('human-agent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'human_agent_conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['human_agent_conversations'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'human_agent_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['human_agent_messages'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Toggle agent mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ agent, activate }: { agent: AgentConfig; activate: boolean }) => {
      if (activate) {
        // Deactivate all others first
        await supabase.from('human_agent_config').update({ is_active: false, updated_at: new Date().toISOString() }).neq('id', agent.id)
      }
      const { error } = await supabase.from('human_agent_config').update({ is_active: activate, updated_at: new Date().toISOString() }).eq('id', agent.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['human_agent_configs'] }),
  })

  // Delete agent mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('human_agent_config').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['human_agent_configs'] }),
  })

  // Stats
  const today = new Date().toISOString().split('T')[0]
  const activeConvos = conversations.filter(c => c.status === 'active').length
  const todayConvos = conversations.filter(c => c.last_message_at?.startsWith(today)).length
  const activeAgent = agents.find(a => a.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('humanagent.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400">{t('humanagent.subtitle')}</p>
          </div>
        </div>

        {/* Connected Account */}
        {igAccount?.username && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">@{igAccount.username}</span>
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-gray-400 dark:text-neutral-500">{fmt(igAccount.followers_count)} {t('humanagent.followers')}</span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Bot} label={t('humanagent.active_agent')} value={activeAgent?.agent_name || t('humanagent.none')} color="blue" />
        <StatCard icon={MessageCircle} label={t('humanagent.convos_today')} value={fmt(todayConvos)} color="green" />
        <StatCard icon={Users} label={t('humanagent.active_convos')} value={fmt(activeConvos)} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setView('agents'); setEditingAgent(null); setSelectedConvo(null); setCreatingNew(false) }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'agents' || view === 'edit-agent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
          }`}
        >
          <Settings className="w-4 h-4" /> {t('humanagent.agents_tab')} ({agents.length})
        </button>
        <button
          onClick={() => { setView('conversations'); setEditingAgent(null); setCreatingNew(false) }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'conversations' || view === 'chat'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
          }`}
        >
          <MessageCircle className="w-4 h-4" /> {t('humanagent.convos_tab')}
        </button>
        <button
          onClick={() => { setView('products'); setEditingAgent(null); setCreatingNew(false) }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            view === 'products'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> {t('humanagent.products_tab')} ({products.length})
        </button>
      </div>

      {/* Content */}
      {(view === 'agents' && !creatingNew) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onToggle={(activate) => toggleMutation.mutate({ agent, activate })}
                onEdit={() => { setEditingAgent(agent); setView('edit-agent') }}
                onDelete={() => {
                  if (agents.length <= 1) return alert(t('humanagent.cant_delete'))
                  if (confirm(t('humanagent.delete_confirm', { name: agent.agent_name }))) deleteMutation.mutate(agent.id)
                }}
                toggling={toggleMutation.isPending}
              />
            ))}
          </div>

          <button
            onClick={() => setCreatingNew(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-xl text-gray-500 dark:text-neutral-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> {t('humanagent.create_new')}
          </button>
        </div>
      )}

      {creatingNew && (
        <NewAgentForm
          onCancel={() => setCreatingNew(false)}
          onCreated={() => { setCreatingNew(false); queryClient.invalidateQueries({ queryKey: ['human_agent_configs'] }) }}
        />
      )}

      {view === 'edit-agent' && editingAgent && (
        <EditAgentForm
          agent={editingAgent}
          onBack={() => { setEditingAgent(null); setView('agents') }}
          onSaved={() => { setEditingAgent(null); setView('agents'); queryClient.invalidateQueries({ queryKey: ['human_agent_configs'] }) }}
        />
      )}

      {view === 'conversations' && !selectedConvo && (
        <ConversationsList conversations={conversations} onSelect={(c) => { setSelectedConvo(c); setView('chat') }} />
      )}

      {view === 'chat' && selectedConvo && (
        <ChatView conversation={selectedConvo} messages={messages} onBack={() => { setSelectedConvo(null); setView('conversations') }} />
      )}

      {view === 'products' && (
        <ProductsManager products={products} onChanged={() => queryClient.invalidateQueries({ queryKey: ['products'] })} />
      )}
    </div>
  )
}

// ==================== STAT CARD ====================

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof MessageCircle; label: string; value: string; color: 'blue' | 'green' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-sm text-gray-500 dark:text-neutral-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ==================== AGENT CARD ====================

function AgentCard({ agent, onToggle, onEdit, onDelete, toggling }: {
  agent: AgentConfig; onToggle: (activate: boolean) => void; onEdit: () => void; onDelete: () => void; toggling: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className={`card p-5 transition-all ${agent.is_active ? 'ring-2 ring-green-500/30 border-green-200 dark:border-green-500/20' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            agent.agent_type === 'sales'
              ? (agent.is_active ? 'bg-amber-100 dark:bg-amber-500/10' : 'bg-gray-100 dark:bg-neutral-800')
              : (agent.is_active ? 'bg-green-100 dark:bg-green-500/10' : 'bg-gray-100 dark:bg-neutral-800')
          }`}>
            {agent.agent_type === 'sales'
              ? <DollarSign className={`w-5 h-5 ${agent.is_active ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-neutral-500'}`} />
              : <Bot className={`w-5 h-5 ${agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-neutral-500'}`} />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{agent.agent_name || t('humanagent.no_name')}</h3>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                agent.agent_type === 'sales'
                  ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>{agent.agent_type === 'sales' ? t('humanagent.type_sales') : t('humanagent.type_support')}</span>
            </div>
            {agent.is_active && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {t('humanagent.active_ig')}
              </span>
            )}
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => onToggle(!agent.is_active)}
          disabled={toggling}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${agent.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${agent.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-neutral-500 line-clamp-2 mb-4">{agent.system_prompt || t('humanagent.no_prompt')}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {agent.knowledge_base ? (
            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-3 h-3" /> {agent.knowledge_base.length} chars
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500">{t('humanagent.no_kb')}</span>
          )}
          {agent.trigger_keywords?.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {agent.trigger_keywords.length} {t('humanagent.keywords_count')}
            </span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-neutral-500">Max {agent.max_history_messages} msgs</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-blue-500 transition-colors"><Settings className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}

// ==================== NEW AGENT FORM ====================

function NewAgentForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [agentType, setAgentType] = useState<'support' | 'sales'>('support')
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [knowledge, setKnowledge] = useState('')
  const [maxHistory, setMaxHistory] = useState(10)
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors'

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setNewKeyword('')
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return alert(t('humanagent.agent_name'))
    setSaving(true)
    const { error } = await supabase.from('human_agent_config').insert({
      agent_name: name.trim(),
      agent_type: agentType,
      system_prompt: prompt,
      knowledge_base: knowledge,
      max_history_messages: maxHistory,
      trigger_keywords: keywords,
      require_keyword: true,
      is_active: false,
      gemini_model: 'gemini-2.0-flash',
    })
    if (error) alert(`${t('common.error')}: ${error.message}`)
    else onCreated()
    setSaving(false)
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Plus className="w-5 h-5 text-blue-500" /> {t('humanagent.new_agent')}</h2>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      {/* Agent Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">{t('humanagent.agent_type')}</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAgentType('support')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              agentType === 'support'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
            }`}
          >
            <Bot className={`w-6 h-6 mb-2 ${agentType === 'support' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('humanagent.type_support')}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{t('humanagent.type_support_desc')}</p>
          </button>
          <button
            onClick={() => setAgentType('sales')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              agentType === 'sales'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
            }`}
          >
            <DollarSign className={`w-6 h-6 mb-2 ${agentType === 'sales' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('humanagent.type_sales')}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{t('humanagent.type_sales_desc')}</p>
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.agent_name')}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('humanagent.name_placeholder')} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.system_prompt')}</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder={t('humanagent.prompt_placeholder')} className={inputClass + ' resize-y'} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.knowledge_base')}</label>
        <textarea value={knowledge} onChange={(e) => setKnowledge(e.target.value)} rows={6} placeholder={t('humanagent.kb_placeholder')} className={inputClass + ' resize-y font-mono text-xs'} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.trigger_keywords')}</label>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">{t('humanagent.keywords_on_hint')}</p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            placeholder={t('humanagent.keyword_placeholder')}
            className={inputClass}
          />
          <button onClick={addKeyword} disabled={!newKeyword.trim()} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50 flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium">
              {kw}
              <button onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.max_history')}</label>
        <input type="number" value={maxHistory} onChange={(e) => setMaxHistory(parseInt(e.target.value) || 10)} min={2} max={50} className={inputClass + ' max-w-32'} />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">{t('humanagent.cancel')}</button>
        <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {saving ? t('humanagent.creating') : t('humanagent.create_agent')}
        </button>
      </div>
    </div>
  )
}

// ==================== EDIT AGENT FORM ====================

function EditAgentForm({ agent, onBack, onSaved }: { agent: AgentConfig; onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(agent.agent_name || '')
  const [prompt, setPrompt] = useState(agent.system_prompt || '')
  const [knowledge, setKnowledge] = useState(agent.knowledge_base || '')
  const [maxHistory, setMaxHistory] = useState(agent.max_history_messages || 10)
  const [keywords, setKeywords] = useState<string[]>(agent.trigger_keywords || [])
  const [requireKeyword, setRequireKeyword] = useState(agent.require_keyword !== false)
  const [newKeyword, setNewKeyword] = useState('')
  const [saving, setSaving] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors'

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setNewKeyword('')
    }
  }

  const removeKeyword = (kw: string) => setKeywords(keywords.filter(k => k !== kw))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('human_agent_config').update({
      agent_name: name, system_prompt: prompt, knowledge_base: knowledge, max_history_messages: maxHistory,
      trigger_keywords: keywords, require_keyword: requireKeyword,
      updated_at: new Date().toISOString(),
    }).eq('id', agent.id)
    if (error) alert(`${t('common.error')}: ${error.message}`)
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('humanagent.back_to_agents')}
      </button>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('humanagent.edit')} {agent.agent_name}</h2>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.agent_name')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.max_history')}</label>
          <input type="number" value={maxHistory} onChange={(e) => setMaxHistory(parseInt(e.target.value) || 10)} min={2} max={50} className={inputClass + ' max-w-32'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.system_prompt')}</label>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-1">{t('humanagent.prompt_hint')}</p>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className={inputClass + ' resize-y'} />
        </div>
      </div>

      {/* Trigger Keywords */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('humanagent.trigger_keywords')}</h2>
          </div>
          <button
            onClick={() => setRequireKeyword(!requireKeyword)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${requireKeyword ? 'bg-amber-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${requireKeyword ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-3">
          {requireKeyword ? t('humanagent.keywords_on_hint') : t('humanagent.keywords_off_hint')}
        </p>
        {requireKeyword && (
          <>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                placeholder={t('humanagent.keyword_placeholder')}
                className={inputClass}
              />
              <button
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
              {keywords.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-neutral-500 italic">{t('humanagent.no_keywords')}</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('humanagent.knowledge_base')}</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-3">{t('humanagent.kb_hint')}</p>
        <textarea value={knowledge} onChange={(e) => setKnowledge(e.target.value)} rows={12} placeholder="# Produtos&#10;- Curso X: R$497..." className={inputClass + ' resize-y font-mono text-xs'} />
        <span className="text-xs text-gray-400 dark:text-neutral-500 mt-2 block">{knowledge.length} {t('humanagent.chars')}</span>
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50">
        <Save className="w-4 h-4" /> {saving ? t('humanagent.saving') : t('humanagent.save_config')}
      </button>
    </div>
  )
}

// ==================== CONVERSATIONS LIST ====================

function ConversationsList({ conversations, onSelect }: { conversations: Conversation[]; onSelect: (c: Conversation) => void }) {
  const { t } = useTranslation()

  if (conversations.length === 0) {
    return (
      <div className="card p-12 text-center">
        <MessageCircle className="w-12 h-12 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
        <p className="text-gray-500 dark:text-neutral-400 font-medium">{t('humanagent.no_convos')}</p>
        <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">{t('humanagent.convos_hint')}</p>
      </div>
    )
  }

  return (
    <div className="card divide-y divide-gray-100 dark:divide-neutral-800">
      {conversations.map((convo) => (
        <button key={convo.id} onClick={() => onSelect(convo)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors text-left">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">{(convo.ig_username || convo.ig_user_id)?.[0]?.toUpperCase() || '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {convo.ig_username ? `@${convo.ig_username}` : `User ${convo.ig_user_id.substring(0, 8)}...`}
              </p>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                convo.status === 'ai_active'
                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                  : convo.status === 'paused'
                  ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'
              }`}>{convo.status === 'ai_active' ? t('humanagent.ai_active') : convo.status === 'paused' ? t('humanagent.ai_paused') : convo.status}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{convo.messages_count} {t('humanagent.messages')} · {timeAgo(convo.last_message_at)}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-neutral-500 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ==================== CHAT VIEW ====================

function ChatView({ conversation, messages, onBack }: { conversation: Conversation; messages: Message[]; onBack: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [toggling, setToggling] = useState(false)

  const isAiActive = conversation.status === 'ai_active'

  const toggleAiStatus = async () => {
    setToggling(true)
    const newStatus = isAiActive ? 'paused' : 'ai_active'
    await supabase.from('human_agent_conversations').update({ status: newStatus }).eq('id', conversation.id)
    conversation.status = newStatus
    queryClient.invalidateQueries({ queryKey: ['human_agent_conversations'] })
    setToggling(false)
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-neutral-800">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">{(conversation.ig_username || conversation.ig_user_id)?.[0]?.toUpperCase() || '?'}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {conversation.ig_username ? `@${conversation.ig_username}` : `User ${conversation.ig_user_id.substring(0, 12)}...`}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-500">{conversation.messages_count} {t('humanagent.messages')}</p>
        </div>
        <button
          onClick={toggleAiStatus}
          disabled={toggling}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isAiActive
              ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-green-100 dark:hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          {isAiActive ? t('humanagent.pause_ai') : t('humanagent.resume_ai')}
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-neutral-500 py-8">{t('humanagent.no_messages')}</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.direction === 'outgoing'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-[10px] ${msg.direction === 'outgoing' ? 'text-blue-200' : 'text-gray-400 dark:text-neutral-500'}`}>{formatDate(msg.created_at)}</span>
                  {msg.direction === 'outgoing' && (
                    msg.status === 'sent' ? <CheckCircle2 className="w-3 h-3 text-blue-200" />
                    : msg.status === 'failed' ? <AlertCircle className="w-3 h-3 text-red-300" />
                    : null
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

// ==================== PRODUCTS MANAGER ====================

function ProductsManager({ products, onChanged }: { products: Product[]; onChanged: () => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{product.name}</h3>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {Number(product.price_brl).toFixed(2)}</p>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                product.is_active
                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-neutral-700 text-gray-500'
              }`}>{product.is_active ? t('humanagent.active') : 'Off'}</span>
            </div>
            {product.description && <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3 line-clamp-2">{product.description}</p>}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 uppercase">{product.payment_source}</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(product); setAdding(false) }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-blue-500 transition-colors"><Settings className="w-4 h-4" /></button>
                <button onClick={async () => {
                  if (confirm(t('humanagent.delete_product_confirm', { name: product.name }))) {
                    await supabase.from('products').delete().eq('id', product.id)
                    onChanged()
                  }
                }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!adding && !editing && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-xl text-gray-500 dark:text-neutral-400 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-500 transition-all flex items-center justify-center gap-2 font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> {t('humanagent.add_product')}
        </button>
      )}

      {(adding || editing) && (
        <ProductForm
          product={editing}
          onCancel={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); onChanged() }}
        />
      )}
    </div>
  )
}

// ==================== PRODUCT FORM ====================

function ProductForm({ product, onCancel, onSaved }: { product: Product | null; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [price, setPrice] = useState(product?.price_brl?.toString() || '')
  const [link, setLink] = useState(product?.payment_link || '')
  const [source, setSource] = useState<'kiwify' | 'stripe'>(product?.payment_source || 'kiwify')
  const [active, setActive] = useState(product?.is_active !== false)
  const [saving, setSaving] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-colors'

  const handleSave = async () => {
    if (!name.trim() || !link.trim() || !price) return alert(t('humanagent.fill_required'))
    setSaving(true)

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      price_brl: parseFloat(price),
      payment_link: link.trim(),
      payment_source: source,
      is_active: active,
      updated_at: new Date().toISOString(),
    }

    if (product) {
      const { error } = await supabase.from('products').update(data).eq('id', product.id)
      if (error) alert(`${t('common.error')}: ${error.message}`)
      else onSaved()
    } else {
      const { error } = await supabase.from('products').insert(data)
      if (error) alert(`${t('common.error')}: ${error.message}`)
      else onSaved()
    }
    setSaving(false)
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-amber-500" />
          {product ? t('humanagent.edit_product') : t('humanagent.add_product')}
        </h2>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.product_name')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Curso ABRAhub Pro" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.product_price')}</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="497.00" step="0.01" min="0" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.product_description')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('humanagent.product_desc_placeholder')} className={inputClass + ' resize-y'} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.payment_link')}</label>
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://pay.kiwify.com.br/..." className={inputClass} />
      </div>
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.payment_source')}</label>
          <div className="flex gap-2">
            <button onClick={() => setSource('kiwify')} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${source === 'kiwify' ? 'bg-green-100 dark:bg-green-500/10 text-green-600' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500'}`}>Kiwify</button>
            <button onClick={() => setSource('stripe')} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${source === 'stripe' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-600' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500'}`}>Stripe</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">{t('humanagent.active')}</label>
          <button
            onClick={() => setActive(!active)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">{t('humanagent.cancel')}</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {saving ? t('humanagent.saving') : t('humanagent.save_config')}
        </button>
      </div>
    </div>
  )
}
