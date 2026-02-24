import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useState, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Flame,
  Sun,
  Snowflake,
  Search,
  Plus,
  X,
  Check,
  Trash2,
  RefreshCw,
  Tag,
  MessageCircle,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Send,
  Eye,
  DollarSign,
} from 'lucide-react'

// ==================== TYPES ====================

interface Lead {
  id: string
  username: string
  ig_user_id: string | null
  source: 'automation_comment' | 'dm' | 'manual'
  source_automation_id: string | null
  temperature: 'hot' | 'warm' | 'cold'
  temperature_override: boolean
  status: 'new' | 'contacted' | 'negotiating' | 'converted' | 'lost'
  interaction_count: number
  first_interaction_at: string
  last_interaction_at: string
  tags: string[]
  notes: string | null
  customer_email: string | null
  tracked_link_sent: boolean
  tracked_product_id: string | null
  converted_at: string | null
  conversion_value: number | null
  created_at: string
  updated_at: string
}

interface ProcessedComment {
  id: string
  comment_id: string
  automation_id: string
  commenter_username: string
  comment_text: string
  action_taken: string
  status: string
  error_message: string | null
  created_at: string
}

type TemperatureFilter = 'all' | 'hot' | 'warm' | 'cold'
type StatusFilter = 'all' | 'new' | 'contacted' | 'negotiating' | 'converted' | 'lost'

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
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const tempConfig = {
  hot: {
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-500/30',
    icon: Flame,
    gradient: 'from-red-600 to-orange-600',
  },
  warm: {
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-500/30',
    icon: Sun,
    gradient: 'from-orange-500 to-yellow-500',
  },
  cold: {
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-500/30',
    icon: Snowflake,
    gradient: 'from-blue-500 to-cyan-500',
  },
}

const statusConfig: Record<string, string> = {
  new: 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300',
  contacted: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
  negotiating: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
  converted: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300',
  lost: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
}

const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors'

// ==================== MAIN PAGE ====================

