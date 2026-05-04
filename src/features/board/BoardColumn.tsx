import { useDroppable } from '@dnd-kit/core'
import { type TaskStatus, type TaskWithAssignees } from '@/types'
import { SortableTaskCard } from './SortableTaskCard'

interface BoardColumnProps {
  id: TaskStatus
  label: string
  tasks: TaskWithAssignees[]
  onTaskClick?: (task: TaskWithAssignees) => void
  onMoveTaskVertical?: (taskId: string, direction: 'up' | 'down') => void
}

export function BoardColumn({ id, label, tasks, onTaskClick, onMoveTaskVertical }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72" data-column-id={id}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-surface-elevated)] to-[var(--color-surface)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{label}</h2>
            <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] px-2.5 py-1 rounded-full border border-[var(--color-border)]">
              {tasks.length}
            </span>
          </div>
        </div>
        <div className="p-3 space-y-2 min-h-[200px]">
          {tasks.map((task, index) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              onMoveUp={() => onMoveTaskVertical?.(task.id, 'up')}
              onMoveDown={() => onMoveTaskVertical?.(task.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < tasks.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}