import { useState } from 'react'
import { File, Plus, Trash2 } from 'lucide-react'

type DocumentFolder = {
  name: string
  icon: string
  files: { name: string; date: string }[]
}

export default function DocumentsPage() {
  const [folders] = useState<DocumentFolder[]>([
    {
      name: 'Contratos',
      icon: '📄',
      files: [
        { name: 'Contrato com Fornecedor A', date: '2025-02-15' },
        { name: 'Contrato de Parceria', date: '2025-01-20' },
      ],
    },
    {
      name: 'Planejamento',
      icon: '📋',
      files: [
        { name: 'Roadmap 2025', date: '2025-02-01' },
        { name: 'Plano Estrategico Q1', date: '2025-01-15' },
      ],
    },
    {
      name: 'Planilhas',
      icon: '📊',
      files: [
        { name: 'Projecao Financeira', date: '2025-02-18' },
        { name: 'Analise de Churn', date: '2025-02-10' },
      ],
    },
    {
      name: 'Relatorios',
      icon: '📑',
      files: [
        { name: 'Relatorio Mensal Janeiro', date: '2025-02-01' },
        { name: 'Relatorio de Performance', date: '2025-01-31' },
      ],
    },
    {
      name: 'Documentos Societarios',
      icon: '⚖️',
      files: [
        { name: 'Contrato Social', date: '2024-06-15' },
        { name: 'Ata de Constituicao', date: '2024-06-15' },
        { name: 'Alteracao Contratual 2024', date: '2024-12-01' },
      ],
    },
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Documentos</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Organize e acesse todos os documentos importantes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map((folder) => (
          <div
            key={folder.name}
            className="card p-6 hover:border-gray-200 dark:hover:border-neutral-700 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{folder.icon}</span>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{folder.name}</h2>
            </div>

            <div className="space-y-1.5">
              {folder.files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-neutral-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File size={14} className="text-gray-400 dark:text-neutral-500 shrink-0" />
                    <span className="text-sm truncate text-gray-700 dark:text-neutral-200">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <span className="text-xs text-gray-400 dark:text-neutral-500">
                      {new Date(file.date).toLocaleDateString('pt-BR')}
                    </span>
                    <button className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button className="w-full mt-2 p-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> Adicionar arquivo
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Informacoes Importantes</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-neutral-300">
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Todos os documentos sao armazenados com seguranca</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Apenas voce e socios registrados podem acessar</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Versoes anteriores sao mantidas para auditoria (90 dias)</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Compartilhamento pode ser feito via link seguro</li>
        </ul>
      </div>
    </div>
  )
}
