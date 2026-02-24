import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useTheme } from '@/stores/themeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useState } from 'react'
import {
  Instagram,
  MessageCircle,
  Heart,
  Eye,
  Send,
  Plus,
  X,
  Check,
  Trash2,
  RefreshCw,
  Settings,
  Pause,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
  Bot,
  Reply,
  Link2,
} from 'lucide-react'

// ==================== TYPES ====================

interface InstagramPost {
  id: string
  media_id: string
  media_type: string
  caption: string | null
  permalink: string | null
  timestamp: string
  like_count: number
  comments_count: number
  reach: number
  impressions: number
  saves: number
  shares: number
  thumbnail_url: string | null
}

interface DmButton {
  url: string
  title: string
}

interface Automation {
  id: string
  media_id: string
  media_permalink: string | null
  media_caption: string | null
  media_thumbnail: string | null
  is_active: boolean
  keywords: string[]
  reply_comments: string[]
  dm_message: string | null
  dm_link: string | null
  dm_buttons: DmButton[]
  respond_to_all: boolean
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

type ActiveTab = 'posts' | 'log'

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

const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-colors'

// ==================== MAIN PAGE ====================

export default function InstaNinjaPage() {
  useTheme()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('posts')
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null)
  const [syncing, setSyncing] = useState(false)

  // Fetch posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['instagram-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_posts')
        .select('*')
        .order('timestamp', { ascending: false })
      return (data || []) as InstagramPost[]
    },
  })

  // Fetch automations
  const { data: automations = [] } = useQuery({
    queryKey: ['instagram-automations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_automations')
        .select('*')
        .order('created_at', { ascending: false })
      return (data || []) as Automation[]
    },
  })

  // Fetch processed comments log
  const { data: processedComments = [] } = useQuery({
    queryKey: ['instagram-processed-comments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('instagram_processed_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      return (data || []) as ProcessedComment[]
    },
  })

  // Map: media_id -> automation
  const automationMap = new Map(automations.map(a => [a.media_id, a]))

  // Stats
  const activeAutomations = automations.filter(a => a.is_active).length
  const todayLogs = processedComments.filter(p => {
    const today = new Date().toISOString().split('T')[0]
    return p.created_at.startsWith(today)
  })
  const todayDMs = todayLogs.filter(p => p.action_taken.includes('dm')).length
  const todayReplies = todayLogs.filter(p => p.action_taken.includes('reply')).length

  // Sync posts from Instagram
  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch(
        `https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-instagram`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      )
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] })
    } catch {}
    setSyncing(false)
  }

  if (postsLoading) {
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
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('instaninja.title')}</h1>
              <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('instaninja.subtitle')}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {t('instaninja.sync_posts')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Bot} label={t('instaninja.active_automations')} value={activeAutomations.toString()} color="purple" />
        <StatCard icon={Send} label={t('instaninja.dms_today')} value={todayDMs.toString()} color="pink" />
        <StatCard icon={Reply} label={t('instaninja.replies_today')} value={todayReplies.toString()} color="blue" />
        <StatCard icon={MessageCircle} label={t('instaninja.total_processed')} value={fmt(processedComments.length)} color="green" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'posts'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-600/20'
              : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-neutral-700'
          }`}
        >
          <Instagram size={18} /> {t('instaninja.posts')} ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'log'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-600/20'
              : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-neutral-700'
          }`}
        >
          <Clock size={18} /> {t('instaninja.activity_log')} ({processedComments.length})
        </button>
      </div>

      {activeTab === 'posts' ? (
        <PostsGrid
          posts={posts}
          automationMap={automationMap}
          onConfigure={setEditingPost}
        />
      ) : (
        <ActivityLog logs={processedComments} />
      )}

      {/* Automation Config Modal */}
      {editingPost && (
        <AutomationModal
          post={editingPost}
          existingAutomation={automationMap.get(editingPost.media_id) || null}
          onClose={() => {
            setEditingPost(null)
            queryClient.invalidateQueries({ queryKey: ['instagram-automations'] })
          }}
        />
      )}
    </div>
  )
}

// ==================== STAT CARD ====================