export default function LeadsPage() {
  useTheme()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [tempFilter, setTempFilter] = useState<TemperatureFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [addingLead, setAddingLead] = useState(false)

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['instagram-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_leads')
        .select('*')
        .order('last_interaction_at', { ascending: false })
      return (data || []) as Lead[]
    },
  })

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (search && !lead.username.toLowerCase().includes(search.toLowerCase())) return false
      if (tempFilter !== 'all' && lead.temperature !== tempFilter) return false
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      return true
    })
  }, [leads, search, tempFilter, statusFilter])

  const totalLeads = leads.length
  const hotLeads = leads.filter(l => l.temperature === 'hot').length
  const newToday = leads.filter(l => l.created_at.startsWith(new Date().toISOString().split('T')[0])).length
  const converted = leads.filter(l => l.status === 'converted').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400 dark:text-neutral-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Users size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('leads.title')}</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('leads.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setAddingLead(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-600/20 transition-all"
        >
          <Plus size={16} />
          {t('leads.add_lead')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t('leads.total_leads')} value={fmt(totalLeads)} color="purple" />
        <StatCard icon={Flame} label={t('leads.hot_leads')} value={fmt(hotLeads)} color="red" />
        <StatCard icon={UserPlus} label={t('leads.new_today')} value={fmt(newToday)} color="blue" />
        <StatCard icon={CheckCircle2} label={t('leads.converted')} value={fmt(converted)} color="green" />
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('leads.search_placeholder')}
            className={`${inputClass} pl-9`}
          />
        </div>

        {/* Temperature filter */}
        <div className="flex gap-1">
          {(['all', 'hot', 'warm', 'cold'] as const).map(temp => (
            <button
              key={temp}
              onClick={() => setTempFilter(temp)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                tempFilter === temp
                  ? temp === 'all'
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-neutral-900'
                    : `bg-gradient-to-r ${tempConfig[temp].gradient} text-white shadow-lg`
                  : 'bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'
              }`}
            >
              {temp === 'all' ? t('leads.filter_all') : t(`leads.filter_${temp}`)}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer"
        >
          <option value="all">{t('leads.status')}: {t('leads.filter_all')}</option>
          <option value="new">{t('leads.new')}</option>
          <option value="contacted">{t('leads.contacted')}</option>
          <option value="negotiating">{t('leads.negotiating')}</option>
          <option value="converted">{t('leads.converted_status')}</option>
          <option value="lost">{t('leads.lost')}</option>
        </select>
      </div>

      {/* Leads Table */}
      <LeadsTable
        leads={filteredLeads}
        onSelect={setSelectedLead}
      />

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => {
            setSelectedLead(null)
            queryClient.invalidateQueries({ queryKey: ['instagram-leads'] })
          }}
        />
      )}

      {/* Add Lead Modal */}
      {addingLead && (
        <AddLeadModal
          onClose={() => {
            setAddingLead(false)
            queryClient.invalidateQueries({ queryKey: ['instagram-leads'] })
          }}
        />
      )}
    </div>
  )
}

// ==================== STAT CARD ====================

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Users
  label: string
  value: string
  color: 'purple' | 'red' | 'blue' | 'green'
}) {
  const colors = {
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-neutral-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ==================== TEMPERATURE BADGE ====================

function TemperatureBadge({ temp, size = 'sm' }: { temp: 'hot' | 'warm' | 'cold'; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  const cfg = tempConfig[temp]
  const TempIcon = cfg.icon

  return (
    <span className={`inline-flex items-center gap-1 ${size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-[10px]'} rounded-lg font-bold ${cfg.bg} ${cfg.text}`}>
      <TempIcon size={size === 'md' ? 14 : 10} />
      {t(`leads.${temp}`)}
    </span>
  )
}

// ==================== STATUS BADGE ====================

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const statusKey = status === 'converted' ? 'converted_status' : status
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusConfig[status] || statusConfig.new}`}>
      {t(`leads.${statusKey}`)}
    </span>
  )
}

// ==================== LEADS TABLE ====================

function LeadsTable({ leads, onSelect }: { leads: Lead[]; onSelect: (lead: Lead) => void }) {
  const { t } = useTranslation()

  if (leads.length === 0) {
    return (
      <div className="text-center py-16">
        <Users size={48} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
        <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('leads.no_leads')}</p>
        <p className="text-gray-400 dark:text-neutral-600 text-xs mt-1">{t('leads.no_leads_hint')}</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-neutral-800">
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.username')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.temperature')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.status')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.source')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.interactions')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.last_interaction')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.conversion_value')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('leads.tags')}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr
                key={lead.id}
                onClick={() => onSelect(lead)}
                className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Instagram size={14} className="text-pink-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">@{lead.username}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TemperatureBadge temp={lead.temperature} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500 dark:text-neutral-500">
                    {lead.source === 'automation_comment' ? (
                      <span className="flex items-center gap-1"><MessageCircle size={12} /> {t('leads.automation_comment')}</span>
                    ) : lead.source === 'dm' ? (
                      <span className="flex items-center gap-1"><Send size={12} /> {t('leads.dm')}</span>
                    ) : (
                      t('leads.manual')
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{lead.interaction_count}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500 dark:text-neutral-500">{timeAgo(lead.last_interaction_at)}</span>
                </td>
                <td className="px-4 py-3">
                  {lead.status === 'converted' && lead.conversion_value ? (
                    <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                      R${lead.conversion_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  ) : lead.tracked_link_sent ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t('leads.tracked_link_sent')}</span>
                  ) : (
                    <span className="text-xs text-gray-300 dark:text-neutral-700">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {(lead.tags || []).slice(0, 2).map((tag, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300">
                        {tag}
                      </span>
                    ))}
                    {(lead.tags || []).length > 2 && (
                      <span className="text-[9px] text-gray-400 dark:text-neutral-500">+{lead.tags.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ChevronRight size={16} className="text-gray-300 dark:text-neutral-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== LEAD DETAIL MODAL ====================

function LeadDetailModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { t } = useTranslation()
  const [temperature, setTemperature] = useState(lead.temperature)
  const [tempOverride, setTempOverride] = useState(lead.temperature_override)
  const [status, setStatus] = useState(lead.status)
  const [notes, setNotes] = useState(lead.notes || '')
  const [tags, setTags] = useState<string[]>(lead.tags || [])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch interaction history
  const { data: comments = [] } = useQuery({
    queryKey: ['lead-comments', lead.username],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_processed_comments')
        .select('*')
        .eq('commenter_username', lead.username)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data || []) as ProcessedComment[]
    },
  })

  const addTag = () => {
    const tag = newTag.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
      setNewTag('')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('instagram_leads')
      .update({
        temperature,
        temperature_override: tempOverride,
        status,
        notes: notes || null,
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase
      .from('instagram_leads')
      .delete()
      .eq('id', lead.id)
    setDeleting(false)
    onClose()
  }

  const statuses: Lead['status'][] = ['new', 'contacted', 'negotiating', 'converted', 'lost']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 p-5 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tempConfig[temperature].gradient} flex items-center justify-center`}>
                <Instagram size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">@{lead.username}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <TemperatureBadge temp={temperature} />
                  <StatusBadge status={status} />
                  <span className="text-[10px] text-gray-400 dark:text-neutral-600">
                    {lead.interaction_count} {t('leads.interactions').toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Temperature Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('leads.temperature')}</p>
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempOverride}
                  onChange={e => setTempOverride(e.target.checked)}
                  className="rounded"
                />
                {t('leads.manual_override')}
              </label>
            </div>
            <div className="flex gap-2">
              {(['hot', 'warm', 'cold'] as const).map(temp => {
                const cfg = tempConfig[temp]
                const TempIcon = cfg.icon
                const selected = temperature === temp
                return (
                  <button
                    key={temp}
                    onClick={() => { setTemperature(temp); setTempOverride(true) }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border ${
                      selected
                        ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-lg`
                        : `${cfg.bg} ${cfg.text} ${cfg.border} hover:shadow-md`
                    }`}
                  >
                    <TempIcon size={16} />
                    {t(`leads.${temp}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status Pipeline */}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('leads.status')}</p>
            <div className="flex gap-1">
              {statuses.map((s) => {
                const active = status === s
                const statusKey = s === 'converted' ? 'converted_status' : s
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? `${statusConfig[s]} ring-2 ring-offset-1 ring-gray-300 dark:ring-neutral-600 dark:ring-offset-neutral-900`
                        : 'bg-gray-50 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400'
                    }`}
                  >
                    {t(`leads.${statusKey}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              <Tag size={14} className="inline text-orange-500 mr-1.5" />
              {t('leads.tags')}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300"
                >
                  {tag}
                  <button onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={t('leads.tag_placeholder')}
                className={inputClass}
                maxLength={64}
              />
              <button
                onClick={addTag}
                className="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors flex-shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('leads.notes')}</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('leads.notes_placeholder')}
              className={`${inputClass} resize-none`}
              rows={3}
            />
          </div>

          {/* Interaction History */}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <Clock size={14} className="inline text-orange-500 mr-1.5" />
              {t('leads.interaction_history')} ({comments.length})
            </p>
            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-neutral-600 text-center py-4">{t('leads.no_interactions')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50">
                    <div className="mt-0.5">
                      {c.action_taken.includes('dm') ? (
                        <Send size={14} className="text-pink-500" />
                      ) : c.action_taken.includes('reply') ? (
                        <MessageCircle size={14} className="text-blue-500" />
                      ) : (
                        <Eye size={14} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-900 dark:text-white line-clamp-2">"{c.comment_text}"</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 dark:text-neutral-600">{formatDate(c.created_at)}</span>
                        {c.action_taken.includes('reply') && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300">reply</span>
                        )}
                        {c.action_taken.includes('dm') && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300">dm</span>
                        )}
                        {c.status === 'success' ? (
                          <CheckCircle2 size={12} className="text-green-500" />
                        ) : (
                          <AlertCircle size={12} className="text-red-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversion Info */}
          {(lead.status === 'converted' || lead.tracked_link_sent) && (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                <DollarSign size={14} className="inline mr-1" />
                {t('leads.conversion_value')}
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {lead.conversion_value && (
                  <div>
                    <p className="text-green-600 dark:text-green-400 font-medium">{t('leads.conversion_value')}</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">R${lead.conversion_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
                {lead.converted_at && (
                  <div>
                    <p className="text-green-600 dark:text-green-400 font-medium">{t('leads.converted_status')}</p>
                    <p className="text-green-700 dark:text-green-300">{formatDate(lead.converted_at)}</p>
                  </div>
                )}
                {lead.tracked_link_sent && !lead.conversion_value && (
                  <div className="col-span-2">
                    <p className="text-amber-600 dark:text-amber-400 font-medium">{t('leads.tracked_link_sent')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-neutral-500">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('leads.first_interaction')}</p>
              <p>{formatDate(lead.first_interaction_at)}</p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('leads.last_interaction')}</p>
              <p>{formatDate(lead.last_interaction_at)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-neutral-800">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? t('leads.deleting') : t('leads.delete_lead')}
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('leads.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? t('leads.saving') : t('leads.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== ADD LEAD MODAL ====================

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const clean = username.trim().replace('@', '')
    if (!clean) return
    setSaving(true)
    await supabase.from('instagram_leads').insert({
      username: clean,
      source: 'manual',
      temperature: 'cold',
      status: 'new',
      notes: notes || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-md">
        <div className="p-5 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('leads.add_lead')}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">{t('leads.username')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('leads.username_placeholder')}
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">{t('leads.notes')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('leads.notes_placeholder')}
              className={`${inputClass} resize-none`}
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {t('leads.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !username.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-600/20 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? t('leads.saving') : t('leads.add_lead')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
