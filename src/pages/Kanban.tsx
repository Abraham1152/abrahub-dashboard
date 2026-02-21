import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useState, DragEvent } from 'react'
import {
  Trash2,
  Plus,
  GripVertical,
  Calendar,
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

type Status = 'in_progress' | 'review' | 'done'

const TEAM = [
  { name: 'Pedro Zanella', initials: 'PZ', color: 'bg-rose-500', border: 'border-rose-500' },
  { name: 'Rodrigo Abraham', initials: 'RA', color: 'bg-blue-500', border: 'border-blue-500' },
  { name: 'Gustavo Moraes', initials: 'GM', color: 'bg-emerald-500', border: 'border-emerald-500' },
  { name: 'Raynan Kenneth', initials: 'RK', color: 'bg-purple-500', border: 'border-purple-500' },
]

const STATUS_BLOCKS: { key: Status; label: string; dotColor: string }[] = [
  { key: 'in_progress', label: 'Progresso', dotColor: 'bg-blue-500' },
  { key: 'review', label: 'Revisao', dotColor: 'bg-amber-500' },
  { key: 'done', label: 'Feito', dotColor: 'bg-emerald-500' },
]

const PRIORITY_STYLES: Record<string, { label: string; bar: string; badge: string }> = {
  low: { label: 'Baixa', bar: 'bg-gray-300 dark:bg-neutral-600', badge: 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300' },
  medium: { label: 'Media', bar: 'bg-amber-400', badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  high: { label: 'Alta', bar: 'bg-red-500', badge: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' },
}

export default function KanbanPage() {
  const queryClient = useQueryClient()
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [addingTo, setAddingTo] = useState<{ person: string; status: Status } | null>(null)

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').order('created_at')
      return (data || []) as Task[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (task: { title: string; status: string; priority: string; assigned_to: string | null }) => {
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
      e.currentTarget.style.opacity = '0.4'
    }
  }

  const handleDragEnd = (e: DragEvent) => {
    setDraggedTask(null)
    setDragOverTarget(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleDragOver = (e: DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetId)
  }

  const handleDrop = (e: DragEvent, person: string, status: Status) => {
    e.preventDefault()
    setDragOverTarget(null)
    if (draggedTask) {
      updateMutation.mutate({ id: draggedTask, assigned_to: person, status })
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Board Interno</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Arraste tarefas entre blocos para reorganizar</p>
      </div>

      {/* Board Grid - 4 person columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {TEAM.map((member) => {
          const personTasks = tasks.filter((t) => t.assigned_to === member.name)

          return (
            <div key={member.name} className="space-y-3">
              {/* Person Header */}
              <div className={`flex items-center gap-3 px-3 py-3 rounded-xl bg-white dark:bg-neutral-900 border-t-4 ${member.border}`}>
                <div className={`w-9 h-9 rounded-full ${member.color} flex items-center justify-center text-white text-sm font-bold`}>
                  {member.initials}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{member.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500">{personTasks.length} tarefas</p>
                </div>
              </div>

              {/* Status Blocks */}
              {STATUS_BLOCKS.map((block) => {
                const blockTasks = personTasks.filter((t) => t.status === block.key)
                const dropId = `${member.name}::${block.key}`
                const isOver = dragOverTarget === dropId

                return (
                  <div
                    key={block.key}
                    className={`rounded-xl p-2.5 min-h-[80px] transition-all ${
                      isOver
                        ? 'bg-blue-50 dark:bg-blue-500/5 ring-2 ring-blue-400/30'
                        : 'bg-gray-100/70 dark:bg-neutral-900/50'
                    }`}
                    onDragOver={(e) => handleDragOver(e, dropId)}
                    onDragLeave={() => setDragOverTarget(null)}
                    onDrop={(e) => handleDrop(e, member.name, block.key)}
                  >
                    {/* Block Header */}
                    <div className="flex items-center justify-between mb-2 px-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${block.dotColor}`} />
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">{block.label}</span>
                        {blockTasks.length > 0 && (
                          <span className="text-[10px] bg-gray-200/80 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 px-1.5 py-0.5 rounded-full">
                            {blockTasks.length}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setAddingTo({ person: member.name, status: block.key })}
                        className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Add Card Inline */}
                    {addingTo?.person === member.name && addingTo?.status === block.key && (
                      <AddCardInline
                        onSave={(title, priority) => {
                          createMutation.mutate({ title, status: block.key, priority, assigned_to: member.name })
                          setAddingTo(null)
                        }}
                        onCancel={() => setAddingTo(null)}
                      />
                    )}

                    {/* Task Cards */}
                    <div className="space-y-1.5">
                      {blockTasks.map((task) => (
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
                  </div>
                )
              })}
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

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={`bg-white dark:bg-neutral-900 rounded-lg p-2.5 border border-gray-200/80 dark:border-neutral-800 shadow-sm hover:shadow cursor-grab active:cursor-grabbing transition-all group ${
        isDragging ? 'opacity-40 scale-95' : ''
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical size={12} className="text-gray-300 dark:text-neutral-700 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 dark:text-white leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5 line-clamp-1">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-blue-500 transition-colors">
            <Edit3 size={11} />
          </button>
          <button onClick={onDelete} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-1.5 ml-4">
        <span className={`h-1 w-6 rounded-full ${priority.bar}`} />
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${priority.badge}`}>{priority.label}</span>
        {task.due_date && (
          <span className="flex items-center gap-0.5 text-[9px] text-gray-400 dark:text-neutral-500">
            <Calendar size={8} />
            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
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
  onSave: (title: string, priority: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg p-2.5 border border-blue-300 dark:border-blue-500/30 shadow-lg mb-1.5">
      <input
        autoFocus
        type="text"
        placeholder="Nova tarefa..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) onSave(title.trim(), priority)
          if (e.key === 'Escape') onCancel()
        }}
        className="w-full text-xs bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 mb-2"
      />
      <div className="flex items-center gap-1.5">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          className="text-[10px] bg-gray-100 dark:bg-neutral-800 border-none rounded-md px-1.5 py-0.5 text-gray-600 dark:text-neutral-300"
        >
          <option value="low">Baixa</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
        <div className="flex-1" />
        <button onClick={onCancel} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 px-1.5 py-0.5">
          Cancelar
        </button>
        <button
          onClick={() => { if (title.trim()) onSave(title.trim(), priority) }}
          className="text-[10px] bg-blue-600 text-white px-2.5 py-0.5 rounded-md font-medium hover:bg-blue-700 transition-colors"
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
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Titulo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="in_progress">Progresso</option>
                <option value="review">Revisao</option>
                <option value="done">Feito</option>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Responsavel</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
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
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
