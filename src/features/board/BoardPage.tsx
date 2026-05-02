import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useTasks, useUpdateTaskStatus, useCreateTask, useDeleteTask, useUpdateTask } from './api'
import { useComments, useCreateComment, useDeleteComment } from './commentsApi'
import { useAttachments, useUploadAttachment, useDeleteAttachment } from './attachmentsApi'
import { BOARD_COLUMNS } from './constants'
import { BoardColumn } from './BoardColumn'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'
import { TaskDetailModal } from './TaskDetailModal'
import { type TaskStatus, type TaskWithAssignees } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'

export function BoardPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: tasks = [], isLoading, error } = useTasks()
  const updateTaskStatus = useUpdateTaskStatus()
  const createTask = useCreateTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const [activeTask, setActiveTask] = useState<TaskWithAssignees | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithAssignees[] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin'

  const selectedTaskId = selectedTask?.id ?? null
  const { data: comments = [] } = useComments(selectedTaskId)
  const { data: attachments = [] } = useAttachments(selectedTaskId)
  const createComment = useCreateComment()
  const deleteComment = useDeleteComment()
  const uploadAttachment = useUploadAttachment()
  const deleteAttachment = useDeleteAttachment()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">Error cargando tareas</p>
        </div>
      </div>
    )
  }

  const displayTasks = optimisticTasks ?? tasks

  const tasksByColumn = BOARD_COLUMNS.reduce<Record<TaskStatus, typeof displayTasks>>(
    (acc, col) => {
      acc[col.id] = displayTasks.filter((t) => t.status === col.id)
      return acc
    },
    {} as Record<TaskStatus, typeof displayTasks>
  )

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const task = displayTasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    const task = displayTasks.find((t) => t.id === taskId)
    if (!task) return

    const isOverColumn = BOARD_COLUMNS.some((c) => c.id === overId)
    const overTask = displayTasks.find((t) => t.id === overId)

    let newStatus: TaskStatus | null = null
    let newPosition = task.position

    if (isOverColumn) {
      newStatus = overId as TaskStatus
    } else if (overTask) {
      newStatus = overTask.status
      newPosition = overTask.position + 1
    }

    if (newStatus && (newStatus !== task.status || newPosition !== task.position)) {
      setOptimisticTasks((prev) => {
        const updated = prev ?? displayTasks
        return updated.map((t) =>
          t.id === taskId ? { ...t, status: newStatus!, position: newPosition } : t
        )
      })

      updateTaskStatus.mutate(
        { taskId, status: newStatus, position: newPosition },
        {
          onError: () => {
            setOptimisticTasks(null)
          },
          onSuccess: () => {
            setOptimisticTasks(null)
          },
        }
      )
    }
  }

  function handleMoveTask(taskId: string, direction: 'left' | 'right') {
    const task = displayTasks.find((t) => t.id === taskId)
    if (!task) return

    const currentColumnIndex = BOARD_COLUMNS.findIndex((c) => c.id === task.status)
    const newColumnIndex = direction === 'left' ? currentColumnIndex - 1 : currentColumnIndex + 1

    if (newColumnIndex < 0 || newColumnIndex >= BOARD_COLUMNS.length) return

    const newStatus = BOARD_COLUMNS[newColumnIndex].id
    const tasksInNewColumn = displayTasks.filter((t) => t.status === newStatus)
    const newPosition = tasksInNewColumn.length > 0 ? Math.max(...tasksInNewColumn.map((t) => t.position)) + 1 : 0

    setOptimisticTasks((prev) => {
      const updated = prev ?? displayTasks
      return updated.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t
      )
    })

    updateTaskStatus.mutate(
      { taskId, status: newStatus, position: newPosition },
      {
        onError: () => {
          setOptimisticTasks(null)
        },
        onSuccess: () => {
          setOptimisticTasks(null)
        },
      }
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-[#1a1a1a]">
        <header className="bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Dashboard Furthurr</h1>
                <p className="text-xs text-[var(--color-text-muted)]">Tablero Kanban</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
                    <span className="text-xs text-white font-medium">{user.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-[var(--color-text-muted)] hidden sm:inline">{user.email}</span>
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => navigate('/register')}
                  className="px-4 py-2 bg-gradient-to-r from-[var(--color-accent)] to-[#10b981] hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all duration-[var(--transition-fast)] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[var(--color-accent)]/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Alta de Usuario
                </button>
              )}
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-white text-sm font-medium rounded-lg transition-all duration-[var(--transition-fast)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Cerrar Sesión
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all duration-[var(--transition-fast)] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[var(--color-primary)]/20"
              >
                + Nueva Tarea
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 overflow-x-auto">
          <div className="flex gap-4">
            {BOARD_COLUMNS.map((col) => (
              <div key={col.id} className="flex-shrink-0 w-72">
                <SortableContext
                  items={tasksByColumn[col.id].map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <BoardColumn
                    id={col.id}
                    label={col.label}
                    tasks={tasksByColumn[col.id]}
                    onTaskClick={(task) => {
                      setSelectedTask(task)
                      setIsDetailOpen(true)
                    }}
                    onMoveTask={handleMoveTask}
                  />
                </SortableContext>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>

        <CreateTaskModal
          key={isModalOpen ? 'open' : 'closed'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setCreateError(null)
          }}
          onSubmit={(data) => {
            if (!user) return
            setCreateError(null)
            createTask.mutate(
              { ...data, createdBy: user.id },
              {
                onSuccess: () => {
                  setIsModalOpen(false)
                  setCreateError(null)
                },
                onError: (err: { message?: string; code?: string }) => {
                  const message = err?.message || err?.code || 'Error desconocido'
                  if (message.includes('42501') || message.includes('row-level security')) {
                    setCreateError('No tienes permisos para crear tareas. Contacta a un administrador.')
                  } else {
                    setCreateError(`Error: ${message}`)
                  }
                },
              }
            )
          }}
          isLoading={createTask.isPending}
          errorMessage={createError}
        />

        <TaskDetailModal
          task={selectedTask}
          comments={comments}
          attachments={attachments}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false)
            setSelectedTask(null)
          }}
          onSave={(data) => {
            if (!selectedTask) return
            updateTask.mutate({ taskId: selectedTask.id, ...data })
          }}
          onDelete={selectedTask ? () => {
            deleteTask.mutate(selectedTask.id, {
              onSuccess: () => {
                setIsDetailOpen(false)
                setSelectedTask(null)
              },
            })
          } : undefined}
          onAddComment={(body) => {
            if (!selectedTask || !user) return
            createComment.mutate({ taskId: selectedTask.id, authorId: user.id, body })
          }}
          onDeleteComment={(commentId) => {
            deleteComment.mutate({ commentId })
          }}
          onUploadAttachment={(file) => {
            if (!selectedTask || !user) return
            uploadAttachment.mutate({ taskId: selectedTask.id, uploadedBy: user.id, file })
          }}
          onDeleteAttachment={(attachmentId) => {
            if (!selectedTask) return
            const attachment = attachments.find((a) => a.id === attachmentId)
            if (attachment) {
              deleteAttachment.mutate({ attachmentId, fileUrl: attachment.file_url })
            }
          }}
          canDeleteComments={user?.id === selectedTask?.created_by || false}
          canDeleteAttachments={user?.id === selectedTask?.created_by || false}
        />
      </div>
    </DndContext>
  )
}