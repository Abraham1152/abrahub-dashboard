import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/stores/themeStore'
import { supabase } from '@/integrations/supabase'
import { Link2, Copy, Check, Plus, Trash2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jdodenbjohnqvhvldfqu.supabase.co'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec'

const CHANNELS = [
  { id: 'ig-bio',     label: 'Instagram Bio',    emoji: '📲', source: 'instagram', medium: 'bio' },
  { id: 'ig-stories', label: 'Instagram Stories', emoji: '⭕', source: 'instagram', medium: 'stories' },
  { id: 'ig-reels',   label: 'Instagram Reels',   emoji: '🎬', source: 'instagram', medium: 'reels' },
  { id: 'ig-dm',      label: 'Instagram DM',      emoji: '💬', source: 'instagram', medium: 'dm' },
  { id: 'whatsapp',   label: 'WhatsApp',          emoji: '📱', source: 'whatsapp',  medium: 'mensagem' },
  { id: 'email',      label: 'E-mail',            emoji: '✉️', source: 'email',     medium: 'newsletter' },
  { id: 'youtube',    label: 'YouTube',           emoji: '▶️', source: 'youtube',   medium: 'video' },
  { id: 'google-ads', label: 'Google Ads',        emoji: '🔍', source: 'google',    medium: 'cpc' },
  { id: 'tiktok',     label: 'TikTok',            emoji: '🎵', source: 'tiktok',    medium: 'video' },
]

interface SavedProduct {
  id: string
  label: string
  url: string
  platform: 'kiwify' | 'stripe' | 'landing_page' | 'other'
}

interface SavedLink {
  id: string
  label: string
  url: string
  created_at: string
}

const inputClass = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors'

function slugify(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}

function detectPlatform(url: string): 'kiwify' | 'stripe' | 'landing_page' | 'other' {
  if (url.includes('kiwify')) return 'kiwify'
  if (url.includes('stripe') || url.includes('buy.stripe.com')) return 'stripe'
  // URLs que não são checkout direto → landing page com script de tracking
  if (url && !url.includes('?') && (url.includes('.com') || url.includes('.com.br'))) {
    const isCheckout = url.includes('checkout') || url.includes('payment') || url.includes('pay.')
    if (!isCheckout) return 'landing_page'
  }
  return 'other'
}

export default function UTMBuilderPage() {
  useTheme()

  const [baseUrl, setBaseUrl] = useState('')
  const [newProductLabel, setNewProductLabel] = useState('')
  const [addingProduct, setAddingProduct] = useState(false)

  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [customSource, setCustomSource] = useState('')
  const [customMedium, setCustomMedium] = useState('')
  const [campaign, setCampaign] = useState('')
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [shortUrl, setShortUrl] = useState('')
  const [shortening, setShortening] = useState(false)
  const [savedLinkShorts, setSavedLinkShorts] = useState<Record<string, string>>({})
  const [savedLinkShortening, setSavedLinkShortening] = useState<Set<string>>(new Set())
  const [shortenError, setShortenError] = useState('')
  const [saveLabel, setSaveLabel] = useState('')

  const { data: savedProducts = [], refetch: refetchProducts } = useQuery<SavedProduct[]>({
    queryKey: ['utm-saved-products'],
    queryFn: async () => {
      const { data } = await supabase.from('utm_saved_products').select('*').order('created_at', { ascending: false })
      return (data || []) as SavedProduct[]
    },
  })

  const { data: savedLinks = [], refetch: refetchLinks } = useQuery<SavedLink[]>({
    queryKey: ['utm-saved-links'],
    queryFn: async () => {
      const { data } = await supabase.from('utm_saved_links').select('*').order('created_at', { ascending: false })
      return (data || []) as SavedLink[]
    },
  })


  const detectedPlatform = detectPlatform(baseUrl)

  const channel = selectedChannel === 'custom'
    ? { source: customSource, medium: customMedium }
    : CHANNELS.find(c => c.id === selectedChannel)

  const generatedUrl = (() => {
    if (!baseUrl.trim() || !channel?.source) return ''
    const params: Record<string, string> = {}
    if (channel.source)  params.utm_source   = channel.source
    if (channel.medium)  params.utm_medium   = channel.medium
    if (campaign.trim()) params.utm_campaign  = slugify(campaign)
    if (content.trim())  params.utm_content   = slugify(content)
    try {
      const url = new URL(baseUrl.trim())
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      return url.toString()
    } catch {
      const sep = baseUrl.includes('?') ? '&' : '?'
      const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      return `${baseUrl.trim()}${sep}${qs}`
    }
  })()

  const canGenerate = !!(baseUrl.trim() && selectedChannel && (selectedChannel !== 'custom' || (customSource && customMedium)))

  // Reset short URL and error when generated URL changes
  useEffect(() => { setShortUrl(''); setShortenError('') }, [generatedUrl])

  const copyLink = (url?: string) => {
    const target = url || generatedUrl
    if (!target) return
    navigator.clipboard.writeText(target)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const doShorten = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/shorten-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.short_url) {
        return data.short_url as string
      }
      setShortenError(data?.error || `Erro ao encurtar link (${res.status})`)
    } catch (e) {
      console.error('shorten error', e)
      setShortenError('Erro de conexão ao encurtar link')
    }
    return null
  }

  const shortenLink = async () => {
    if (!generatedUrl) return
    setShortening(true)
    setShortUrl('')
    setShortenError('')
    const result = await doShorten(generatedUrl)
    if (result) setShortUrl(result)
    setShortening(false)
  }

  const shortenOrCopySavedLink = async (id: string, url: string) => {
    // If already shortened, just copy
    if (savedLinkShorts[id]) {
      navigator.clipboard.writeText(savedLinkShorts[id])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    // Otherwise shorten, then copy
    setSavedLinkShortening(prev => new Set(prev).add(id))
    const result = await doShorten(url)
    if (result) {
      setSavedLinkShorts(prev => ({ ...prev, [id]: result }))
      navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setSavedLinkShortening(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const saveProduct = async () => {
    if (!baseUrl.trim() || !newProductLabel.trim()) return
    await supabase.from('utm_saved_products').insert({
      label: newProductLabel.trim(),
      url: baseUrl.trim(),
      platform: detectPlatform(baseUrl.trim()),
    })
    setNewProductLabel('')
    setAddingProduct(false)
    refetchProducts()
  }

  const deleteProduct = async (id: string) => {
    await supabase.from('utm_saved_products').delete().eq('id', id)
    refetchProducts()
  }

  const saveLink = async () => {
    if (!generatedUrl || !saveLabel.trim()) return
    await supabase.from('utm_saved_links').insert({ label: saveLabel.trim(), url: generatedUrl })
    setSaveLabel('')
    refetchLinks()
  }

  const deleteLink = async (id: string) => {
    await supabase.from('utm_saved_links').delete().eq('id', id)
    refetchLinks()
  }

  const platformInfo: Record<string, { ok: boolean; msg: string; color: string }> = {
    kiwify: {
      ok: true,
      msg: 'Kiwify captura UTMs automaticamente. As vendas vão aparecer no painel com a origem correta.',
      color: 'text-green-700 dark:text-green-300',
    },
    stripe: {
      ok: true,
      msg: 'Stripe rastreado via client_reference_id — o painel detecta automaticamente a origem da venda.',
      color: 'text-green-700 dark:text-green-300',
    },
    landing_page: {
      ok: true,
      msg: 'Landing page com script de tracking instalado. As UTMs e o ref são repassados automaticamente pro checkout quando o visitante clicar em comprar.',
      color: 'text-blue-700 dark:text-blue-300',
    },
    other: {
      ok: true,
      msg: 'Cole o link da sua página de vendas ou checkout.',
      color: 'text-gray-500 dark:text-neutral-500',
    },
  }

  const pi = platformInfo[detectedPlatform]

  // For Stripe: build client_reference_id value and URL
  const stripeClientRef = (() => {
    if (detectedPlatform !== 'stripe' || !channel?.source) return null
    const parts = [channel.source, channel.medium, slugify(campaign), slugify(content)].filter(Boolean)
    // Keep non-empty parts only
    const filtered = parts.filter(p => !!p)
    return filtered.length > 0 ? filtered.join('_') : null
  })()

  const stripeClientRefUrl = (() => {
    if (!stripeClientRef || !baseUrl.trim()) return ''
    try {
      const url = new URL(baseUrl.trim())
      url.searchParams.set('client_reference_id', stripeClientRef)
      return url.toString()
    } catch {
      const sep = baseUrl.includes('?') ? '&' : '?'
      return `${baseUrl.trim()}${sep}client_reference_id=${encodeURIComponent(stripeClientRef)}`
    }
  })()

  return (
    <div className="space-y-6 pb-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <Link2 size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gerador de Links</h1>
          <p className="text-gray-500 dark:text-neutral-500 text-sm">Crie links rastreados pra saber qual conteúdo gera mais vendas</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Como funciona?</p>
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Você pega o link de venda e adiciona uma "etiqueta" indicando de onde veio. Quando alguém comprar pelo link, o painel mostra automaticamente qual conteúdo gerou a venda.
        </p>
      </div>

      {/* Platform support info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">Kiwify ✅</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 leading-relaxed">UTMs capturados automaticamente na venda.</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">Stripe ✅</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 leading-relaxed">Rastreado via <span className="font-mono">client_reference_id</span> — link especial gerado abaixo.</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Landing Page ✅</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 leading-relaxed">Script instalado repassa todas as UTMs pro checkout automaticamente.</p>
          </div>
        </div>
      </div>

      {/* Saved Products */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Seus produtos</h2>
          <button
            onClick={() => setAddingProduct(!addingProduct)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={13} />
            Adicionar produto
          </button>
        </div>

        {addingProduct && (
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 space-y-2">
            <input
              type="url"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://pay.kiwify.com.br/seu-produto"
              className={inputClass}
              autoFocus
            />
            {baseUrl && (
              <p className={`text-xs ${pi.color}`}>
                {detectedPlatform === 'kiwify' ? '✅' : detectedPlatform === 'stripe' ? '✅' : detectedPlatform === 'landing_page' ? '✅' : 'ℹ️'} {pi.msg}
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newProductLabel}
                onChange={e => setNewProductLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveProduct()}
                placeholder="Nome do produto (ex: Curso Marketing)"
                className={`flex-1 ${inputClass}`}
              />
              <button
                onClick={saveProduct}
                disabled={!baseUrl.trim() || !newProductLabel.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        {savedProducts.length === 0 && !addingProduct && (
          <p className="text-xs text-gray-400 dark:text-neutral-600 text-center py-4">Nenhum produto salvo. Clique em "Adicionar produto" acima.</p>
        )}

        <div className="space-y-2">
          {savedProducts.map(p => (
            <button
              key={p.id}
              onClick={() => setBaseUrl(p.url)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                baseUrl === p.url
                  ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40'
                  : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-500/30'
              }`}
            >
              <span className="text-lg leading-none flex-shrink-0">
                {p.platform === 'kiwify' ? '🟢' : p.platform === 'stripe' ? '🟡' : p.platform === 'landing_page' ? '🔵' : '⚪'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{p.label}</p>
                <p className="text-[10px] font-mono text-gray-400 dark:text-neutral-600 truncate">{p.url}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                  p.platform === 'kiwify'
                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                    : p.platform === 'stripe'
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : p.platform === 'landing_page'
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'
                }`}>
                  {p.platform === 'landing_page' ? 'landing' : p.platform}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); deleteProduct(p.id) }}
                  className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-300 dark:text-neutral-600 hover:text-red-500 transition-colors ml-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </button>
          ))}
        </div>

        {/* Manual URL input if no products or want custom */}
        <div>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mb-1.5">Ou cole um link direto:</p>
          <input
            type="url"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://pay.kiwify.com.br/seu-produto"
            className={inputClass}
          />
          {baseUrl && (
            <p className={`text-xs mt-1.5 ${pi.color}`}>
              {detectedPlatform === 'kiwify' || detectedPlatform === 'stripe' || detectedPlatform === 'landing_page' ? '✅' : 'ℹ️'} {pi.msg}
            </p>
          )}
        </div>
      </div>

      {/* Step 2 - Channel */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Onde você vai usar este link?</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
                selectedChannel === ch.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-blue-300 dark:hover:border-blue-500/40'
              }`}
            >
              <span className="text-base leading-none">{ch.emoji}</span>
              <span className="text-xs">{ch.label}</span>
            </button>
          ))}
          <button
            onClick={() => setSelectedChannel('custom')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              selectedChannel === 'custom'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-blue-300 dark:hover:border-blue-500/40'
            }`}
          >
            <span className="text-base leading-none">⚙️</span>
            <span className="text-xs">Outro</span>
          </button>
        </div>

        {selectedChannel === 'custom' && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-neutral-400 block mb-1.5">Plataforma (ex: pinterest)</label>
              <input type="text" value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder="instagram" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-neutral-400 block mb-1.5">Formato (ex: stories)</label>
              <input type="text" value={customMedium} onChange={e => setCustomMedium(e.target.value)} placeholder="bio" className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {/* Step 3 - Campaign */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Nome da campanha <span className="text-gray-400 dark:text-neutral-500 font-normal">(opcional)</span>
          </h2>
        </div>
        <input
          type="text"
          value={campaign}
          onChange={e => setCampaign(e.target.value)}
          placeholder="ex: lancamento-abril, black-friday, reels-depoimento"
          className={inputClass}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-neutral-600">Sugestões:</span>
          {['lancamento-abril', 'black-friday', 'remarketing', 'organico'].map(s => (
            <button
              key={s}
              onClick={() => setCampaign(s)}
              className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Step 4 - Content */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-gray-300 dark:bg-neutral-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Conteúdo específico <span className="text-gray-400 dark:text-neutral-500 font-normal">(opcional)</span>
          </h2>
        </div>
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="ex: video-depoimento-1, carrossel-beneficios"
          className={inputClass}
        />
        <p className="text-xs text-gray-400 dark:text-neutral-600">Use quando tiver vários conteúdos na mesma campanha.</p>
      </div>

      {/* Result */}
      {canGenerate && generatedUrl && (
        <div className="card p-6 space-y-5 border-2 border-blue-200 dark:border-blue-500/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Link gerado ✅</h2>
            <button
              onClick={() => copyLink()}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700">
            <p className="text-xs font-mono text-gray-700 dark:text-neutral-300 break-all leading-relaxed">{generatedUrl}</p>
          </div>

          {/* Shorten */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={shortenLink}
              disabled={shortening}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {shortening ? '⏳ Encurtando...' : '✂️ Encurtar link'}
            </button>
            {shortUrl && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-medium truncate">{shortUrl}</span>
                <button
                  onClick={() => copyLink(shortUrl)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
            {shortenError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle size={12} />
                <span>{shortenError}</span>
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">O que cada parte registra:</p>
            {channel?.source && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-mono font-medium">utm_source={channel.source}</span>
                <span className="text-gray-500 dark:text-neutral-500">→ Plataforma de origem</span>
              </div>
            )}
            {channel?.medium && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono font-medium">utm_medium={channel.medium}</span>
                <span className="text-gray-500 dark:text-neutral-500">→ Tipo de conteúdo</span>
              </div>
            )}
            {campaign.trim() && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono font-medium">utm_campaign={slugify(campaign)}</span>
                <span className="text-gray-500 dark:text-neutral-500">→ Nome da campanha</span>
              </div>
            )}
            {content.trim() && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 font-mono font-medium">utm_content={slugify(content)}</span>
                <span className="text-gray-500 dark:text-neutral-500">→ Conteúdo específico</span>
              </div>
            )}
          </div>

          {/* Stripe client_reference_id section */}
          {detectedPlatform === 'stripe' && stripeClientRef && stripeClientRefUrl && (
            <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-3">
              <div>
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">🟢 Link Stripe com rastreamento ativado</p>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2">
                  O Stripe usa <span className="font-mono bg-gray-100 dark:bg-neutral-800 px-1 rounded">client_reference_id</span> em vez de UTMs.
                  Use este link — o painel vai identificar a origem automaticamente.
                </p>
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20">
                  <p className="text-xs font-mono text-gray-700 dark:text-neutral-300 break-all leading-relaxed">{stripeClientRefUrl}</p>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-gray-400 dark:text-neutral-500">Valor rastreado:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 font-mono text-xs font-medium">{stripeClientRef}</span>
                </div>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(stripeClientRefUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  copied ? 'bg-green-500 text-white' : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar link Stripe'}
              </button>
            </div>
          )}

          {/* Landing page info section */}
          {detectedPlatform === 'landing_page' && (
            <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 space-y-2">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🔵 Link de landing page com tracking ativado</p>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 space-y-1.5">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Quando o visitante acessar sua landing page com este link, o script instalado vai automaticamente adicionar todas as UTMs (e o <span className="font-mono bg-blue-100 dark:bg-blue-500/20 px-1 rounded">ref</span>) nos botões de compra da página.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Isso funciona para links Kiwify <em>e</em> Stripe que estejam na página.
                </p>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
            <input
              type="text"
              value={saveLabel}
              onChange={e => setSaveLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveLink()}
              placeholder="Dar um nome pra salvar (ex: Bio Abril)"
              className={`flex-1 ${inputClass}`}
            />
            <button
              onClick={saveLink}
              disabled={!saveLabel.trim()}
              className="px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40 flex items-center gap-2 flex-shrink-0"
            >
              <Plus size={16} />
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Saved links */}
      {savedLinks.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Links salvos</h2>
          <div className="space-y-2">
            {savedLinks.map(link => (
              <div key={link.id} className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{link.label}</p>
                    <p className="text-[10px] font-mono text-gray-400 dark:text-neutral-600 truncate">{link.url}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => shortenOrCopySavedLink(link.id, link.url)}
                      disabled={savedLinkShortening.has(link.id)}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        savedLinkShorts[link.id]
                          ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'
                          : 'text-gray-400 hover:text-violet-500 hover:bg-gray-200 dark:hover:bg-neutral-700'
                      }`}
                      title={savedLinkShorts[link.id] ? 'Copiar link curto' : 'Encurtar e copiar'}
                    >
                      {savedLinkShortening.has(link.id) ? <span className="text-[10px]">⏳</span> : savedLinkShorts[link.id] ? <Check size={14} /> : <span className="text-[12px]">✂️</span>}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(savedLinkShorts[link.id] || link.url)}
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-400 hover:text-blue-500"
                      title="Copiar"
                    >
                      <Copy size={14} />
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-400 hover:text-blue-500"
                      title="Abrir link"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-gray-400 hover:text-red-500"
                      title="Apagar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {savedLinkShorts[link.id] && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-medium truncate flex-1">{savedLinkShorts[link.id]}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(savedLinkShorts[link.id])}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0"
                    >
                      Copiar curto
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
