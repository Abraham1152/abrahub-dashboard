import { supabase } from '@/integrations/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/stores/themeStore'
import { useState, useMemo, useCallback } from 'react'
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Save,
  X,
  DollarSign,
  Wallet,
  Receipt,
  Users,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'

// --- Types ---

type Category = 'tool' | 'salary' | 'tax' | 'prolabore' | 'other'

interface Expense {
  id: string
  month: string
  name: string
  description: string | null
  category: Category
  price_usd: number | null
  price_brl: number
  responsible: string | null
  is_recurring: boolean
  created_at: string
  updated_at: string
}

interface ExpenseForm {
  name: string
  description: string
  category: Category
  price_usd: string
  price_brl: string
  responsible: string
  is_recurring: boolean
}

// --- Constants ---

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const CATEGORY_LABELS: Record<Category, string> = {
  tool: 'Ferramenta',
  salary: 'Salario',
  tax: 'Imposto',
  prolabore: 'Prolabore',
  other: 'Outro',
}

const CATEGORY_COLORS: Record<Category, { bg: string; text: string }> = {
  tool: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
  salary: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400' },
  tax: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
  prolabore: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400' },
  other: { bg: 'bg-gray-100 dark:bg-gray-500/20', text: 'text-gray-700 dark:text-gray-400' },
}

const DEFAULT_EXPENSES: ExpenseForm[] = [
  { name: 'Systeme', description: 'Mail Marketing', category: 'tool', price_usd: '', price_brl: '414.00', responsible: '', is_recurring: true },
  { name: 'Higgsfield', description: 'Estudio de Cinematografia', category: 'tool', price_usd: '37.40', price_brl: '193.66', responsible: '', is_recurring: true },
  { name: 'Google AI Ultra', description: 'Veo 3, Gemini code', category: 'tool', price_usd: '', price_brl: '1209.00', responsible: '', is_recurring: true },
  { name: 'ChatGPT', description: 'Roteiros, textos', category: 'tool', price_usd: '20.00', price_brl: '103.56', responsible: '', is_recurring: true },
  { name: 'Botconversa', description: '', category: 'tool', price_usd: '14.00', price_brl: '72.49', responsible: '', is_recurring: true },
  { name: 'Impostos', description: 'Roubo do GOV', category: 'tax', price_usd: '', price_brl: '2500.00', responsible: '', is_recurring: true },
  { name: 'Youtube Premium', description: '', category: 'tool', price_usd: '8.00', price_brl: '41.42', responsible: '', is_recurring: true },
  { name: 'Salario Atlas', description: '', category: 'salary', price_usd: '', price_brl: '2500.00', responsible: 'Atlas', is_recurring: true },
  { name: 'Contabilidade', description: '', category: 'other', price_usd: '', price_brl: '1200.00', responsible: '', is_recurring: true },
  { name: 'Pacote Adobe', description: '', category: 'tool', price_usd: '', price_brl: '140.00', responsible: '', is_recurring: true },
  { name: 'Canva Pro', description: '', category: 'tool', price_usd: '', price_brl: '34.00', responsible: '', is_recurring: true },
  { name: 'Motion VFX', description: '', category: 'tool', price_usd: '58.00', price_brl: '300.32', responsible: '', is_recurring: true },
  { name: 'Artlist', description: '', category: 'tool', price_usd: '40.00', price_brl: '207.12', responsible: '', is_recurring: true },
  { name: 'Midjourney', description: '', category: 'tool', price_usd: '30.00', price_brl: '155.34', responsible: '', is_recurring: true },
  { name: 'Circle', description: 'Coracao da comunidade', category: 'tool', price_usd: '', price_brl: '1159.00', responsible: '', is_recurring: true },
  { name: 'Capcut', description: '', category: 'tool', price_usd: '', price_brl: '66.00', responsible: '', is_recurring: true },
  { name: 'Elevenlabs', description: '', category: 'tool', price_usd: '5.00', price_brl: '25.89', responsible: '', is_recurring: true },
  { name: 'Claude OPUS', description: '', category: 'tool', price_usd: '100.00', price_brl: '517.80', responsible: '', is_recurring: true },
  { name: 'Prolabore Rodrigo', description: '40%', category: 'prolabore', price_usd: '', price_brl: '6800.00', responsible: 'Rodrigo', is_recurring: true },
  { name: 'Prolabore Monge', description: '30%', category: 'prolabore', price_usd: '', price_brl: '5100.00', responsible: 'Monge', is_recurring: true },
  { name: 'Prolabore Zanella', description: '30%', category: 'prolabore', price_usd: '', price_brl: '5100.00', responsible: 'Zanella', is_recurring: true },
]

