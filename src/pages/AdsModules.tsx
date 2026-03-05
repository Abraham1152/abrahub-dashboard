// AdsModules.tsx — Kill & Scale, Sandbox, Creative Diversity, Analytics modules
import { useState } from 'react'
import { supabase } from '@/integrations/supabase'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  Skull,
  TrendingUp,
  Shield,
  Pause,
  Clock,
  Crown,
  FlaskConical,
  Layers,
  X,
  Wallet,
  Scale,
  Users,
  DollarSign,
  Target,
  Ghost,
  Activity,
  Eye,
  Heart,
  Trophy,
  PieChart,
  Gauge,
  Check,
  CheckCircle,
} from 'lucide-react'

// Re-export needed types
interface NormalizedCampaign {
  id: string; campaign_id: string; name: string; status: string; daily_budget: number | null;
  lifetime_budget?: number | null; impressions: number; clicks: number; spend: number; cpc: number;
  cpm: number; ctr: number; conversions: number; cpa: number; frequency: number;
  campaign_tag: string; creative_theme: string | null; campaign_type?: string | null; platform: 'meta' | 'google';
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (n: number) => `${n.toFixed(2)}%`

function KPICard({ icon: Icon, label, value, accent, sub }: { icon: any; label: string; value: string; accent: string; sub?: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-500' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-500' },
  }
  const c = colors[accent] || colors.blue
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`p-2 rounded-xl ${c.bg}`}><Icon size={16} className={c.text} /></span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-neutral-600">{sub}</p>}
    </div>
  )
}

// ==================== KILL & SCALE ====================

