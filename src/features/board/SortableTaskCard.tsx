import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type TaskWithAssignees } from '@/types'
import { TaskCard } from './TaskCard'

interface SortableTaskCardProps {
  task: TaskWithAssignees
  onClick?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export function SortableTaskCard({
  task,
  onClick,
  onMoveLeft,
  onMoveRight,
  onMoveUp,
  onMoveDown,
  canMoveLeft,
  canMoveRight,
  canMoveUp,
  canMoveDown,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <TaskCard
        task={task}
        isDragging={isDragging}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveLeft={canMoveLeft}
        canMoveRight={canMoveRight}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
    </div>
  )
}
