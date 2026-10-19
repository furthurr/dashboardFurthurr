import { useDroppable } from '@dnd-kit/core'
import { type TaskStatus, type TaskWithAssignees } from '@/types'
import { type TaskImagePreview } from './attachmentsApi'
import { SortableTaskCard } from './SortableTaskCard'
import { BOARD_COLUMNS } from './constants'

interface BoardColumnProps {
  id: TaskStatus
  label: string
  tasks: TaskWithAssignees[]
  taskImages?: Record<string, TaskImagePreview[]>
  onTaskClick?: (task: TaskWithAssignees) => void
  onMoveTask?: (taskId: string, direction: 'left' | 'right') => void
  onMoveTaskVertical?: (taskId: string, direction: 'up' | 'down') => void
}

export function BoardColumn({ id, label, tasks, taskImages = {}, onTaskClick, onMoveTask, onMoveTaskVertical }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const columnIndex = BOARD_COLUMNS.findIndex((col) => col.id === id)

  return (
    <section ref={setNodeRef} className="board-column" data-column-id={id} data-drag-over={isOver} aria-labelledby={`column-${id}`}>
      <div className="board-column-header">
        <h2 id={`column-${id}`}>{label}</h2>
        <span className="board-column-count" aria-label={`${tasks.length} tareas`}>
          {tasks.length}
        </span>
      </div>
      <div className="board-column-body">
          {tasks.length === 0 && (
            <div className="ui-empty my-auto">
              <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path strokeLinecap="round" d="M8 9h8M8 13h5" />
              </svg>
              <strong>Sin tareas en esta etapa</strong>
              <p>Arrastra una tarea aquí o usa sus controles para moverla.</p>
            </div>
          )}
          {tasks.map((task, index) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              images={taskImages[task.id]}
              onClick={() => onTaskClick?.(task)}
              onMoveLeft={() => onMoveTask?.(task.id, 'left')}
              onMoveRight={() => onMoveTask?.(task.id, 'right')}
              onMoveUp={() => onMoveTaskVertical?.(task.id, 'up')}
              onMoveDown={() => onMoveTaskVertical?.(task.id, 'down')}
              canMoveLeft={columnIndex > 0}
              canMoveRight={columnIndex < BOARD_COLUMNS.length - 1}
              canMoveUp={index > 0}
              canMoveDown={index < tasks.length - 1}
            />
          ))}
      </div>
    </section>
  )
}