export function KillScaleModule({
  killCandidates, scaleCandidates, automationRules, automationLog, queryClient, config,
}: {
  killCandidates: NormalizedCampaign[]; scaleCandidates: NormalizedCampaign[];
  automationRules: any[]; automationLog: any[]; queryClient: any; config: any
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [runningOptimizer, setRunningOptimizer] = useState(false)
  const [optimizerResult, setOptimizerResult] = useState<any>(null)
  const [editConfig, setEditConfig] = useState<Record<string, any>>({})

  // Initialize editConfig from config
  const cfg = { ...config, ...editConfig }

  const saveConfig = async () => {
    setSavingConfig(true)
    await supabase.from('ads_optimization_config' as any).update({
      target_cpa: editConfig.target_cpa ?? config?.target_cpa,
      min_roas: editConfig.min_roas ?? config?.min_roas,
      max_cpa_multiplier: editConfig.max_cpa_multiplier ?? config?.max_cpa_multiplier,
      min_daily_budget: editConfig.min_daily_budget ?? config?.min_daily_budget,
      max_daily_budget: editConfig.max_daily_budget ?? config?.max_daily_budget,
      kill_min_spend: editConfig.kill_min_spend ?? config?.kill_min_spend,
      kill_min_ctr: editConfig.kill_min_ctr ?? config?.kill_min_ctr,
      kill_max_frequency: editConfig.kill_max_frequency ?? config?.kill_max_frequency,
      scale_increase_pct: editConfig.scale_increase_pct ?? config?.scale_increase_pct,
      sandbox_test_days: editConfig.sandbox_test_days ?? config?.sandbox_test_days,
      optimizer_enabled: editConfig.optimizer_enabled ?? config?.optimizer_enabled,
      approval_mode_enabled: editConfig.approval_mode_enabled ?? config?.approval_mode_enabled,
      updated_at: new Date().toISOString(),
    }).eq('id', config?.id)
    queryClient.invalidateQueries({ queryKey: ['ads-config'] })
    setSavingConfig(false)
    setEditConfig({})
  }

  const runOptimizer = async () => {
    setRunningOptimizer(true)
    setOptimizerResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('ads-optimizer', { body: {} })
      setOptimizerResult(error ? { error: error.message } : data)
    } catch (e: any) {
      setOptimizerResult({ error: e.message })
    }
    setRunningOptimizer(false)
    queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
    queryClient.invalidateQueries({ queryKey: ['ads-automation-log'] })
  }

  const toggleRule = async (rule: any) => {
    setTogglingId(rule.id)
    await supabase.from('ads_automation_rules' as any).update({ enabled: !rule.enabled }).eq('id', rule.id)
    queryClient.invalidateQueries({ queryKey: ['ads-automation-rules'] })
    setTogglingId(null)
  }
  const killRules = automationRules.filter((r: any) => r.rule_type === 'kill')
  const scaleRules = automationRules.filter((r: any) => r.rule_type === 'scale')

  const setField = (key: string, val: any) => setEditConfig(prev => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-6">
      {/* Config Panel + Optimizer Controls */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Shield size={16} className="text-blue-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Configuracao do Optimizer</h3></div>
          <div className="flex items-center gap-2">
            <button onClick={runOptimizer} disabled={runningOptimizer} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5">
              {runningOptimizer ? <><span className="animate-spin">⟳</span> Rodando...</> : <><Activity size={12} /> Rodar Optimizer Agora</>}
            </button>
            {Object.keys(editConfig).length > 0 && (
              <button onClick={saveConfig} disabled={savingConfig} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all">
                {savingConfig ? 'Salvando...' : 'Salvar Config'}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">CPA Alvo (R$)</label>
            <input type="number" step="1" value={cfg.target_cpa ?? 100} onChange={e => setField('target_cpa', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">ROAS Minimo</label>
            <input type="number" step="0.1" value={cfg.min_roas ?? 2} onChange={e => setField('min_roas', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Max CPA Multi</label>
            <input type="number" step="0.5" value={cfg.max_cpa_multiplier ?? 3} onChange={e => setField('max_cpa_multiplier', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Budget Min (R$)</label>
            <input type="number" step="5" value={cfg.min_daily_budget ?? 30} onChange={e => setField('min_daily_budget', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Budget Max (R$)</label>
            <input type="number" step="5" value={cfg.max_daily_budget ?? 53} onChange={e => setField('max_daily_budget', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Scale % (+budget)</label>
            <input type="number" step="5" value={cfg.scale_increase_pct ?? 20} onChange={e => setField('scale_increase_pct', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Kill Min Gasto</label>
            <input type="number" step="5" value={cfg.kill_min_spend ?? 20} onChange={e => setField('kill_min_spend', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Kill Min CTR (%)</label>
            <input type="number" step="0.1" value={cfg.kill_min_ctr ?? 0.5} onChange={e => setField('kill_min_ctr', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Max Frequency</label>
            <input type="number" step="0.5" value={cfg.kill_max_frequency ?? 4} onChange={e => setField('kill_max_frequency', parseFloat(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Sandbox Test (dias)</label>
            <input type="number" step="1" value={cfg.sandbox_test_days ?? 7} onChange={e => setField('sandbox_test_days', parseInt(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold text-gray-900 dark:text-white" />
          </div>
          <div className="flex flex-col justify-end">
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Optimizer</label>
            <button onClick={() => setField('optimizer_enabled', !(cfg.optimizer_enabled ?? false))} className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${cfg.optimizer_enabled ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-red-100 dark:bg-red-500/20 text-red-600'}`}>
              {cfg.optimizer_enabled ? 'ATIVO' : 'DESLIGADO'}
            </button>
          </div>
          <div className="flex flex-col justify-end">
            <label className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Modo Aprovacao</label>
            <button onClick={() => setField('approval_mode_enabled', !(cfg.approval_mode_enabled ?? true))} className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${cfg.approval_mode_enabled !== false ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'}`}>
              {cfg.approval_mode_enabled !== false ? 'APROVACAO' : 'AUTOMATICO'}
            </button>
          </div>
        </div>
        {optimizerResult && (
          <div className={`mt-4 p-3 rounded-xl border text-xs ${optimizerResult.error ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'}`}>
            {optimizerResult.error ? (
              <p><b>Erro:</b> {optimizerResult.error}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-bold">Optimizer rodou em {optimizerResult.duration_ms}ms — {optimizerResult.campaigns_evaluated} campanhas avaliadas</p>
                <p>Kill: {optimizerResult.kill?.killed || 0} pausadas, {optimizerResult.kill?.pending || 0} pendentes</p>
                <p>Scale: {optimizerResult.scale?.scaled || 0} escaladas, {optimizerResult.scale?.pending || 0} pendentes</p>
                <p>Sandbox: {optimizerResult.sandbox?.tagged || 0} tagueadas, {optimizerResult.sandbox?.promoted || 0} promovidas, {optimizerResult.sandbox?.degraded || 0} rebaixadas</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-red-500">
          <div className="flex items-center gap-2 mb-3"><Skull size={18} className="text-red-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Kill Candidates</h3></div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{killCandidates.length}</p>
          <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">Anuncios com metricas ruins — candidatos a pausa</p>
        </div>
        <div className="card p-5 border-l-4 border-emerald-500">
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={18} className="text-emerald-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Scale Candidates</h3></div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{scaleCandidates.length}</p>
          <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">Anuncios vencedores — prontos para escala 20-30%</p>
        </div>
        <div className="card p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-3"><Shield size={18} className="text-blue-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Regras Ativas</h3></div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{automationRules.filter((r: any) => r.enabled).length}</p>
          <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">de {automationRules.length} regras configuradas</p>
        </div>
      </div>

      {killCandidates.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
            <Skull size={16} className="text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Anuncios para Pausar (Kill Rules)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-neutral-800">
                {['Campanha','Gasto','CTR','CPA','Conv.','Motivo'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>{killCandidates.map(c => {
                const reason = c.spend > 20 && c.ctr < 0.5 ? 'CTR < 0.5% (falha de atencao)' : 'Gasto > 2x CPA sem conversoes'
                return (<tr key={c.id} className="border-b border-gray-50 dark:border-neutral-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{c.name}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">{BRL(c.spend)}</td>
                  <td className="px-4 py-3 text-sm text-red-500">{fmtPct(c.ctr)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{c.cpa > 0 ? BRL(c.cpa) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{c.conversions}</td>
                  <td className="px-4 py-3"><span className="text-[10px] px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-medium">{reason}</span></td>
                </tr>)
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {scaleCandidates.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Anuncios para Escalar (+20-30%)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-neutral-800">
                {['Campanha','CPA','Conv.','Budget Atual','Sugestao +20%'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>{scaleCandidates.map(c => (<tr key={c.id} className="border-b border-gray-50 dark:border-neutral-800/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{c.name}</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{BRL(c.cpa)}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{c.conversions}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-400">{c.daily_budget ? BRL(c.daily_budget) + '/dia' : '-'}</td>
                <td className="px-4 py-3"><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{BRL((c.daily_budget || 0) * 1.2)}/dia</span></td>
              </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4"><Skull size={16} className="text-red-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Kill Rules (Pausa Automatica)</h3></div>
          <div className="space-y-3">
            {killRules.map((rule: any) => (
              <div key={rule.id} className={`p-3 rounded-xl border transition-all ${rule.enabled ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200 dark:border-red-800/50' : 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 opacity-60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{rule.name}</span>
                  <button onClick={() => toggleRule(rule)} disabled={togglingId === rule.id} className={`w-9 h-5 rounded-full transition-colors relative ${rule.enabled ? 'bg-red-500' : 'bg-gray-300 dark:bg-neutral-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-neutral-500">{rule.action_config?.reason || '-'}</p>
              </div>
            ))}
            {killRules.length === 0 && <p className="text-xs text-gray-400">Nenhuma regra de kill configurada</p>}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={16} className="text-emerald-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Scale Rules (Escala Automatica)</h3></div>
          <div className="space-y-3">
            {scaleRules.map((rule: any) => (
              <div key={rule.id} className={`p-3 rounded-xl border transition-all ${rule.enabled ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/50' : 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 opacity-60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{rule.name}</span>
                  <button onClick={() => toggleRule(rule)} disabled={togglingId === rule.id} className={`w-9 h-5 rounded-full transition-colors relative ${rule.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-neutral-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-neutral-500">{rule.action_config?.reason || '-'}</p>
                {rule.action_config?.pct && <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">+{rule.action_config.pct}% a cada {rule.action_config.interval_hours || 48}h</span>}
              </div>
            ))}
            {scaleRules.length === 0 && <p className="text-xs text-gray-400">Nenhuma regra de escala configurada</p>}
          </div>
        </div>
      </div>

      {automationLog.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2"><Clock size={16} className="text-gray-400" /><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historico de Automacao</h3></div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50 dark:divide-neutral-800/50">
            {automationLog.map((log: any) => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                <span className={`p-1.5 rounded-lg shrink-0 ${log.rule_type === 'kill' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                  {log.rule_type === 'kill' ? <Pause size={12} /> : <TrendingUp size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{log.campaign_name || log.campaign_id}</p>
                  <p className="text-[10px] text-gray-500 dark:text-neutral-500">{log.rule_name} — {log.action_taken}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{new Date(log.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== SANDBOX ====================

export function SandboxModule({ campaigns, champions, challengers, queryClient }: {
  campaigns: NormalizedCampaign[]; champions: NormalizedCampaign[]; challengers: NormalizedCampaign[]; queryClient: any
}) {
  const [tagging, setTagging] = useState<string | null>(null)
  const untagged = campaigns.filter((c: any) => !c.campaign_tag || c.campaign_tag === 'untagged')
  const tagCampaign = async (campaignId: string, tag: string) => {
    setTagging(campaignId)
    await supabase.from('ads_campaigns').update({ campaign_tag: tag }).eq('campaign_id', campaignId)
    queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] })
    setTagging(null)
  }
  const CampaignGroup = ({ title, icon: Icon, color, items, emptyMsg }: { title: string; icon: any; color: string; items: NormalizedCampaign[]; emptyMsg: string }) => (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4"><Icon size={16} className={color} /><h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3><span className="ml-auto text-xs font-bold text-gray-400">{items.length}</span></div>
      {items.length === 0 ? <p className="text-xs text-gray-400 dark:text-neutral-500 text-center py-6">{emptyMsg}</p> : (
        <div className="space-y-2">{items.map(c => (
          <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-neutral-700">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-gray-500">Gasto: {BRL(c.spend)}</span>
                <span className="text-[10px] text-gray-500">CPA: {c.cpa > 0 ? BRL(c.cpa) : '-'}</span>
                <span className="text-[10px] text-gray-500">Conv: {c.conversions}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => tagCampaign(c.campaign_id, 'champion')} disabled={tagging === c.campaign_id} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10" title="Champion"><Crown size={14} /></button>
              <button onClick={() => tagCampaign(c.campaign_id, 'challenger')} disabled={tagging === c.campaign_id} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10" title="Challenger"><FlaskConical size={14} /></button>
              <button onClick={() => tagCampaign(c.campaign_id, 'untagged')} disabled={tagging === c.campaign_id} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700" title="Remover"><X size={14} /></button>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  )
  const champSpend = champions.reduce((s, c) => s + c.spend, 0)
  const challSpend = challengers.reduce((s, c) => s + c.spend, 0)
  const champConv = champions.reduce((s, c) => s + c.conversions, 0)
  const challConv = challengers.reduce((s, c) => s + c.conversions, 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Crown} label="Champions" value={String(champions.length)} accent="amber" sub={champConv > 0 ? 'CPA: ' + BRL(champSpend / champConv) : undefined} />
        <KPICard icon={FlaskConical} label="Challengers" value={String(challengers.length)} accent="blue" sub={challConv > 0 ? 'CPA: ' + BRL(challSpend / challConv) : undefined} />
        <KPICard icon={Wallet} label="Gasto Champions" value={BRL(champSpend)} accent="amber" />
        <KPICard icon={Wallet} label="Gasto Challengers" value={BRL(challSpend)} accent="blue" />
      </div>
      <div className="card p-4 border-2 border-blue-200 dark:border-blue-800/50">
        <div className="flex items-start gap-3">
          <FlaskConical size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Sandbox Engine: Campeao-Desafiante</h4>
            <p className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
              Separe campanhas de <b>teste (Challenger)</b> das de <b>escala (Champion)</b>. Challengers usam ABO ou CBO com minimo de gasto por 4-7 dias. Quando vencer, promova a Champion e migre usando Post ID.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CampaignGroup title="Champions (Escala)" icon={Crown} color="text-amber-500" items={champions} emptyMsg="Nenhum champion. Tagueie vencedoras." />
        <CampaignGroup title="Challengers (Teste)" icon={FlaskConical} color="text-blue-500" items={challengers} emptyMsg="Nenhum challenger. Crie testes." />
        <CampaignGroup title="Sem Tag" icon={Layers} color="text-gray-400" items={untagged} emptyMsg="Tudo tagueado!" />
      </div>
    </div>
  )
}

// ==================== CREATIVE DIVERSITY ====================

export function CreativeDiversityModule({ campaigns, diversityScore }: { campaigns: NormalizedCampaign[]; diversityScore: number }) {
  const themes = ['lifestyle', 'product', 'ugc', 'testimonial', 'educational', 'studio_video', 'carousel']
  const themeLabels: Record<string, string> = { lifestyle: 'Estilo de Vida', product: 'Produto', ugc: 'UGC', testimonial: 'Depoimento', educational: 'Educacional', studio_video: 'Video Estudio', carousel: 'Carrossel' }
  const themeColors: Record<string, string> = { lifestyle: '#8b5cf6', product: '#3b82f6', ugc: '#10b981', testimonial: '#f59e0b', educational: '#ec4899', studio_video: '#6366f1', carousel: '#14b8a6' }
  const themeCounts = themes.map(t => ({ name: themeLabels[t], value: campaigns.filter((c: any) => c.creative_theme === t).length, fill: themeColors[t] })).filter(t => t.value > 0)
  const untaggedCount = campaigns.filter((c: any) => !c.creative_theme || !themes.includes(c.creative_theme as string)).length

  return (
    <div className="space-y-6">
      <div className="card p-5 border-2 border-purple-200 dark:border-purple-800/50">
        <div className="flex items-start gap-3">
          <Layers size={20} className="text-purple-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Diversidade Criativa & Entity IDs</h4>
            <p className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
              A IA da Meta agrupa anuncios parecidos sob o mesmo "Entity ID". Use <b>"Som Surround"</b>: <b>1 video estudio + 1 UGC + 1 lifestyle + 1 carrossel</b>.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Gauge size={16} className="text-purple-500" /> Pontuacao de Diversidade</h3>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-neutral-700" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={diversityScore >= 7 ? '#10b981' : diversityScore >= 4 ? '#f59e0b' : '#ef4444'} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(diversityScore / 10) * 314} 314`} transform="rotate(-90 60 60)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-bold text-gray-900 dark:text-white">{diversityScore}/10</span></div>
            </div>
          </div>
          <p className="text-xs text-center text-gray-500 dark:text-neutral-500">{diversityScore >= 7 ? 'Excelente diversidade!' : diversityScore >= 4 ? 'Boa — pode melhorar' : 'Baixa — risco de Entity ID duplicado'}</p>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><PieChart size={16} className="text-blue-500" /> Distribuicao por Tema</h3>
          {themeCounts.length > 0 ? (
            <div className="space-y-2">
              {themeCounts.map(t => (<div key={t.name} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.fill }} /><span className="text-xs text-gray-700 dark:text-neutral-300 flex-1">{t.name}</span><span className="text-xs font-bold text-gray-900 dark:text-white">{t.value}</span></div>))}
              {untaggedCount > 0 && <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full shrink-0 bg-gray-300 dark:bg-neutral-600" /><span className="text-xs text-gray-500 flex-1">Sem tema ({untaggedCount})</span></div>}
            </div>
          ) : (<div className="text-center py-8"><Layers size={32} className="mx-auto text-gray-300 dark:text-neutral-600 mb-2" /><p className="text-xs text-gray-400">Nenhuma campanha com tema definido.</p></div>)}
        </div>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Checklist Som Surround</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ theme: 'studio_video', label: 'Video Estudio', icon: '🎬' }, { theme: 'ugc', label: 'Video UGC', icon: '📱' }, { theme: 'lifestyle', label: 'Imagem Lifestyle', icon: '🖼️' }, { theme: 'carousel', label: 'Carrossel Educacional', icon: '📚' }].map(item => {
            const hasIt = campaigns.some((c: any) => c.creative_theme === item.theme && (c.status === 'ACTIVE' || c.status === 'ENABLED'))
            return (<div key={item.theme} className={`p-3 rounded-xl border text-center ${hasIt ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-700' : 'bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'}`}>
              <span className="text-2xl">{item.icon}</span>
              <p className="text-xs font-medium text-gray-900 dark:text-white mt-1">{item.label}</p>
              {hasIt ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1"><Check size={10} /> Ativo</span> : <span className="text-[10px] text-gray-400 mt-1 block">Faltando</span>}
            </div>)
          })}
        </div>
      </div>
    </div>
  )
}

// ==================== ANALYTICS ====================

export function AnalyticsModule({
  campaigns, totalSpend, totalRevenue, mer, ncPct, newCustomers, totalConversions, avgCpa, avgCtr, dailyAds, spendDominance, isDark,
}: {
  campaigns: NormalizedCampaign[]; totalSpend: number; totalRevenue: number; mer: number; ncPct: number; newCustomers: number;
  totalConversions: number; avgCpa: number; avgCtr: number; dailyAds: any[]; spendDominance: { name: string; spend: number; pct: number }[]; isDark: boolean
}) {
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Scale} label="MER (Ads)" value={mer > 0 ? mer.toFixed(2) + 'x' : '-'} accent={mer >= 3 ? 'emerald' : mer >= 2 ? 'blue' : 'amber'} sub="Receita Ads / Gasto" />
        <KPICard icon={Users} label="NC%" value={ncPct > 0 ? ncPct.toFixed(0) + '%' : '-'} accent={ncPct >= 60 ? 'emerald' : ncPct >= 50 ? 'amber' : 'red'} sub={ncPct < 50 ? 'ABAIXO IDEAL' : 'Meta: >60%'} />
        <KPICard icon={DollarSign} label="Receita Ads" value={BRL(totalRevenue)} accent="emerald" sub={totalConversions + ' vendas rastreadas'} />
        <KPICard icon={Target} label="CPA Medio" value={avgCpa > 0 ? BRL(avgCpa) : '-'} accent="purple" />
      </div>

      {/* Phantom Growth */}
      <div className={`card p-5 border-2 ${ncPct > 0 && ncPct < 50 ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-neutral-800'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ncPct > 0 && ncPct < 50 ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}><Ghost size={20} className="text-white" /></div>
          <div><h3 className="text-sm font-bold text-gray-900 dark:text-white">Detector de Crescimento Fantasma</h3><p className="text-xs text-gray-500 dark:text-neutral-500">Compara ROAS vs novos clientes reais</p></div>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${ncPct > 0 && ncPct < 50 ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>{ncPct > 0 && ncPct < 50 ? 'ALERTA ATIVO' : 'SAUDAVEL'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800"><p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">ROAS (Ads Only)</p><p className="text-xl font-bold text-gray-900 dark:text-white">{totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) + 'x' : '-'}</p><p className="text-[9px] text-gray-400 mt-1">So vendas com UTM</p></div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800"><p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">Novos Clientes</p><p className="text-xl font-bold text-gray-900 dark:text-white">{newCustomers}</p><p className="text-[10px] text-gray-400">{ncPct > 0 ? ncPct.toFixed(0) + '% do total' : '-'}</p></div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800"><p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">NC ROAS</p><p className="text-xl font-bold text-gray-900 dark:text-white">{newCustomers > 0 && totalSpend > 0 ? ((totalRevenue * (ncPct / 100)) / totalSpend).toFixed(2) + 'x' : '-'}</p></div>
        </div>
        {ncPct > 0 && ncPct < 50 && (<div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/50"><p className="text-xs text-red-700 dark:text-red-400 leading-relaxed"><b>Acao recomendada:</b> Adicione listas de exclusao (compradores passados, visitantes) para forcar o algoritmo a buscar trafego frio.</p></div>)}
      </div>

      {/* Funnel */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Activity size={16} className="text-blue-500" /> Metricas de Funil</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-500/5">
            <div className="flex items-center gap-2 mb-3"><Eye size={14} className="text-blue-500" /><h4 className="text-xs font-bold text-blue-700 dark:text-blue-400">Atencao</h4></div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-[11px] text-gray-600 dark:text-neutral-400">CTR</span><span className={`text-[11px] font-bold ${avgCtr >= 1 ? 'text-emerald-600' : avgCtr >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>{avgCtr.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-gray-600 dark:text-neutral-400">CPC Medio</span><span className="text-[11px] font-bold text-gray-900 dark:text-white">{totalClicks > 0 ? BRL(totalSpend / totalClicks) : '-'}</span></div>
              <p className="text-[9px] text-gray-400 mt-2">CTR &lt; 0.5% = gancho falhou</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/30 dark:bg-purple-500/5">
            <div className="flex items-center gap-2 mb-3"><Heart size={14} className="text-purple-500" /><h4 className="text-xs font-bold text-purple-700 dark:text-purple-400">Intencao</h4></div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-[11px] text-gray-600 dark:text-neutral-400">Click-to-Conv</span><span className="text-[11px] font-bold text-gray-900 dark:text-white">{totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) + '%' : '-'}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-gray-600 dark:text-neutral-400">Conversoes</span><span className="text-[11px] font-bold text-gray-900 dark:text-white">{totalConversions}</span></div>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-3"><Trophy size={14} className="text-emerald-500" /><h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Sucesso</h4></div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-[11px] text-gray-600 dark:text-neutral-400">CPA</span><span className="text-[11px] font-bold text-gray-900 dark:text-white">{avgCpa > 0 ? BRL(avgCpa) : '-'}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-gray-600 dark:text-neutral-400">Win Rate</span><span className="text-[11px] font-bold text-gray-900 dark:text-white">{campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED').length > 0 ? ((campaigns.filter(c => c.conversions > 0).length / Math.max(1, campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED').length)) * 100).toFixed(0) + '%' : '-'}</span></div>
              <p className="text-[9px] text-gray-400 mt-2">Win Rate saudavel: 15-25%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Spend Distribution */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><PieChart size={16} className="text-amber-500" /> Distribuicao de Gasto</h3>
        {spendDominance.length > 0 ? (
          <div className="space-y-2">{spendDominance.slice(0, 10).map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400 w-4 text-right">{i + 1}.</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-700 dark:text-neutral-300 truncate max-w-[60%]">{c.name}</span><span className="text-xs font-bold text-gray-900 dark:text-white">{BRL(c.spend)} ({c.pct.toFixed(1)}%)</span></div>
                <div className="w-full h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c.pct > 80 ? 'bg-red-500' : c.pct > 50 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: c.pct + '%' }} /></div>
              </div>
            </div>
          ))}</div>
        ) : <p className="text-xs text-gray-400 text-center py-6">Sem dados de gasto</p>}
      </div>

      {dailyAds.length > 2 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-indigo-500" /> Tendencia Diaria (30 dias)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[...dailyAds].reverse()} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={(d: string) => d ? d.substring(5) : ''} tick={{ fill: isDark ? '#737373' : '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: isDark ? '#737373' : '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: isDark ? '#262626' : '#fff', border: '1px solid ' + (isDark ? '#404040' : '#e5e7eb'), borderRadius: '12px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="total_spend" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Gasto (R$)" />
              <Line type="monotone" dataKey="total_conversions" stroke="#10b981" strokeWidth={2} dot={false} name="Conversoes" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