function StatCard({ icon: Icon, label, value, color }: {
  icon: any
  label: string
  value: string
  color: 'purple' | 'pink' | 'blue' | 'green'
}) {
  const colors = {
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    pink: 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400',
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

// ==================== POSTS GRID ====================

function PostsGrid({ posts, automationMap, onConfigure }: {
  posts: InstagramPost[]
  automationMap: Map<string, Automation>
  onConfigure: (post: InstagramPost) => void
}) {
  const { t } = useTranslation()

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <Instagram size={48} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
        <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('instaninja.no_posts')}</p>
        <p className="text-gray-400 dark:text-neutral-600 text-xs mt-1">{t('instaninja.click_sync')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {posts.map(post => {
        const automation = automationMap.get(post.media_id)
        const isActive = automation?.is_active || false
        const hasAutomation = !!automation

        return (
          <div
            key={post.id}
            className="card overflow-hidden group cursor-pointer hover:shadow-lg transition-all"
            onClick={() => onConfigure(post)}
          >
            {/* Thumbnail */}
            <div className="relative aspect-square bg-gray-100 dark:bg-neutral-800">
              {post.thumbnail_url || post.permalink ? (
                <img
                  src={post.thumbnail_url || ''}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Instagram size={32} className="text-gray-300 dark:text-neutral-600" />
                </div>
              )}

              {/* Automation badge */}
              <div className="absolute top-2 right-2">
                {isActive ? (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-green-500 text-white shadow-lg">
                    <Zap size={10} /> {t('instaninja.active')}
                  </span>
                ) : hasAutomation ? (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-yellow-500 text-white shadow-lg">
                    <Pause size={10} /> {t('instaninja.paused')}
                  </span>
                ) : null}
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-semibold border border-white/30">
                  <Settings size={16} className="inline mr-1.5" />
                  {hasAutomation ? t('instaninja.adjust') : t('instaninja.configure')}
                </button>
              </div>

              {/* Media type badge */}
              <div className="absolute bottom-2 left-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white">
                  {post.media_type === 'VIDEO' ? t('instaninja.video') : post.media_type === 'CAROUSEL_ALBUM' ? t('instaninja.carousel') : post.media_type === 'REEL' ? t('instaninja.reel') : t('instaninja.photo')}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-pink-500">
                    <Heart size={12} />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{fmt(post.like_count)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-blue-500">
                    <MessageCircle size={12} />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{fmt(post.comments_count)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-purple-500">
                    <Eye size={12} />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{fmt(post.reach)}</span>
                  </div>
                </div>
              </div>

              {/* Caption preview */}
              {post.caption && (
                <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-2 line-clamp-2 leading-tight">
                  {post.caption.substring(0, 80)}
                </p>
              )}

              {/* Keywords preview if automation exists */}
              {automation && automation.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {automation.keywords.slice(0, 3).map((kw, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                      {kw}
                    </span>
                  ))}
                  {automation.keywords.length > 3 && (
                    <span className="text-[9px] text-gray-400 dark:text-neutral-500">+{automation.keywords.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ==================== AUTOMATION MODAL ====================

function AutomationModal({ post, existingAutomation, onClose }: {
  post: InstagramPost
  existingAutomation: Automation | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [isActive, setIsActive] = useState(existingAutomation?.is_active ?? true)
  const [respondToAll, setRespondToAll] = useState(existingAutomation?.respond_to_all ?? false)
  const [keywords, setKeywords] = useState<string[]>(existingAutomation?.keywords || [])
  const [newKeyword, setNewKeyword] = useState('')
  const [replyComments, setReplyComments] = useState<string[]>(existingAutomation?.reply_comments || [])
  const [newReply, setNewReply] = useState('')
  const [dmMessage, setDmMessage] = useState(existingAutomation?.dm_message || '')
  const [dmLink, setDmLink] = useState(existingAutomation?.dm_link || '')
  const [dmButtons, setDmButtons] = useState<DmButton[]>(existingAutomation?.dm_buttons || [])
  const [newButtonUrl, setNewButtonUrl] = useState('')
  const [newButtonTitle, setNewButtonTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setNewKeyword('')
    }
  }

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index))
  }

  const addReply = () => {
    const r = newReply.trim()
    if (r && !replyComments.includes(r)) {
      setReplyComments([...replyComments, r])
      setNewReply('')
    }
  }

  const removeReply = (index: number) => {
    setReplyComments(replyComments.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      media_id: post.media_id,
      media_permalink: post.permalink,
      media_caption: post.caption?.substring(0, 200) || null,
      media_thumbnail: post.thumbnail_url,
      is_active: isActive,
      keywords,
      reply_comments: replyComments,
      dm_message: dmMessage || null,
      dm_link: dmLink || null,
      dm_buttons: dmButtons,
      respond_to_all: respondToAll,
      updated_at: new Date().toISOString(),
    }

    if (existingAutomation) {
      await supabase
        .from('instagram_automations')
        .update(payload)
        .eq('id', existingAutomation.id)
    } else {
      await supabase
        .from('instagram_automations')
        .insert(payload)
    }

    setSaving(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!existingAutomation) return
    setDeleting(true)
    await supabase
      .from('instagram_automations')
      .delete()
      .eq('id', existingAutomation.id)
    setDeleting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 p-5 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Instagram size={20} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('instaninja.config_title')}</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-500 line-clamp-1">
                  {post.caption?.substring(0, 60) || t('instaninja.no_caption')}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('instaninja.automation_active')}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-500">{t('instaninja.toggle_desc')}</p>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Respond to All Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('instaninja.respond_all')}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-500">{t('instaninja.respond_all_desc')}</p>
            </div>
            <button
              onClick={() => setRespondToAll(!respondToAll)}
              className={`relative w-12 h-6 rounded-full transition-colors ${respondToAll ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${respondToAll ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Keywords */}
          {!respondToAll && (
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">
                {t('instaninja.keywords')}
              </label>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
                {t('instaninja.keywords_desc')}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300"
                  >
                    {kw}
                    <button onClick={() => removeKeyword(i)} className="hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  placeholder={t('instaninja.keyword_placeholder')}
                  className={inputClass}
                  maxLength={128}
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors flex-shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Reply Comments */}
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">
              {t('instaninja.comment_replies')}
            </label>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
              {t('instaninja.comment_replies_desc')}
            </p>
            <div className="space-y-2 mb-3">
              {replyComments.map((reply, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white">
                    <Reply size={12} className="inline text-blue-500 mr-1.5" />
                    {reply}
                  </div>
                  <button onClick={() => removeReply(i)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newReply}
                onChange={e => setNewReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReply())}
                placeholder={t('instaninja.reply_placeholder')}
                className={inputClass}
                maxLength={256}
              />
              <button
                onClick={addReply}
                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* DM Message */}
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">
              <Send size={14} className="inline text-pink-500 mr-1.5" />
              {t('instaninja.dm_message')}
            </label>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
              {t('instaninja.dm_desc')}
            </p>
            <textarea
              value={dmMessage}
              onChange={e => setDmMessage(e.target.value)}
              placeholder={t('instaninja.dm_placeholder')}
              className={`${inputClass} resize-none`}
              rows={3}
              maxLength={400}
            />
            <p className="text-[10px] text-gray-400 dark:text-neutral-600 text-right mt-1">
              {dmMessage.length} / 400
            </p>
          </div>

          {/* DM Buttons */}
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">
              <Link2 size={14} className="inline text-pink-500 mr-1.5" />
              {t('instaninja.dm_buttons')}
              <span className="text-xs font-normal text-gray-400 dark:text-neutral-500 ml-2">{t('instaninja.max_buttons')}</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
              {t('instaninja.buttons_desc')}
            </p>

            {/* Existing buttons */}
            <div className="space-y-2 mb-3">
              {dmButtons.map((btn, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm">
                    <Link2 size={12} className="inline text-pink-500 mr-1.5" />
                    <span className="text-gray-900 dark:text-white font-medium">{btn.title}</span>
                    <span className="text-gray-400 dark:text-neutral-500 ml-2 text-xs">{btn.url}</span>
                  </div>
                  <button
                    onClick={() => setDmButtons(dmButtons.filter((_, idx) => idx !== i))}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new button */}
            {dmButtons.length < 3 && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newButtonUrl}
                  onChange={e => setNewButtonUrl(e.target.value)}
                  placeholder="https://abrahub.com/live"
                  className={`${inputClass} flex-1`}
                />
                <input
                  type="text"
                  value={newButtonTitle}
                  onChange={e => setNewButtonTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (newButtonUrl.trim() && newButtonTitle.trim()) {
                        setDmButtons([...dmButtons, { url: newButtonUrl.trim(), title: newButtonTitle.trim() }])
                        setNewButtonUrl('')
                        setNewButtonTitle('')
                      }
                    }
                  }}
                  placeholder="Titulo do botao"
                  className={`${inputClass} w-40`}
                  maxLength={30}
                />
                <button
                  onClick={() => {
                    if (newButtonUrl.trim() && newButtonTitle.trim()) {
                      setDmButtons([...dmButtons, { url: newButtonUrl.trim(), title: newButtonTitle.trim() }])
                      setNewButtonUrl('')
                      setNewButtonTitle('')
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 transition-colors flex-shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>

          {/* DM Preview */}
          {(dmMessage || dmButtons.length > 0) && (
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-3">
                <Eye size={14} className="inline text-purple-500 mr-1.5" />
                {t('instaninja.preview')}
              </label>
              <div className="max-w-xs mx-auto">
                <div className="bg-gray-100 dark:bg-neutral-800 rounded-2xl p-4 space-y-3">
                  {/* Message bubble */}
                  {dmMessage && (
                    <div className="bg-white dark:bg-neutral-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{dmMessage}</p>
                    </div>
                  )}
                  {/* Buttons */}
                  {dmButtons.map((btn, i) => (
                    <button
                      key={i}
                      className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors shadow-sm text-center"
                    >
                      {btn.title}
                    </button>
                  ))}
                  {/* Link fallback (if no buttons but has link) */}
                  {dmLink && dmButtons.length === 0 && (
                    <div className="bg-white dark:bg-neutral-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                      <p className="text-sm text-blue-600 dark:text-blue-400 underline break-all">{dmLink}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-center text-gray-400 dark:text-neutral-600 mt-2">{t('instaninja.preview_desc')}</p>
              </div>
            </div>
          )}

          {/* DM Link (simple fallback) */}
          {dmButtons.length === 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-900 dark:text-white block mb-2">
                <Link2 size={14} className="inline text-pink-500 mr-1.5" />
                {t('instaninja.simple_link')}
              </label>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
                {t('instaninja.simple_link_desc')}
              </p>
              <input
                type="url"
                value={dmLink}
                onChange={e => setDmLink(e.target.value)}
                placeholder="https://..."
                className={inputClass}
                maxLength={600}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-neutral-800">
            {existingAutomation ? (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                {deleting ? t('instaninja.deleting') : t('instaninja.delete_automation')}
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? t('instaninja.saving') : t('instaninja.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== ACTIVITY LOG ====================

function ActivityLog({ logs }: { logs: ProcessedComment[] }) {
  const { t } = useTranslation()

  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock size={48} className="mx-auto text-gray-300 dark:text-neutral-700 mb-3" />
        <p className="text-gray-500 dark:text-neutral-500 text-sm">{t('instaninja.no_activity')}</p>
        <p className="text-gray-400 dark:text-neutral-600 text-xs mt-1">{t('instaninja.activity_hint')}</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-neutral-800">
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('instaninja.when')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('instaninja.user')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('instaninja.comment')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('instaninja.action')}</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{t('instaninja.status')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-gray-50 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-500 whitespace-nowrap">
                  {timeAgo(log.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">@{log.commenter_username}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 dark:text-neutral-400 line-clamp-1 max-w-[250px]">
                    "{log.comment_text?.substring(0, 60)}"
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {log.action_taken.includes('reply') && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        {t('instaninja.reply')}
                      </span>
                    )}
                    {log.action_taken.includes('dm') && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300">
                        {t('instaninja.dm')}
                      </span>
                    )}
                    {log.action_taken === 'none' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400">
                        {t('instaninja.none')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {log.status === 'success' ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                      <CheckCircle2 size={14} /> {t('instaninja.ok')}
                    </span>
                  ) : log.status === 'partial' ? (
                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                      <AlertCircle size={14} /> {t('instaninja.partial')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium" title={log.error_message || ''}>
                      <AlertCircle size={14} /> {t('instaninja.error')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
