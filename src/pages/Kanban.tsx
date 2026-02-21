import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useState, useRef, DragEvent } from 'react'
import {
  Trash2,
  Plus,
  GripVertical,
  Calendar,
  User,
  X,
  Edit3,
} from 'lucide-react'

type Task = {
  id: string
  title: string
  description: string | null
  status: 'backlog' | 'in_progress' | 'review' | 'done'
  assigned_to: string | null
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
}

type Column = 'backlog' | 'in_progress' | 'review' | 'done'

const COLUMNS: { key: Column; title: string; color: string; dotColor: string }[] = [
  { key: 'backlog', title: 'Backlog', color: 'bg-gray-500', dotColor: 'bg-gray-400' },
  { key: 'in_progress', title: 'Em Progresso', color: 'bg-blue-500', dotColor: 'bg-blue-500' },
  { key: 'review', title: 'Revisao', color: 'bg-amber-500', dotColor: 'bg-amber-500' },
  { key: 'done', title: 'Concluido', color: 'bg-emerald-500', dotColor: 'bg-emerald-500' },
]

const TEAM = [
  { name: 'Rodrigo Abraham', initials: 'RA', color: 'bg-blue-500' },
  { name: 'Gustavo Moraes', initials: 'GM', color: 'bg-emerald-500' },
  { name: 'Raynan Kenneth', initials: 'RK', color: 'bg-purple-500' },
]

const PRIORITY_STYLES: Record<string, { label: string; bar: string; badge: string }> = {
  low: { label: 'Baixa', bar: 'bg-gray-300 dark:bg-neutral-600', badge: 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300' },
  medium: { label: 'Media', bar: 'bg-amber-400', badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  high: { label: 'Alta', bar: 'bg-red-500', badge: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' },
}

export default function KanbanPage() {
  const queryClient = useQueryClient()
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Column | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [addingTo, setAddingTo] = useState<Column | null>(null)

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').order('created_at')
      return (data || []) as Task[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (task: { title: string; status: Column; priority: string; assigned_to: string | null }) => {
      await supabase.from('tasks').insert(task)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      await supabase.from('tasks').update(updates).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('tasks').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  // Drag handlers
  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDraggedTask(taskId)
    e.dataTransfer.effectAllowed = 'move'
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: DragEvent) => {
    setDraggedTask(null)
    setDragOverColumn(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleDragOver = (e: DragEvent, column: Column) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(column)
  }

  const handleDrop = (e: DragEvent, column: Column) => {
    e.preventDefault()
    setDragOverColumn(null)
    if (draggedTask) {
      updateMutation.mutate({ id: draggedTask, status: column })
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Board Interno</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Arraste cards entre colunas para mover tarefas</p>
      </div>

      {/* Team Members */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">Equipe:</span>
        <div className="flex -space-x-2">
          {TEAM.map((m) => (
            <div
              key={m.name}
              className={`w-8 h-8 rounded-full ${m.color} flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-neutral-950`}
              title={m.name}
            >
              {m.initials}
            </div>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ minHeight: '70vh' }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key)
          const isOver = dragOverColumn === col.key

          return (
            <div
              key={col.key}
              className={`rounded-2xl p-3 transition-all ${
                isOver
                  ? 'bg-blue-50 dark:bg-blue-500/5 ring-2 ring-blue-400/30'
                  : 'bg-gray-100/70 dark:bg-neutral-900/50'
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{col.title}</h2>
                  <span className="text-xs bg-gray-200/80 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 px-2 py-0.5 rounded-full font-medium">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingTo(col.key)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                  title="Adicionar tarefa"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Add Card Inline */}
              {addingTo === col.key && (
                <AddCardInline
                  column={col.key}
                  onSave={(title, priority, assignee) => {
                    createMutation.mutate({ title, status: col.key, priority, assigned_to: assignee })
                    setAddingTo(null)
                  }}
                  onCancel={() => setAddingTo(null)}
                />
              )}

              {/* Task Cards */}
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteMutation.mutate(task.id)}
                    isDragging={draggedTask === task.id}
                  />
                ))}
              </div>

              {colTasks.length === 0 && !addingTo && (
                <div className="py-8 text-center">
                  <p className="text-xs text-gray-400 dark:text-neutral-600">Nenhuma tarefa</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={(updates) => {
            updateMutation.mutate({ id: editingTask.id, ...updates })
            setEditingTask(null)
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}

// ==================== TASK CARD ====================

function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  isDragging,
}: {
  task: Task
  onDragStart: (e: DragEvent, id: string) => void
  onDragEnd: (e: DragEvent) => void
  onEdit: () => void
  onDelete: () => void
  isDragging: boolean
}) {
  const priority = PRIORITY_STYLES[task.priority]
  const assignee = TEAM.find((m) => m.name === task.assigned_to)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={`bg-white dark:bg-neutral-900 rounded-xl p-3 border border-gray-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all group ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      {/* Priority bar */}
      <div className={`h-1 w-10 rounded-full ${priority.bar} mb-2.5`} />

      {/* Title + Actions */}
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-gray-300 dark:text-neutral-700 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-sm font-medium text-gray-900 dark:text-white flex-1 leading-snug">{task.title}</p>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1.5 ml-5 line-clamp-2">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 ml-5">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priority.badge}`}>
            {priority.label}
          </span>
          {task.due_date && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-neutral-500">
              <Calendar size={10} />
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
        {assignee ? (
          <div
            className={`w-6 h-6 rounded-full ${assignee.color} flex items-center justify-center text-white text-[9px] font-bold`}
            title={assignee.name}
          >
            {assignee.initials}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
            <User size={11} className="text-gray-400 dark:text-neutral-600" />
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== ADD CARD INLINE ====================

function AddCardInline({
  onSave,
  onCancel,
}: {
  column: Column
  onSave: (title: string, priority: string, assignee: string | null) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [assignee, setAssignee] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-3 border border-blue-300 dark:border-blue-500/30 shadow-lg mb-2">
      <input
        ref={inputRef}
        autoFocus
        type="text"
        placeholder="Titulo da tarefa..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) onSave(title.trim(), priority, assignee)
          if (e.key === 'Escape') onCancel()
        }}
        className="w-full text-sm bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 mb-2"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          className="text-xs bg-gray-100 dark:bg-neutral-800 border-none rounded-lg px-2 py-1 text-gray-600 dark:text-neutral-300"
        >
          <option value="low">Baixa</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
        <select
          value={assignee || ''}
          onChange={(e) => setAssignee(e.target.value || null)}
          className="text-xs bg-gray-100 dark:bg-neutral-800 border-none rounded-lg px-2 py-1 text-gray-600 dark:text-neutral-300"
        >
          <option value="">Sem responsavel</option>
          {TEAM.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 px-2 py-1"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (title.trim()) onSave(title.trim(), priority, assignee)
          }}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

// ==================== EDIT TASK MODAL ====================

function EditTaskModal({
  task,
  onSave,
  onClose,
}: {
  task: Task
  onSave: (updates: Partial<Task>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [assignee, setAssignee] = useState(task.assigned_to || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [status, setStatus] = useState(task.status)

  const handleSave = () => {
    onSave({
      title,
      description: description || null,
      priority: priority as Task['priority'],
      assigned_to: assignee || null,
      due_date: dueDate || null,
      status,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Editar Tarefa</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Titulo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Descricao</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Adicione uma descricao..."
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Row: Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Column)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          {/* Row: Assignee + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Responsavel</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Sem responsavel</option>
                {TEAM.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Data Limite</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
