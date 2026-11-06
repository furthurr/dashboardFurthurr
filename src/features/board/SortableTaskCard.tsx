import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type TaskWithAssignees } from '@/types'
import { type TaskImagePreview } from './attachmentsApi'
import { TaskCard } from './TaskCard'

interface SortableTaskCardProps {
  task: TaskWithAssignees
  images?: TaskImagePreview[]
  onClick?: () => void
  onCommentClick?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  readOnly?: boolean
}

export function SortableTaskCard({
  task,
  images,
  onClick,
  onCommentClick,
  onMoveLeft,
  onMoveRight,
  onMoveUp,
  onMoveDown,
  canMoveLeft,
  canMoveRight,
  canMoveUp,
  canMoveDown,
  readOnly = false,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: task.id, disabled: readOnly })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
    >
      <TaskCard
        task={task}
        images={images}
        isDragging={isDragging}
        onClick={onClick}
        onCommentClick={onCommentClick}
        dragHandle={!readOnly &&
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-label={`Arrastrar tarea: ${task.title}`}
            title="Arrastrar tarea"
            className="ui-button ui-button--sm shrink-0 touch-none cursor-grab px-2 active:cursor-grabbing"
          >
            <svg aria-hidden="true" className="ui-icon" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5" />
              <circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" />
              <circle cx="15" cy="19" r="1.5" />
            </svg>
          </button>
        }
        onMoveLeft={readOnly ? undefined : onMoveLeft}
        onMoveRight={readOnly ? undefined : onMoveRight}
        onMoveUp={readOnly ? undefined : onMoveUp}
        onMoveDown={readOnly ? undefined : onMoveDown}
        canMoveLeft={canMoveLeft}
        canMoveRight={canMoveRight}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
    </div>
  )
}
