import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useAuth } from '@/stores/authStore'
import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'

type Decision = {
  id: string
  decision: string
  reason: string
  decided_by: string
  decided_at: string
  result_observed: string | null
}

export default function DecisionsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { t, lang } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [decision, setDecision] = useState('')
  const [reason, setReason] = useState('')

  const { data: decisions = [] } = useQuery({
    queryKey: ['decisions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('decisions_log')
        .select('*')
        .order('decided_at', { ascending: false })
      return data as Decision[]
    },
  })

  const createDecisionMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('decisions_log').insert({
        decision,
        reason,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] })
      setDecision('')
      setReason('')
      setShowForm(false)
    },
  })

  const deleteDecisionMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('decisions_log').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('decisions.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">{t('decisions.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> {t('decisions.new')}
        </button>
      </div>

      {showForm && (
        <div className="card p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (decision && reason) createDecisionMutation.mutate()
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">{t('decisions.decision')}</label>
              <input type="text" value={decision} onChange={(e) => setDecision(e.target.value)} placeholder={t('decisions.placeholder')} className="w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">{t('decisions.reason')}</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('decisions.reason_placeholder')} rows={3} className="w-full" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 text-sm">{t('decisions.register')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-neutral-700 text-sm">{t('decisions.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {decisions.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 dark:text-neutral-500">
            {t('decisions.empty')}
          </div>
        ) : (
          decisions.map((dec) => (
            <div key={dec.id} className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{dec.decision}</h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-neutral-400 ml-5 mb-3">{dec.reason}</p>
                  <p className="ml-5 text-xs text-gray-400 dark:text-neutral-500">
                    {new Date(dec.decided_at).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')}
                  </p>
                </div>
                <button
                  onClick={() => deleteDecisionMutation.mutate(dec.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {dec.result_observed && (
                <div className="ml-5 mt-3 p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-sm">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">{t('decisions.observed_result')}</p>
                  <p className="text-emerald-600 dark:text-emerald-300">{dec.result_observed}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