// --- Formatting ---

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatUSD = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const parseNumber = (s: string): number | null => {
  if (!s || s.trim() === '') return null
  const cleaned = s.replace(/[^\d.,\-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

const emptyForm: ExpenseForm = {
  name: '',
  description: '',
  category: 'tool',
  price_usd: '',
  price_brl: '',
  responsible: '',
  is_recurring: true,
}

// --- Main Component ---

export default function ExpensesPage() {
  useTheme()
  const queryClient = useQueryClient()

  // Month/year selection
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth())

  const selectedMonth = useMemo(() => {
    const m = (selectedMonthIndex + 1).toString().padStart(2, '0')
    return `${selectedYear}-${m}`
  }, [selectedYear, selectedMonthIndex])

  // Edit / Add state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ExpenseForm>(emptyForm)
  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState<ExpenseForm>(emptyForm)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showCopyConfirm, setShowCopyConfirm] = useState(false)

  // --- Queries ---

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['monthly-expenses', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('month', selectedMonth)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []) as Expense[]
    },
  })

  // --- Mutations ---

  const addExpense = useMutation({
    mutationFn: async (form: ExpenseForm) => {
      const { error } = await supabase.from('monthly_expenses').insert({
        month: selectedMonth,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        price_usd: parseNumber(form.price_usd),
        price_brl: parseNumber(form.price_brl) || 0,
        responsible: form.responsible.trim() || null,
        is_recurring: form.is_recurring,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses', selectedMonth] })
      setIsAdding(false)
      setAddForm(emptyForm)
    },
  })

  const updateExpense = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: ExpenseForm }) => {
      const { error } = await supabase
        .from('monthly_expenses')
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          category: form.category,
          price_usd: parseNumber(form.price_usd),
          price_brl: parseNumber(form.price_brl) || 0,
          responsible: form.responsible.trim() || null,
          is_recurring: form.is_recurring,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses', selectedMonth] })
      setEditingId(null)
      setEditForm(emptyForm)
    },
  })

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('monthly_expenses')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses', selectedMonth] })
      setDeleteConfirmId(null)
    },
  })

  const seedExpenses = useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_EXPENSES.map((e) => ({
        month: selectedMonth,
        name: e.name,
        description: e.description || null,
        category: e.category,
        price_usd: parseNumber(e.price_usd),
        price_brl: parseNumber(e.price_brl) || 0,
        responsible: e.responsible || null,
        is_recurring: e.is_recurring,
      }))
      const { error } = await supabase.from('monthly_expenses').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses', selectedMonth] })
      // seed complete
    },
  })

  const copyFromMonth = useMutation({
    mutationFn: async (sourceMonth: string) => {
      const { data: sourceExpenses, error: fetchErr } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('month', sourceMonth)
      if (fetchErr) throw fetchErr
      if (!sourceExpenses || sourceExpenses.length === 0) {
        throw new Error('Nenhuma despesa encontrada no mes selecionado')
      }
      const rows = sourceExpenses.map((e: Expense) => ({
        month: selectedMonth,
        name: e.name,
        description: e.description,
        category: e.category,
        price_usd: e.price_usd,
        price_brl: e.price_brl,
        responsible: e.responsible,
        is_recurring: e.is_recurring,
      }))
      const { error: insertErr } = await supabase.from('monthly_expenses').insert(rows)
      if (insertErr) throw insertErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-expenses', selectedMonth] })
      setShowCopyConfirm(false)
    },
  })

  // --- Calculations ---

  const totals = useMemo(() => {
    const totalBRL = expenses.reduce((s, e) => s + (e.price_brl || 0), 0)
    const toolsBRL = expenses.filter((e) => e.category === 'tool').reduce((s, e) => s + (e.price_brl || 0), 0)
    const salaryProlaboreBRL = expenses
      .filter((e) => e.category === 'salary' || e.category === 'prolabore')
      .reduce((s, e) => s + (e.price_brl || 0), 0)
    const taxBRL = expenses.filter((e) => e.category === 'tax').reduce((s, e) => s + (e.price_brl || 0), 0)
    const totalUSD = expenses.reduce((s, e) => s + (e.price_usd || 0), 0)
    return { totalBRL, toolsBRL, salaryProlaboreBRL, taxBRL, totalUSD }
  }, [expenses])

  // --- Helpers ---

  const startEdit = useCallback((expense: Expense) => {
    setEditingId(expense.id)
    setEditForm({
      name: expense.name,
      description: expense.description || '',
      category: expense.category,
      price_usd: expense.price_usd != null ? expense.price_usd.toString() : '',
      price_brl: expense.price_brl.toString(),
      responsible: expense.responsible || '',
      is_recurring: expense.is_recurring,
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm(emptyForm)
  }, [])

  const getPreviousMonth = useCallback(() => {
    let prevMonth = selectedMonthIndex - 1
    let prevYear = selectedYear
    if (prevMonth < 0) {
      prevMonth = 11
      prevYear -= 1
    }
    const m = (prevMonth + 1).toString().padStart(2, '0')
    return `${prevYear}-${m}`
  }, [selectedMonthIndex, selectedYear])

  // --- Render ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400 dark:text-neutral-500" size={32} />
      </div>
    )
  }

  const inputClass =
    'w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

  const selectClass =
    'w-full px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40'

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gastos Mensais</h1>
          <p className="text-gray-500 dark:text-neutral-500 text-sm mt-1">
            Gerencie as despesas mensais da empresa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            Adicionar Gasto
          </button>
          <button
            onClick={() => setShowCopyConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-xl text-sm font-medium transition-colors"
          >
            <Copy size={16} />
            Copiar Mes Anterior
          </button>
        </div>
      </div>

      {/* Year + Month Selector */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Year */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-1">
            {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedYear === year
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
          {/* Months */}
          <div className="flex items-center gap-1 flex-wrap bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-1">
            {MONTHS.map((label, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonthIndex(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedMonthIndex === i
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Gastos"
          value={formatBRL(totals.totalBRL)}
          icon={Wallet}
          iconBg="bg-orange-50 dark:bg-orange-500/10"
          iconColor="text-orange-500"
          subtitle={totals.totalUSD > 0 ? `${formatUSD(totals.totalUSD)} em USD` : undefined}
        />
        <SummaryCard
          label="Ferramentas"
          value={formatBRL(totals.toolsBRL)}
          icon={DollarSign}
          iconBg="bg-blue-50 dark:bg-blue-500/10"
          iconColor="text-blue-500"
          subtitle={`${expenses.filter((e) => e.category === 'tool').length} ferramentas`}
        />
        <SummaryCard
          label="Salarios / Prolabore"
          value={formatBRL(totals.salaryProlaboreBRL)}
          icon={Users}
          iconBg="bg-purple-50 dark:bg-purple-500/10"
          iconColor="text-purple-500"
          subtitle={`${expenses.filter((e) => e.category === 'salary' || e.category === 'prolabore').length} pagamentos`}
        />
        <SummaryCard
          label="Impostos"
          value={formatBRL(totals.taxBRL)}
          icon={Receipt}
          iconBg="bg-red-50 dark:bg-red-500/10"
          iconColor="text-red-500"
          subtitle={totals.totalBRL > 0 ? `${((totals.taxBRL / totals.totalBRL) * 100).toFixed(1)}% do total` : undefined}
        />
      </div>

      {/* Seed banner */}
      {expenses.length === 0 && !isAdding && (
        <div className="card p-6 text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={32} />
          <p className="text-gray-900 dark:text-white font-medium mb-1">
            Nenhuma despesa para {MONTHS[selectedMonthIndex]} {selectedYear}
          </p>
          <p className="text-gray-500 dark:text-neutral-500 text-sm mb-4">
            Deseja popular com a lista padrao de despesas recorrentes?
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => seedExpenses.mutate()}
              disabled={seedExpenses.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {seedExpenses.isPending ? 'Populando...' : 'Popular com Padrao'}
            </button>
            <button
              onClick={() => setShowCopyConfirm(true)}
              className="px-5 py-2.5 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-xl text-sm font-medium transition-colors"
            >
              Copiar de Outro Mes
            </button>
          </div>
          {seedExpenses.isError && (
            <p className="text-red-500 text-sm mt-3">
              Erro: {(seedExpenses.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Expenses Table */}
      {(expenses.length > 0 || isAdding) && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 dark:text-neutral-500 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-4">Nome</th>
                  <th className="text-left py-3 px-4">Descricao</th>
                  <th className="text-left py-3 px-4">Categoria</th>
                  <th className="text-right py-3 px-4">USD</th>
                  <th className="text-right py-3 px-4">BRL</th>
                  <th className="text-left py-3 px-4">Responsavel</th>
                  <th className="text-center py-3 px-4 w-28">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {/* Add new row */}
                {isAdding && (
                  <tr className="border-b border-gray-100 dark:border-neutral-800/50 bg-blue-50/50 dark:bg-blue-900/10">
                    <td className="py-2 px-4">
                      <input
                        className={inputClass}
                        placeholder="Nome"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        className={inputClass}
                        placeholder="Descricao"
                        value={addForm.description}
                        onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <select
                        className={selectClass}
                        value={addForm.category}
                        onChange={(e) => setAddForm({ ...addForm, category: e.target.value as Category })}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-4">
                      <input
                        className={`${inputClass} text-right`}
                        placeholder="0.00"
                        value={addForm.price_usd}
                        onChange={(e) => setAddForm({ ...addForm, price_usd: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        className={`${inputClass} text-right`}
                        placeholder="0,00"
                        value={addForm.price_brl}
                        onChange={(e) => setAddForm({ ...addForm, price_brl: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        className={inputClass}
                        placeholder="Responsavel"
                        value={addForm.responsible}
                        onChange={(e) => setAddForm({ ...addForm, responsible: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => addExpense.mutate(addForm)}
                          disabled={!addForm.name.trim() || !addForm.price_brl.trim() || addExpense.isPending}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-30"
                          title="Salvar"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => { setIsAdding(false); setAddForm(emptyForm) }}
                          className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Expense rows */}
                {expenses.map((expense) => {
                  const isEditing = editingId === expense.id
                  const isDeleting = deleteConfirmId === expense.id

                  if (isEditing) {
                    return (
                      <tr key={expense.id} className="border-b border-gray-100 dark:border-neutral-800/50 bg-amber-50/50 dark:bg-amber-900/10">
                        <td className="py-2 px-4">
                          <input
                            className={inputClass}
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            className={inputClass}
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <select
                            className={selectClass}
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Category })}
                          >
                            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-4">
                          <input
                            className={`${inputClass} text-right`}
                            value={editForm.price_usd}
                            onChange={(e) => setEditForm({ ...editForm, price_usd: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            className={`${inputClass} text-right`}
                            value={editForm.price_brl}
                            onChange={(e) => setEditForm({ ...editForm, price_brl: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            className={inputClass}
                            value={editForm.responsible}
                            onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateExpense.mutate({ id: expense.id, form: editForm })}
                              disabled={!editForm.name.trim() || !editForm.price_brl.trim() || updateExpense.isPending}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-30"
                              title="Salvar"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={expense.id}
                      className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                        {expense.name}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-neutral-400 max-w-[200px] truncate" title={expense.description || ''}>
                        {expense.description || '\u2014'}
                      </td>
                      <td className="py-3 px-4">
                        <CategoryBadge category={expense.category} />
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-neutral-400 tabular-nums">
                        {expense.price_usd != null ? formatUSD(expense.price_usd) : '\u2014'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-medium tabular-nums">
                        {formatBRL(expense.price_brl || 0)}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-neutral-400">
                        {expense.responsible || '\u2014'}
                      </td>
                      <td className="py-3 px-4">
                        {isDeleting ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => deleteExpense.mutate(expense.id)}
                              disabled={deleteExpense.isPending}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-xs font-medium disabled:opacity-50"
                              title="Confirmar exclusao"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(expense)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(expense.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {/* Totals row */}
                {expenses.length > 0 && (
                  <tr className="bg-gray-50 dark:bg-neutral-800/50 font-semibold">
                    <td className="py-3 px-4 text-gray-900 dark:text-white" colSpan={3}>
                      Total ({expenses.length} itens)
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white tabular-nums">
                      {totals.totalUSD > 0 ? formatUSD(totals.totalUSD) : '\u2014'}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-900 dark:text-white tabular-nums">
                      {formatBRL(totals.totalBRL)}
                    </td>
                    <td className="py-3 px-4" colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mutation errors */}
          {addExpense.isError && (
            <div className="px-4 py-3 text-red-500 text-sm border-t border-gray-200 dark:border-neutral-800">
              Erro ao adicionar: {(addExpense.error as Error).message}
            </div>
          )}
          {updateExpense.isError && (
            <div className="px-4 py-3 text-red-500 text-sm border-t border-gray-200 dark:border-neutral-800">
              Erro ao atualizar: {(updateExpense.error as Error).message}
            </div>
          )}
          {deleteExpense.isError && (
            <div className="px-4 py-3 text-red-500 text-sm border-t border-gray-200 dark:border-neutral-800">
              Erro ao excluir: {(deleteExpense.error as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Copy from previous month modal */}
      {showCopyConfirm && (
        <ConfirmModal
          title="Copiar Despesas do Mes Anterior"
          message={`Deseja copiar todas as despesas de ${getPreviousMonth()} para ${selectedMonth}? Despesas com nomes duplicados nao serao copiadas.`}
          confirmLabel={copyFromMonth.isPending ? 'Copiando...' : 'Copiar'}
          onConfirm={() => copyFromMonth.mutate(getPreviousMonth())}
          onCancel={() => setShowCopyConfirm(false)}
          isLoading={copyFromMonth.isPending}
          error={copyFromMonth.isError ? (copyFromMonth.error as Error).message : undefined}
        />
      )}
    </div>
  )
}

// --- Sub Components ---

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  subtitle,
}: {
  label: string
  value: string
  icon: any
  iconBg: string
  iconColor: string
  subtitle?: string
}) {
  return (
    <div className="card p-5 hover:border-gray-200 dark:hover:border-neutral-700/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function CategoryBadge({ category }: { category: Category }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.other
  const label = CATEGORY_LABELS[category] || category
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  )
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
  error,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  error?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-6">{message}</p>
        {error && <p className="text-red-500 text-sm mb-4">Erro: {error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
