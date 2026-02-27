import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase'
import { useState, DragEvent, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Trash2,
  Plus,
  GripVertical,
  Calendar as CalendarIcon,
  X,
  Edit3,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CalendarPlus,
  Repeat,
} from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'

type Task = {
  id: string
  title: string
  description: string | null
  status: 'backlog' | 'todo' | 'doing' | 'blocked' | 'done'
  assigned_to: string | null
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  position: number
  done_at: string | null
  created_at: string
  image_url: string | null
}

type Meeting = {
  id: string
  title: string
  description: string | null
  meeting_date: string
  meeting_time: string
  duration_minutes: number
  location: string | null
  created_by: string | null
  recurring_weekly: boolean
  created_at: string
  participants?: string[]
}

type Status = 'todo' | 'doing' | 'blocked' | 'done'

const TEAM = [
  { name: 'Pedro Zanella', initials: 'PZ', color: 'bg-rose-500', border: 'border-rose-500', colBg: 'bg-rose-50/40 dark:bg-rose-500/[0.03]' },
  { name: 'Rodrigo Abraham', initials: 'RA', color: 'bg-blue-500', border: 'border-blue-500', colBg: 'bg-blue-50/40 dark:bg-blue-500/[0.03]' },
  { name: 'Gustavo Moraes', initials: 'GM', color: 'bg-emerald-500', border: 'border-emerald-500', colBg: 'bg-emerald-50/40 dark:bg-emerald-500/[0.03]' },
  { name: 'Raynan Kenneth', initials: 'RK', color: 'bg-purple-500', border: 'border-purple-500', colBg: 'bg-purple-50/40 dark:bg-purple-500/[0.03]' },
]

