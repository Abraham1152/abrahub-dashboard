import { useState } from 'react'
import { File, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'

type DocumentFolder = {
  nameKey: string
  icon: string
  files: { nameKey: string; date: string }[]
}

export default function DocumentsPage() {
  const { t, lang } = useTranslation()

  const [folders] = useState<DocumentFolder[]>([
    {
      nameKey: 'documents.contracts',
      icon: '📄',
      files: [
        { nameKey: 'documents.contract_supplier', date: '2025-02-15' },
        { nameKey: 'documents.contract_partnership', date: '2025-01-20' },
      ],
    },
    {
      nameKey: 'documents.planning',
      icon: '📋',
      files: [
        { nameKey: 'documents.roadmap', date: '2025-02-01' },
        { nameKey: 'documents.strategic_plan', date: '2025-01-15' },
      ],
    },
    {
      nameKey: 'documents.spreadsheets',
      icon: '📊',
      files: [
        { nameKey: 'documents.financial_projection', date: '2025-02-18' },
        { nameKey: 'documents.churn_analysis', date: '2025-02-10' },
      ],
    },
    {
      nameKey: 'documents.reports',
      icon: '📑',
      files: [
        { nameKey: 'documents.monthly_report', date: '2025-02-01' },
        { nameKey: 'documents.performance_report', date: '2025-01-31' },
      ],
    },
    {
      nameKey: 'documents.corporate_docs',
      icon: '⚖️',
      files: [
        { nameKey: 'documents.articles', date: '2024-06-15' },
        { nameKey: 'documents.constitution', date: '2024-06-15' },
        { nameKey: 'documents.amendment', date: '2024-12-01' },
      ],
    },
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('documents.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">{t('documents.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <div
            key={folder.nameKey}
            className="card p-6 hover:border-gray-200 dark:hover:border-neutral-700 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{folder.icon}</span>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t(folder.nameKey)}</h2>
            </div>

            <div className="space-y-1.5">
              {folder.files.map((file) => (
                <div
                  key={file.nameKey}
                  className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-neutral-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File size={14} className="text-gray-400 dark:text-neutral-500 shrink-0" />
                    <span className="text-sm truncate text-gray-700 dark:text-neutral-200">{t(file.nameKey)}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <span className="text-xs text-gray-400 dark:text-neutral-500">
                      {new Date(file.date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')}
                    </span>
                    <button className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button className="w-full mt-2 p-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> {t('documents.add_file')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('documents.important_info')}</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-neutral-300">
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> {t('documents.secure_storage')}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> {t('documents.partners_only')}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> {t('documents.audit_trail')}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> {t('documents.share_link')}</li>
        </ul>
      </div>
    </div>
  )
}
