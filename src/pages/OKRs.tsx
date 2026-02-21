import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

type OKR = {
  id: string
  quarter: string
  category: 'revenue' | 'growth' | 'product' | 'operations'
  title: string
  target_value: number
  current_value: number
}

export default function OKRsPage() {
  const queryClient = useQueryClient()
  const [selectedQuarter, setSelectedQuarter] = useState('Q1-2025')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    category: 'revenue' as OKR['category'],
    title: '',
    targetValue: '',
  })

  const { data: okrs = [] } = useQuery({
    queryKey: ['okrs', selectedQuarter],
    queryFn: async () => {
      const { data } = await supabase
        .from('okrs')
        .select('*')
        .eq('quarter', selectedQuarter)
        .order('category')
      return data as OKR[]
    },
  })

  const createOKRMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('okrs').insert({
        quarter: selectedQuarter,
        category: formData.category,
        title: formData.title,
        target_value: parseFloat(formData.targetValue),
        current_value: 0,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okrs'] })
      setFormData({ category: 'revenue', title: '', targetValue: '' })
      setShowForm(false)
    },
  })

  const deleteOKRMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('okrs').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okrs'] })
    },
  })

  const categories = ['revenue', 'growth', 'product', 'operations'] as const
  const categoryConfig = {
    revenue: { label: 'Receita', color: 'emerald', icon: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    growth: { label: 'Crescimento', color: 'blue', icon: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    product: { label: 'Produto', color: 'violet', icon: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    operations: { label: 'Operacoes', color: 'amber', icon: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  }
  const barColors: Record<string, string> = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', violet: 'bg-violet-500', amber: 'bg-amber-500' }

  const quarters = ['Q1-2025', 'Q2-2025', 'Q3-2025', 'Q4-2025']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metas Trimestrais (OKRs)</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Objetivos e Key Results por trimestre</p>
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl p-1">
          {quarters.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedQuarter === q
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Adicionar Meta
        </button>
      </div>

      {showForm && (
        <div className="card p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (formData.title && formData.targetValue) createOKRMutation.mutate()
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Categoria</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as any })} className="w-full">
                {categories.map((c) => (
                  <option key={c} value={c}>{categoryConfig[c].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Meta</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Aumentar MRR em 50%" className="w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Valor Alvo</label>
              <input type="number" value={formData.targetValue} onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })} placeholder="Ex: 50000" className="w-full" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 text-sm">Adicionar</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-neutral-700 text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {categories.map((category) => {
          const cfg = categoryConfig[category]
          const categoryOKRs = okrs.filter((o) => o.category === category)
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${cfg.icon}`}>{cfg.label}</span>
                <span className="text-xs text-gray-400 dark:text-neutral-500">{categoryOKRs.length} metas</span>
              </div>
              <div className="space-y-2">
                {categoryOKRs.length === 0 ? (
                  <p className="text-gray-400 dark:text-neutral-600 text-sm pl-1">Nenhuma meta</p>
                ) : (
                  categoryOKRs.map((okr) => {
                    const progress = okr.target_value > 0 ? (okr.current_value / okr.target_value) * 100 : 0
                    return (
                      <div key={okr.id} className="card p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">{okr.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                              {okr.current_value.toLocaleString('pt-BR')} / {okr.target_value.toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteOKRMutation.mutate(okr.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`${barColors[cfg.color]} h-full rounded-full transition-all`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-1.5">
                          {Math.round(progress)}% concluido
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