export default function KanbanPage() {
  const queryClient = useQueryClient()
  const { t, lang } = useTranslation()
  const [draggedTask, setDraggedTask] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [dragOverCard, setDragOverCard] = useState<string | null>(null)
  const [dragInsertBefore, setDragInsertBefore] = useState<boolean>(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [addingTo, setAddingTo] = useState<{ person: string; status: Status } | null>(null)
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'board' | 'agenda'>(searchParams.get('tab') === 'agenda' ? 'agenda' : 'board')
  const [meetingFormDate, setMeetingFormDate] = useState<string | null>(null)

  // Auto-delete done tasks older than 7 days
  useEffect(() => {
    const cleanup = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('status', 'done')
        .not('done_at', 'is', null)
        .lt('done_at', sevenDaysAgo)
      if (error) console.error('Cleanup error:', error.message)
    }
    cleanup()
  }, [])

  // Auto-advance recurring weekly meetings whose date has passed
  useEffect(() => {
    const advanceRecurring = async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const { data: expired } = await supabase
        .from('meetings')
        .select('id, meeting_date')
        .eq('recurring_weekly', true)
        .lt('meeting_date', yesterday)
      if (!expired || expired.length === 0) return
      for (const m of expired) {
        // Advance to next future week (same weekday)
        let nextDate = new Date(m.meeting_date + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        while (nextDate < today) {
          nextDate.setDate(nextDate.getDate() + 7)
        }
        await supabase.from('meetings').update({ meeting_date: nextDate.toISOString().split('T')[0] }).eq('id', m.id)
      }
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    }
    advanceRecurring()
  }, [queryClient])

  // Realtime subscriptions - auto-refresh when any user changes tasks or meetings
  useEffect(() => {
    const channel = supabase
      .channel('board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, () => {
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const STATUS_BLOCKS: { key: Status; label: string; dotColor: string }[] = [
    { key: 'todo', label: t('kanban.todo'), dotColor: 'bg-blue-500' },
    { key: 'doing', label: t('kanban.doing'), dotColor: 'bg-amber-500' },
    { key: 'blocked', label: t('kanban.blocked'), dotColor: 'bg-red-500' },
    { key: 'done', label: t('kanban.done'), dotColor: 'bg-emerald-500' },
  ]

  const PRIORITY_STYLES: Record<string, { label: string; bar: string; badge: string }> = {
    low: { label: t('kanban.low'), bar: 'bg-gray-300 dark:bg-neutral-600', badge: 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300' },
    medium: { label: t('kanban.medium'), bar: 'bg-amber-400', badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    high: { label: t('kanban.high'), bar: 'bg-red-500', badge: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' },
  }

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('position').order('created_at')
      if (error) console.error('Error loading tasks:', error.message)
      return (data || []) as Task[]
    },
  })

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data: meetingsData, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date')
        .order('meeting_time')
      if (error) console.error('Error loading meetings:', error.message)

      const meetingsList = (meetingsData || []) as Meeting[]
      // Load participants for each meeting
      for (const m of meetingsList) {
        const { data: parts } = await supabase
          .from('meeting_participants')
          .select('participant_name')
          .eq('meeting_id', m.id)
        m.participants = (parts || []).map((p: any) => p.participant_name)
      }
      return meetingsList
    },
  })

  const createMutation = useMutation({
    mutationFn: async (task: { title: string; status: string; priority: string; assigned_to: string | null; position: number }) => {
      const { error } = await supabase.from('tasks').insert(task)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      // Auto-set done_at when moving to done, clear when moving away
      if (updates.status === 'done') {
        (updates as any).done_at = new Date().toISOString()
      } else if (updates.status) {
        (updates as any).done_at = null
      }
      const { error } = await supabase.from('tasks').update(updates).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const createMeetingMutation = useMutation({
    mutationFn: async (meeting: { title: string; description?: string; meeting_date: string; meeting_time: string; duration_minutes: number; location?: string; recurring_weekly?: boolean; participants: string[] }) => {
      const { participants, ...meetingData } = meeting
      const { data, error } = await supabase.from('meetings').insert(meetingData).select().single()
      if (error) throw new Error(error.message)
      if (participants.length > 0) {
        const rows = participants.map((p) => ({ meeting_id: data.id, participant_name: p }))
        await supabase.from('meeting_participants').insert(rows)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      setMeetingFormDate(null)
    },
  })

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  })

  // Reorder: move a task up or down within same person+status
  const handleReorder = (task: Task, direction: 'up' | 'down') => {
    const siblings = tasks
      .filter((t) => t.assigned_to === task.assigned_to && t.status === task.status)
      .sort((a, b) => a.position - b.position)
    const idx = siblings.findIndex((t) => t.id === task.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const other = siblings[swapIdx]
    // Swap positions
    updateMutation.mutate({ id: task.id, position: other.position })
    updateMutation.mutate({ id: other.id, position: task.position })
  }

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
    setDragOverColumn(null)
    setDragOverCard(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  // Column-level drag (empty area fallback)
  const handleColumnDragOver = (e: DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
    setDragOverCard(null)
  }

  // Card-level drag over — tracks which half (top/bottom) the pointer is on
  const handleCardDragOver = (e: DragEvent, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOverCard(cardId)
    setDragInsertBefore(e.clientY < rect.top + rect.height / 2)
    setDragOverColumn(null)
  }

  // Drop on column empty area — places at end
  const handleDropOnColumn = (e: DragEvent, person: string, status: Status) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDragOverCard(null)
    if (draggedTask) {
      const targetTasks = tasks.filter((t) => t.assigned_to === person && t.status === status)
      const maxPos = targetTasks.length > 0 ? Math.max(...targetTasks.map((t) => t.position)) + 1 : 0
      updateMutation.mutate({ id: draggedTask, assigned_to: person, status, position: maxPos })
    }
  }

  // Drop on a specific card — inserts before or after using fractional position
  const handleDropOnCard = (e: DragEvent, targetCardId: string, person: string, status: Status) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverCard(null)
    setDragOverColumn(null)
    if (!draggedTask || draggedTask === targetCardId) return

    const colTasks = tasks
      .filter((t) => t.assigned_to === person && t.status === status && t.id !== draggedTask)
      .sort((a, b) => a.position - b.position)

    const targetIdx = colTasks.findIndex((t) => t.id === targetCardId)
    if (targetIdx === -1) return

    let newPosition: number
    if (dragInsertBefore) {
      newPosition = targetIdx === 0
        ? colTasks[0].position - 1
        : (colTasks[targetIdx - 1].position + colTasks[targetIdx].position) / 2
    } else {
      newPosition = targetIdx === colTasks.length - 1
        ? colTasks[colTasks.length - 1].position + 1
        : (colTasks[targetIdx].position + colTasks[targetIdx + 1].position) / 2
    }

    updateMutation.mutate({ id: draggedTask, assigned_to: person, status, position: newPosition })
  }

  const locale = lang === 'pt' ? 'pt-BR' : 'en-US'

  const tabs = [
    { key: 'board' as const, label: t('kanban.title') },
    { key: 'agenda' as const, label: t('kanban.agenda') },
  ]

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('kanban.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">{t('kanban.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setActiveTab(tb.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tb.key
                ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Board Tab */}
      {activeTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {TEAM.map((member) => {
            const personTasks = tasks.filter((t) => t.assigned_to === member.name)

            return (
              <div key={member.name} className={`space-y-3 rounded-2xl p-2.5 ${member.colBg}`}>
                {/* Person Header */}
                <div className={`flex items-center gap-3 px-3 py-3 rounded-xl bg-white dark:bg-neutral-900 border-t-4 ${member.border}`}>
                  <div className={`w-9 h-9 rounded-full ${member.color} flex items-center justify-center text-white text-sm font-bold`}>
                    {member.initials}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{member.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-neutral-500">{personTasks.length} {t('kanban.tasks')}</p>
                  </div>
                </div>

                {/* Status Blocks */}
                {STATUS_BLOCKS.map((block) => {
                  const blockTasks = personTasks
                    .filter((t) => t.status === block.key)
                    .sort((a, b) => a.position - b.position)
                  const dropId = `${member.name}::${block.key}`
                  const isColOver = dragOverColumn === dropId

                  return (
                    <div
                      key={block.key}
                      className={`rounded-xl p-2.5 min-h-[80px] transition-all ${
                        isColOver
                          ? 'bg-blue-50 dark:bg-blue-500/5 ring-2 ring-blue-400/30'
                          : 'bg-gray-100/70 dark:bg-neutral-900/50'
                      }`}
                      onDragOver={(e) => handleColumnDragOver(e, dropId)}
                      onDragLeave={() => setDragOverColumn(null)}
                      onDrop={(e) => handleDropOnColumn(e, member.name, block.key)}
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
                            const maxPos = blockTasks.length > 0 ? Math.max(...blockTasks.map((t) => t.position)) + 1 : 0
                            createMutation.mutate({ title, status: block.key, priority, assigned_to: member.name, position: maxPos })
                            setAddingTo(null)
                          }}
                          onCancel={() => setAddingTo(null)}
                        />
                      )}

                      {/* Task Cards */}
                      <div className="space-y-1.5">
                        {blockTasks.map((task, idx) => {
                          const isDropTarget = dragOverCard === task.id && draggedTask !== task.id
                          return (
                            <div key={task.id}>
                              {isDropTarget && dragInsertBefore && (
                                <div className="h-8 mb-1.5 rounded-lg border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-500/5 transition-all duration-100" />
                              )}
                              <TaskCard
                                task={task}
                                priorityStyles={PRIORITY_STYLES}
                                locale={locale}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onCardDragOver={(e) => handleCardDragOver(e, task.id)}
                                onCardDrop={(e) => handleDropOnCard(e, task.id, member.name, block.key)}
                                onEdit={() => setEditingTask(task)}
                                onView={() => setViewingTask(task)}
                                onDelete={() => deleteMutation.mutate(task.id)}
                                onCyclePriority={() => {
                                  const cycle: Record<string, string> = { low: 'medium', medium: 'high', high: 'low' }
                                  updateMutation.mutate({ id: task.id, priority: cycle[task.priority] as Task['priority'] })
                                }}
                                onMoveUp={idx > 0 ? () => handleReorder(task, 'up') : undefined}
                                onMoveDown={idx < blockTasks.length - 1 ? () => handleReorder(task, 'down') : undefined}
                                isDragging={draggedTask === task.id}
                                onSaveImage={(imageUrl) => updateMutation.mutate({ id: task.id, image_url: imageUrl })}
                              />
                              {isDropTarget && !dragInsertBefore && (
                                <div className="h-8 mt-1.5 rounded-lg border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-500/5 transition-all duration-100" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Agenda Tab */}
      {activeTab === 'agenda' && (
        <AgendaSection
          meetings={meetings}
          locale={locale}
          onCreateMeeting={(date) => setMeetingFormDate(date || '')}
          onDeleteMeeting={(id) => deleteMeetingMutation.mutate(id)}
        />
      )}

      {/* View Task Detail */}
      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          priorityStyles={PRIORITY_STYLES}
          locale={locale}
          onEdit={() => { setEditingTask(viewingTask); setViewingTask(null) }}
          onClose={() => setViewingTask(null)}
        />
      )}

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

      {/* Create Meeting Modal */}
      {meetingFormDate !== null && (
        <CreateMeetingModal
          initialDate={meetingFormDate}
          onSave={(m) => createMeetingMutation.mutate(m)}
          onClose={() => setMeetingFormDate(null)}
        />
      )}
    </div>
  )
}

// ==================== TASK CARD ====================

function TaskCard({
  task,
  priorityStyles,
  locale,
  onDragStart,
  onDragEnd,
  onCardDragOver,
  onCardDrop,
  onEdit,
  onView,
  onDelete,
  onCyclePriority,
  onMoveUp,
  onMoveDown,
  isDragging,
  onSaveImage,
}: {
  task: Task
  priorityStyles: Record<string, { label: string; bar: string; badge: string }>
  locale: string
  onDragStart: (e: DragEvent, id: string) => void
  onDragEnd: (e: DragEvent) => void
  onCardDragOver: (e: DragEvent) => void
  onCardDrop: (e: DragEvent) => void
  onEdit: () => void
  onView: () => void
  onDelete: () => void
  onCyclePriority: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isDragging: boolean
  onSaveImage: (imageUrl: string | null) => void
}) {
  const priority = priorityStyles[task.priority]

  const processImageFile = (file: File, cb: (dataUrl: string) => void) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 900
        const ratio = Math.min(1, MAX / Math.max(img.width, img.height))
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        cb(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleFileDrop = (e: DragEvent) => {
    // Only handle file drops (images), not card reorder drops
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      e.preventDefault()
      e.stopPropagation()
      processImageFile(file, onSaveImage)
    }
    // If no image file, let the card drop handler proceed (card reorder)
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onDragOver={onCardDragOver}
      onDrop={(e) => {
        // If dropping an image file, handle it; otherwise do card reorder
        const file = e.dataTransfer?.files?.[0]
        if (file && file.type.startsWith('image/')) {
          handleFileDrop(e)
        } else {
          onCardDrop(e)
        }
      }}
      className={`bg-white dark:bg-neutral-900 rounded-lg p-2.5 border border-gray-200/80 dark:border-neutral-800 shadow-sm hover:shadow cursor-grab active:cursor-grabbing transition-all group overflow-hidden ${
        isDragging ? 'opacity-40 scale-95' : ''
      }`}
    >
      <div className="flex items-start gap-1.5">
        {/* Reorder arrows */}
        <div className="flex flex-col items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
            disabled={!onMoveUp}
            className="p-0 text-gray-300 dark:text-neutral-700 hover:text-gray-500 dark:hover:text-neutral-400 disabled:opacity-30"
          >
            <ChevronUp size={11} />
          </button>
          <GripVertical size={10} className="text-gray-300 dark:text-neutral-700" />
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
            disabled={!onMoveDown}
            className="p-0 text-gray-300 dark:text-neutral-700 hover:text-gray-500 dark:hover:text-neutral-400 disabled:opacity-30"
          >
            <ChevronDown size={11} />
          </button>
        </div>

        {/* Content - clickable */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
          <p className="text-xs font-medium text-gray-900 dark:text-white leading-snug break-words line-clamp-3">{task.title}</p>
          {task.description && (
            <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5 line-clamp-1">{task.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-blue-500 transition-colors">
            <Edit3 size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-1.5 ml-4">
        <button
          onClick={(e) => { e.stopPropagation(); onCyclePriority() }}
          className={`flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity`}
          title={`${priority.label} → click to change`}
        >
          <span className={`h-1 w-6 rounded-full ${priority.bar}`} />
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${priority.badge}`}>{priority.label}</span>
        </button>
        {task.due_date && (
          <span className="flex items-center gap-0.5 text-[9px] text-gray-400 dark:text-neutral-500">
            <CalendarIcon size={8} />
            {new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
          </span>
        )}
        {task.image_url && (
          <span className="ml-auto flex items-center gap-0.5 text-[9px] text-gray-400 dark:text-neutral-500" title="Tem imagem">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </span>
        )}
      </div>

      {/* Image thumbnail */}
      {task.image_url && (
        <div
          className="mt-2 ml-4 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onView() }}
        >
          <img
            src={task.image_url}
            alt=""
            className="w-full max-h-24 object-cover rounded-md border border-gray-200 dark:border-neutral-700"
          />
        </div>
      )}
    </div>
  )
}

// ==================== TASK DETAIL MODAL ====================

function TaskDetailModal({
  task,
  priorityStyles,
  locale,
  onEdit,
  onClose,
}: {
  task: Task
  priorityStyles: Record<string, { label: string; bar: string; badge: string }>
  locale: string
  onEdit: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const priority = priorityStyles[task.priority]

  const STATUS_LABELS: Record<string, string> = {
    todo: t('kanban.todo'),
    doing: t('kanban.doing'),
    blocked: t('kanban.blocked'),
    done: t('kanban.done'),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">{task.title}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-blue-500">
              <Edit3 size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status + Priority badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              task.status === 'blocked'
                ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                : task.status === 'done'
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : task.status === 'doing'
                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
            }`}>
              {STATUS_LABELS[task.status] || task.status}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priority.badge}`}>{priority.label}</span>
            {task.assigned_to && (
              <span className="text-xs text-gray-500 dark:text-neutral-400">{task.assigned_to}</span>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">{t('kanban.task_desc')}</p>
            <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed min-h-[60px]">
              {task.description || <span className="text-gray-400 dark:text-neutral-600 italic">{t('kanban.no_desc')}</span>}
            </div>
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400">
              <CalendarIcon size={14} />
              <span>{new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
          )}

          {/* Image */}
          {task.image_url && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">Imagem</p>
              <a href={task.image_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={task.image_url}
                  alt=""
                  className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 object-contain max-h-72 hover:opacity-90 transition-opacity"
                />
              </a>
            </div>
          )}
        </div>
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
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg p-2.5 border border-blue-300 dark:border-blue-500/30 shadow-lg mb-1.5">
      <input
        autoFocus
        type="text"
        placeholder={t('kanban.new_task')}
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
          <option value="low">{t('kanban.low')}</option>
          <option value="medium">{t('kanban.medium')}</option>
          <option value="high">{t('kanban.high')}</option>
        </select>
        <div className="flex-1" />
        <button onClick={onCancel} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 px-1.5 py-0.5">
          {t('common.cancel')}
        </button>
        <button
          onClick={() => { if (title.trim()) onSave(title.trim(), priority) }}
          className="text-[10px] bg-blue-600 text-white px-2.5 py-0.5 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          {t('common.save')}
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
  const { t } = useTranslation()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [assignee, setAssignee] = useState(task.assigned_to || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [status, setStatus] = useState(task.status)
  const [imagePreview, setImagePreview] = useState<string | null>(task.image_url || null)
  const [imgDragActive, setImgDragActive] = useState(false)

  const processImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 900
        const ratio = Math.min(1, MAX / Math.max(img.width, img.height))
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        setImagePreview(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Ctrl+V paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) { processImageFile(file); break }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleSave = () => {
    onSave({
      title,
      description: description || null,
      priority: priority as Task['priority'],
      assigned_to: assignee || null,
      due_date: dueDate || null,
      status,
      image_url: imagePreview || null,
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('kanban.edit_task')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.task_title')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.task_desc')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t('kanban.add_desc')}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.status')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="todo">{t('kanban.todo')}</option>
                <option value="doing">{t('kanban.doing')}</option>
                <option value="blocked">{t('kanban.blocked')}</option>
                <option value="done">{t('kanban.done')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.priority')}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="low">{t('kanban.low')}</option>
                <option value="medium">{t('kanban.medium')}</option>
                <option value="high">{t('kanban.high')}</option>
              </select>
            </div>
          </div>

          {/* Image upload zone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Imagem</label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
            {imagePreview ? (
              <img
                src={imagePreview}
                alt=""
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 object-contain max-h-48"
              />
            ) : (
              <div
                className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
                  imgDragActive
                    ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-500/5'
                    : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
                }`}
                onDragOver={(e) => { e.preventDefault(); setImgDragActive(true) }}
                onDragLeave={() => setImgDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setImgDragActive(false)
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith('image/')) processImageFile(file)
                }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = () => { if (input.files?.[0]) processImageFile(input.files[0]) }
                  input.click()
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-neutral-600"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                  Arraste, cole <kbd className="font-mono bg-gray-100 dark:bg-neutral-800 px-1 rounded text-[10px]">Ctrl+V</kbd> ou clique
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.responsible')}</label>
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
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.due_date')}</label>
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
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== AGENDA SECTION (Weekly Calendar) ====================

function AgendaSection({
  meetings,
  locale,
  onCreateMeeting,
  onDeleteMeeting,
}: {
  meetings: Meeting[]
  locale: string
  onCreateMeeting: (prefilledDate?: string) => void
  onDeleteMeeting: (id: string) => void
}) {
  const { t } = useTranslation()
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Calculate the 7 days of the current week (Mon-Sun)
  const getWeekDays = () => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
    monday.setHours(0, 0, 0, 0)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      days.push(d)
    }
    return days
  }

  const weekDays = getWeekDays()

  return (
    <div className="space-y-4">
      {/* Week header with navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('kanban.agenda')}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
            >
              {t('kanban.today_label')}
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-sm text-gray-500 dark:text-neutral-500">
            {weekDays[0].toLocaleDateString(locale, { day: '2-digit', month: 'short' })} – {weekDays[6].toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
          </span>
        </div>
        <button
          onClick={() => onCreateMeeting()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <CalendarPlus size={16} />
          {t('kanban.new_meeting')}
        </button>
      </div>

      {/* Weekly calendar grid */}
      <div className="overflow-x-auto -mx-6 px-6">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {weekDays.map((day) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
            const isToday = dateStr === today
            const isPast = dateStr < today
            const dayMeetings = meetings.filter((m) => m.meeting_date === dateStr)
            const dayName = day.toLocaleDateString(locale, { weekday: 'short' })
            const dayNum = day.getDate()

            return (
              <div
                key={dateStr}
                className={`min-h-[180px] rounded-xl border p-2 transition-colors ${
                  isToday
                    ? 'border-blue-300 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/[0.03]'
                    : isPast
                    ? 'border-gray-200/60 dark:border-neutral-800/60 bg-gray-50/50 dark:bg-neutral-900/50'
                    : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                }`}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] uppercase font-semibold tracking-wider ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-neutral-500'
                      }`}
                    >
                      {dayName}
                    </span>
                    {isToday ? (
                      <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {dayNum}
                      </span>
                    ) : (
                      <span className={`text-sm font-bold ${isPast ? 'text-gray-400 dark:text-neutral-600' : 'text-gray-700 dark:text-neutral-300'}`}>
                        {dayNum}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onCreateMeeting(dateStr)}
                    className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-300 dark:text-neutral-700 hover:text-gray-500 dark:hover:text-neutral-400 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Meeting cards */}
                <div className="space-y-1.5">
                  {dayMeetings.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMeeting(m)}
                      className={`w-full text-left p-2 rounded-lg border transition-all hover:shadow-sm ${
                        isToday
                          ? 'bg-blue-100/50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/15'
                          : 'bg-gray-50 dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800/80'
                      }`}
                    >
                      <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate">{m.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={9} className="text-gray-400 dark:text-neutral-500 flex-shrink-0" />
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400">{m.meeting_time.slice(0, 5)}</span>
                        {m.recurring_weekly && (
                          <Repeat size={9} className="text-blue-500 dark:text-blue-400 ml-auto flex-shrink-0" />
                        )}
                      </div>
                      {m.participants && m.participants.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {m.participants.slice(0, 3).map((p) => {
                            const member = TEAM.find((t) => t.name === p)
                            return (
                              <span key={p} className={`w-4 h-4 rounded-full ${member?.color || 'bg-gray-400'} flex items-center justify-center text-white text-[7px] font-bold`}>
                                {member?.initials?.[0] || p[0]}
                              </span>
                            )
                          })}
                          {m.participants.length > 3 && (
                            <span className="text-[8px] text-gray-400 dark:text-neutral-500 ml-0.5">+{m.participants.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Meeting detail modal */}
      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          locale={locale}
          onDelete={() => {
            onDeleteMeeting(selectedMeeting.id)
            setSelectedMeeting(null)
          }}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </div>
  )
}

// ==================== MEETING DETAIL MODAL ====================

function MeetingDetailModal({
  meeting,
  locale,
  onDelete,
  onClose,
}: {
  meeting: Meeting
  locale: string
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const isToday = meeting.meeting_date === today
  const isTomorrow = meeting.meeting_date === tomorrow

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">{meeting.title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {isToday && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {t('kanban.today_label')}
              </span>
            )}
            {isTomorrow && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                {t('kanban.tomorrow')}
              </span>
            )}
            {meeting.recurring_weekly && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Repeat size={10} />
                {t('kanban.weekly')}
              </span>
            )}
          </div>

          {/* Date, Time, Duration */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-neutral-300">
              <CalendarIcon size={15} className="text-gray-400 dark:text-neutral-500 flex-shrink-0" />
              <span>{new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-neutral-300">
              <Clock size={15} className="text-gray-400 dark:text-neutral-500 flex-shrink-0" />
              <span>{meeting.meeting_time.slice(0, 5)} ({meeting.duration_minutes}min)</span>
            </div>
            {meeting.location && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-neutral-300">
                <MapPin size={15} className="text-gray-400 dark:text-neutral-500 flex-shrink-0" />
                <span>{meeting.location}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {meeting.description && (
            <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-3 text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap">
              {meeting.description}
            </div>
          )}

          {/* Participants */}
          {meeting.participants && meeting.participants.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">{t('kanban.participants')}</p>
              <div className="flex flex-wrap gap-2">
                {meeting.participants.map((p) => {
                  const member = TEAM.find((t) => t.name === p)
                  return (
                    <span key={p} className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full px-2.5 py-1">
                      <span className={`w-5 h-5 rounded-full ${member?.color || 'bg-gray-400'} flex items-center justify-center text-white text-[9px] font-bold`}>
                        {member?.initials || p.split(' ').map((w) => w[0]).join('')}
                      </span>
                      <span className="text-xs text-gray-700 dark:text-neutral-300">{p.split(' ')[0]}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
            {t('common.delete')}
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-gray-100 dark:bg-neutral-800 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== CREATE MEETING MODAL ====================

function CreateMeetingModal({
  initialDate,
  onSave,
  onClose,
}: {
  initialDate?: string
  onSave: (m: { title: string; description?: string; meeting_date: string; meeting_time: string; duration_minutes: number; location?: string; recurring_weekly?: boolean; participants: string[] }) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate || '')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [location, setLocation] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])

  const toggleParticipant = (name: string) => {
    setParticipants((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    )
  }

  const handleSave = () => {
    if (!title.trim() || !date) return
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      meeting_date: date,
      meeting_time: time,
      duration_minutes: duration,
      location: location.trim() || undefined,
      recurring_weekly: recurring || undefined,
      participants,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('kanban.new_meeting')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.meeting_title')}</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.task_desc')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t('kanban.add_desc')}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.date')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.time')}</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.duration')}</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              >
                <option value={15}>15min</option>
                <option value={30}>30min</option>
                <option value={60}>1h</option>
                <option value={90}>1h30</option>
                <option value={120}>2h</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.location')}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zoom, Google Meet, Escritorio..."
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
            />
          </div>

          {/* Recurring toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 dark:bg-neutral-700 rounded-full peer-checked:bg-blue-600 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm text-gray-700 dark:text-neutral-300">{t('kanban.repeat_weekly')}</span>
          </label>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">{t('kanban.participants')}</label>
            <div className="flex flex-wrap gap-2">
              {TEAM.map((m) => {
                const selected = participants.includes(m.name)
                return (
                  <button
                    key={m.name}
                    onClick={() => toggleParticipant(m.name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                      selected
                        ? `${m.color} text-white border-transparent`
                        : 'bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-700'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full ${selected ? 'bg-white/30' : m.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                      {m.initials}
                    </span>
                    {m.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !date}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
