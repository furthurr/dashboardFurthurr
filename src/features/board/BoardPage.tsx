import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Board } from '@/types'
import { useMoveTaskToBoard } from '@/features/boards/api'
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
import { useTasks, useUpdateTaskStatus, useCreateTask, useDeleteTask, useUpdateTask, useUpdateTaskPositions, useSetTaskAssignees } from './api'
import { useAssignableUsers } from './assigneesApi'
import { useComments, useCreateComment, useDeleteComment } from './commentsApi'
import { useAttachments, useTaskImagePreviews, useUploadAttachment, useRenameAttachment, useDeleteAttachment } from './attachmentsApi'
import { BOARD_COLUMNS } from './constants'
import { BoardColumn } from './BoardColumn'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'
import { AssigneeFilter } from './AssigneeFilter'
import { TaskDetailModal } from './TaskDetailModal'
import { type TaskPriority, type TaskStatus, type TaskWithAssignees } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'
import { AccountMenu } from '@/shared/ui/AccountMenu'
import { Toast } from '@/shared/ui/Toast'
import { useToast } from '@/shared/ui/useToast'

export function BoardPage({ boardId, boardName, boards }: { boardId: string; boardName: string; boards: Board[] }) {
  const { user, profile } = useAuth()
  const { data: tasks = [], isLoading, error, refetch } = useTasks(boardId)
  const moveToBoard = useMoveTaskToBoard()
  const { data: taskImages = {} } = useTaskImagePreviews(tasks.map((task) => task.id))
  const updateTaskStatus = useUpdateTaskStatus()
  const createTask = useCreateTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()
  const updateTaskPositions = useUpdateTaskPositions()
  const [activeTask, setActiveTask] = useState<TaskWithAssignees | null>(null)
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithAssignees[] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [initialDetailTab, setInitialDetailTab] = useState<'details' | 'comments'>('details')
  const assignableUsers = useAssignableUsers(true)
  const [filterUserIds, setFilterUserIds] = useState<string[]>([])
  const setTaskAssignees = useSetTaskAssignees()
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createWarning, setCreateWarning] = useState<string | null>(null)
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false)
  const { notice, setNotice, dismissNotice } = useToast()
  const [moveError, setMoveError] = useState<string | null>(null)
  const [movementPending, setMovementPending] = useState(false)
  const pendingRef = useRef(false)
  const createPendingRef = useRef(false)
  const movementBusy = movementPending || updateTaskStatus.isPending || updateTaskPositions.isPending

  const isAdmin = profile?.role === 'admin'
  // El borrado no se amplía respecto a la regla anterior: solo el creador o un admin.
  const canDeleteSelectedTask = isAdmin || selectedTask?.created_by === user?.id
  const assigneeOptions = {
    users: assignableUsers.data ?? [], loading: assignableUsers.isLoading,
    error: Boolean(assignableUsers.error), onRetry: () => { void assignableUsers.refetch() },
  }

  function openTaskDetail(task: TaskWithAssignees, initialTab: 'details' | 'comments' = 'details') {
    setSelectedTask(task)
    setInitialDetailTab(initialTab)
    setIsDetailOpen(true)
  }

  // A transfer/deletion by another session must not leave a stale detail open.
  const selectedTaskId = tasks.some((task) => task.id === selectedTask?.id) ? selectedTask?.id ?? null : null
  const { data: comments = [], isLoading: commentsLoading, error: commentsError } = useComments(selectedTaskId)
  const { data: attachments = [], isLoading: attachmentsLoading, error: attachmentsError } = useAttachments(selectedTaskId)
  const createComment = useCreateComment()
  const deleteComment = useDeleteComment()
  const uploadAttachment = useUploadAttachment()
  const renameAttachment = useRenameAttachment()
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
      <main className="board-shell grid place-items-center p-6" aria-busy="true">
        <p role="status" className="ui-feedback">Cargando tareas…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="board-shell grid place-items-center p-6">
        <div className="space-y-4">
          <p role="alert" className="ui-feedback ui-feedback--error">Error cargando tareas. Inténtalo de nuevo.</p>
          <button type="button" className="ui-button" onClick={() => { void refetch() }}>Reintentar</button>
        </div>
      </main>
    )
  }

  const displayTasks = optimisticTasks ?? tasks
  const visibleTasks = filterUserIds.length === 0 ? displayTasks
    : displayTasks.filter((task) => task.assignees.some((person) => filterUserIds.includes(person.id)))

  const tasksByColumn = BOARD_COLUMNS.reduce<Record<TaskStatus, typeof displayTasks>>(
    (acc, col) => {
      acc[col.id] = displayTasks
        .filter((t) => t.status === col.id)
        .sort((a, b) => a.position - b.position)
      return acc
    },
    {} as Record<TaskStatus, typeof displayTasks>
  )
  const visibleTasksByColumn = BOARD_COLUMNS.reduce<Record<TaskStatus, typeof displayTasks>>((acc, col) => {
    acc[col.id] = tasksByColumn[col.id].filter((task) => visibleTasks.includes(task))
    return acc
  }, {} as Record<TaskStatus, typeof displayTasks>)

  async function performMovement(action: () => Promise<unknown>) {
    if (pendingRef.current || movementBusy) return
    pendingRef.current = true
    setMovementPending(true)
    setMoveError(null)
    setNotice('')
    try {
      await action()
      setNotice('Tarea movida correctamente.')
    } catch {
      setMoveError('No se pudo mover la tarea. Inténtalo de nuevo.')
    } finally {
      setOptimisticTasks(null)
      pendingRef.current = false
      setMovementPending(false)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (pendingRef.current || movementBusy) return
    const { active } = event
    const task = displayTasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (pendingRef.current || movementBusy) return
    if (!over) {
      setNotice('Movimiento cancelado.')
      return
    }

    const taskId = active.id as string
    const overId = over.id as string
    if (taskId === overId) return

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

      const status = newStatus
      void performMovement(() => updateTaskStatus.mutateAsync({ taskId, status, position: newPosition }))
    }
  }

  function handleMoveTask(taskId: string, direction: 'left' | 'right') {
    if (pendingRef.current || movementBusy) return
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

    void performMovement(() => updateTaskStatus.mutateAsync({ taskId, status: newStatus, position: newPosition }))
  }

  function handleMoveTaskVertical(taskId: string, direction: 'up' | 'down') {
    if (pendingRef.current || movementBusy) return
    const task = displayTasks.find((t) => t.id === taskId)
    if (!task) return

    const sortedTasks = [...tasksByColumn[task.status]]
    const visibleColumn = visibleTasksByColumn[task.status]
    const visibleIndex = visibleColumn.findIndex((t) => t.id === taskId)
    const visibleTarget = visibleColumn[visibleIndex + (direction === 'up' ? -1 : 1)]
    if (!visibleTarget) return
    const currentIndex = sortedTasks.findIndex((t) => t.id === taskId)

    const targetIndex = sortedTasks.findIndex((t) => t.id === visibleTarget.id)

    if (targetIndex < 0 || targetIndex >= sortedTasks.length) return

    const reorderedTasks = [...sortedTasks]
    const [movedTask] = reorderedTasks.splice(currentIndex, 1)
    reorderedTasks.splice(targetIndex, 0, movedTask)

    const updates = reorderedTasks
      .map((reorderedTask, index) => ({
        taskId: reorderedTask.id,
        position: index,
      }))
      .filter(({ taskId, position }) => {
        const originalTask = sortedTasks.find((t) => t.id === taskId)
        return originalTask?.position !== position
      })

    if (updates.length > 0) void performMovement(() => updateTaskPositions.mutateAsync(updates))
  }

  async function handleCreateTask(data: {
    title: string
    description?: string
    status: TaskStatus
    priority: TaskPriority
    files: File[]
    assigneeIds: string[]
  }) {
    if (!user || createPendingRef.current) return

    createPendingRef.current = true
    setIsCreateSubmitting(true)
    setCreateError(null)
    setCreateWarning(null)
    setNotice('')

    try {
      const { files, ...taskData } = data
      const createdTask = await createTask.mutateAsync({ ...taskData, boardId, createdBy: user.id })
      const failedFiles: string[] = []

      // La tarea debe existir antes de subir archivos porque sus metadatos requieren task_id.
      for (const file of files) {
        try {
          await uploadAttachment.mutateAsync({ taskId: createdTask.id, uploadedBy: user.id, file })
        } catch {
          failedFiles.push(file.name)
        }
      }

      setIsModalOpen(false)
      setCreateError(null)

      if (failedFiles.length > 0) {
        const count = failedFiles.length
        const message = count === 1
          ? `Tarea creada, pero no se pudo adjuntar 1 archivo: ${failedFiles[0]}. Puedes añadirlo desde el detalle de la tarea.`
          : `Tarea creada, pero no se pudieron adjuntar ${count} archivos: ${failedFiles.join(', ')}. Puedes añadirlos desde el detalle de la tarea.`
        setCreateWarning(message)
      } else {
        setNotice('Tarea creada correctamente.')
      }
    } catch (err) {
      const error = err as { message?: string; code?: string }
      const message = `${error?.message ?? ''} ${error?.code ?? ''}`.toLowerCase()
      if (message.includes('42501') || message.includes('row-level security')) {
        setCreateError('No tienes permisos para crear tareas. Contacta a un administrador.')
      } else {
        setCreateError('No se pudo crear la tarea. Inténtalo de nuevo.')
      }
    } finally {
      createPendingRef.current = false
      setIsCreateSubmitting(false)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null)
        setMoveError(null)
        setNotice('Movimiento cancelado.')
      }}
    >
      <main className="board-shell max-w-full overflow-x-clip">
        <header className="board-header">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">Dashboard Furthurr</p>
            <h1 className="break-words">{boardName}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Organiza las tareas y sigue el trabajo del equipo.</p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Link to="/boards" className="ui-button">Cambiar tablero</Link>
            {user && <span className="max-w-48 truncate text-sm text-[var(--color-text-muted)]" title={user.email}>{user.email}</span>}
            <AccountMenu />
          </div>
        </header>

        <div className="board-toolbar">
          <dl aria-label="Resumen de tareas" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div><dt className="text-[var(--color-text-muted)]">Total</dt><dd className="font-semibold">{visibleTasks.length}</dd></div>
            {BOARD_COLUMNS.map((col) => <div key={col.id}><dt className="text-[var(--color-text-muted)]">{col.label}</dt><dd className="font-semibold">{visibleTasksByColumn[col.id].length}</dd></div>)}
          </dl>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <AssigneeFilter {...assigneeOptions} value={filterUserIds} onChange={setFilterUserIds} />
            {profile?.role !== 'invitado' && <button type="button" className="ui-button ui-button--primary" onClick={() => setIsModalOpen(true)}>+ Nueva Tarea</button>}
          </div>
        </div>
        <div className="px-4 sm:px-8">
          {filterUserIds.length > 0 && visibleTasks.length === 0 && <p role="status" className="ui-feedback mb-4">No hay tareas asignadas a los usuarios seleccionados.</p>}
          {moveError && <p role="alert" className="ui-feedback ui-feedback--error mb-4">{moveError}</p>}
          {createWarning && <div role="alert" className="ui-feedback ui-feedback--error mb-4 flex flex-wrap items-start justify-between gap-3">
            <p className="min-w-0 flex-1">{createWarning}</p>
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setCreateWarning(null)}>
              Cerrar aviso
            </button>
          </div>}
        </div>
        <Toast notice={notice} onClose={dismissNotice} label="Estado del tablero" />

        <section className="board-columns" aria-label="Columnas del tablero" tabIndex={0} aria-busy={movementBusy}
          onPointerDownCapture={(event) => {
            if (pendingRef.current || movementBusy) event.stopPropagation()
          }}
          onKeyDownCapture={(event) => {
            if ((pendingRef.current || movementBusy) && (event.key === ' ' || event.key === 'Enter')) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}>
            {BOARD_COLUMNS.map((col) => (
              <fieldset key={col.id} disabled={movementBusy} className="m-0 min-w-0 shrink-0 border-0 p-0">
                <SortableContext
                  items={visibleTasksByColumn[col.id].map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <BoardColumn
                    id={col.id}
                    label={col.label}
                    tasks={visibleTasksByColumn[col.id]}
                    taskImages={taskImages}
                    onTaskClick={(task) => openTaskDetail(task)}
                    onTaskCommentsClick={(task) => openTaskDetail(task, 'comments')}
                    onMoveTask={handleMoveTask}
                    onMoveTaskVertical={handleMoveTaskVertical}
                  />
                </SortableContext>
              </fieldset>
            ))}
        </section>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} images={taskImages[activeTask.id]} isDragging /> : null}
        </DragOverlay>

        <CreateTaskModal
          key={isModalOpen ? 'open' : 'closed'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setCreateError(null)
          }}
          onSubmit={handleCreateTask}
          isLoading={isCreateSubmitting || createTask.isPending || uploadAttachment.isPending}
          errorMessage={createError}
          assigneeOptions={assigneeOptions}
          initialAssigneeIds={filterUserIds}
        />

        <TaskDetailModal
          boards={boards.filter((board) => board.id !== boardId && board.is_active)}
          onMoveToBoard={selectedTask ? async (destinationId) => {
            await moveToBoard.mutateAsync({ taskId: selectedTask.id, boardId: destinationId })
            setOptimisticTasks(null)
            setNotice('Tarea trasladada al tablero seleccionado.')
          } : undefined}
          task={selectedTaskId ? selectedTask : null}
          initialTab={initialDetailTab}
          comments={comments}
          attachments={attachments}
          commentsLoading={commentsLoading}
          attachmentsLoading={attachmentsLoading}
          commentsError={Boolean(commentsError)}
          attachmentsError={Boolean(attachmentsError)}
          assigneeOptions={assigneeOptions}
          onSaveAssignees={selectedTask ? async (assigneeIds) => {
            const taskId = selectedTask.id
            const assignees = await setTaskAssignees.mutateAsync({ taskId, assigneeIds })
            setSelectedTask((current) => current?.id === taskId ? { ...current, assignees } : current)
            setOptimisticTasks((current) => current?.map((task) => task.id === taskId ? { ...task, assignees } : task) ?? null)
          } : undefined}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false)
            setSelectedTask(null)
          }}
          // Edición compartida: cualquier cuenta activa puede editar los campos de cualquier tarea.
          onSave={selectedTask ? (data) => {
            setNotice('')
            return updateTask.mutateAsync({ taskId: selectedTask.id, ...data }).then(() => {
              setNotice('Tarea guardada correctamente.')
            })
          } : undefined}
          onDelete={selectedTask && canDeleteSelectedTask ? () => {
            setNotice('')
            return deleteTask.mutateAsync(selectedTask.id).then(() => {
              setNotice('Tarea eliminada correctamente.')
            })
          } : undefined}
          onAddComment={selectedTask && user ? (body) =>
            createComment.mutateAsync({ taskId: selectedTask.id, authorId: user.id, body })
          : undefined}
          onDeleteComment={(commentId) => {
            return deleteComment.mutateAsync({ commentId })
          }}
          onUploadAttachment={selectedTask && user ? (file) =>
            uploadAttachment.mutateAsync({ taskId: selectedTask.id, uploadedBy: user.id, file })
          : undefined}
          onRenameAttachment={selectedTask ? (attachmentId, fileName) =>
            renameAttachment.mutateAsync({ attachmentId, fileName })
          : undefined}
          onDeleteAttachment={(attachmentId) => {
            const attachment = attachments.find((a) => a.id === attachmentId)
            if (!attachment) return Promise.reject(new Error('Adjunto no disponible'))
            return deleteAttachment.mutateAsync({ attachmentId, fileUrl: attachment.file_url })
          }}
          canDeleteComments={user?.id === selectedTask?.created_by || false}
          canManageAttachment={(attachment) => Boolean(user && (
            isAdmin || user.id === selectedTask?.created_by || user.id === attachment.uploaded_by
          ))}
        />
      </main>
      {profile?.role !== 'invitado' && (
        <button
          type="button"
          className="ui-button ui-button--primary board-create-fab"
          aria-label="Crear tarea"
          title="Nueva tarea"
          onClick={() => setIsModalOpen(true)}
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
      )}
    </DndContext>
  )
}
