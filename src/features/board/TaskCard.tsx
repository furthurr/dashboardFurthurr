import { type TaskWithAssignees } from '@/types'
import { PRIORITY_COLORS } from './constants'

interface TaskCardProps {
  task: TaskWithAssignees
  isDragging?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export function TaskCard({ task, isDragging, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: TaskCardProps) {
  return (
    <div
      className={`
        bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3
        ${isDragging ? 'opacity-50 scale-105 shadow-xl shadow-[var(--color-primary)]/10' : 'hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:shadow-[var(--color-primary)]/5'}
        transition-all duration-[var(--transition-normal)]
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white line-clamp-2 flex-1">{task.title}</h3>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 animate-pulse"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={task.priority}
        />
      </div>

      {task.description && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)] line-clamp-2">{task.description}</p>
      )}

      {task.assignees.length > 0 && (
        <div className="mt-3 flex -space-x-2">
          {task.assignees.slice(0, 3).map((assignee, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] border-2 border-[var(--color-surface)] flex items-center justify-center shadow-md"
              title={assignee.full_name}
            >
              <span className="text-xs text-white font-medium">
                {assignee.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
          ))}
          {task.assignees.length > 3 && (
            <div className="w-7 h-7 rounded-full bg-[var(--color-surface-elevated)] border-2 border-[var(--color-surface)] flex items-center justify-center">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">+{task.assignees.length - 3}</span>
            </div>
          )}
        </div>
      )}

      {task.special_notes && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1.5 border border-amber-400/20">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
          </svg>
          {task.special_notes}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {onMoveUp && canMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoveUp?.() }}
            className="p-1.5 rounded-lg bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white text-xs transition-all duration-[var(--transition-fast)] hover:scale-110 active:scale-95"
            title="Subir"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}
        <div className="flex-1" />
        {onMoveDown && canMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoveDown?.() }}
            className="p-1.5 rounded-lg bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white text-xs transition-all duration-[var(--transition-fast)] hover:scale-110 active:scale-95"
            title="Bajar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}