import { useState, type ReactNode } from 'react'
import { type TaskWithAssignees } from '@/types'
import { Dialog } from '@/shared/ui/Dialog'
import { type TaskImagePreview } from './attachmentsApi'
import { PRIORITY_COLORS } from './constants'

interface TaskCardProps {
  task: TaskWithAssignees
  images?: TaskImagePreview[]
  isDragging?: boolean
  onClick?: () => void
  dragHandle?: ReactNode
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export function TaskCard({
  task,
  images = [],
  isDragging,
  onClick,
  dragHandle,
  onMoveLeft,
  onMoveRight,
  onMoveUp,
  onMoveDown,
  canMoveLeft,
  canMoveRight,
  canMoveUp,
  canMoveDown,
}: TaskCardProps) {
  const [previewImage, setPreviewImage] = useState<TaskImagePreview | null>(null)

  return (
    <>
      <div
        className={`
          ui-list-card p-3
          ${isDragging ? 'opacity-50' : 'hover:border-[var(--color-border-strong)]'}
          transition-colors duration-150 ease-out
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-semibold text-[var(--color-text)] [overflow-wrap:anywhere]">
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                aria-label={`Abrir tarea: ${task.title}`}
                className="ui-button w-full justify-start border-transparent bg-transparent px-1 text-left hover:text-[var(--color-link)]"
              >
                <span className="line-clamp-2">{task.title}</span>
              </button>
            ) : task.title}
          </h3>
          {dragHandle}
        </div>

        <span
          className="mt-2 inline-flex rounded-[var(--radius-sm)] border border-current px-2 py-0.5 text-xs font-medium"
          style={{ color: PRIORITY_COLORS[task.priority] }}
        >
          Prioridad {task.priority}
        </span>

        {task.description && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-text-muted)] [overflow-wrap:anywhere]">{task.description}</p>
        )}

        {images.length > 0 && !isDragging && (
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={`Imágenes adjuntas a ${task.title}`}>
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setPreviewImage(image)
                }}
                aria-label={`Ampliar imagen: ${image.fileName}`}
                title={`Ampliar imagen: ${image.fileName}`}
                className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
              >
                <img src={image.signedUrl} alt="" className="h-24 w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {(task.assignees.length > 0 || task.comment_count !== undefined) && (
          <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
            <div className="flex -space-x-2">
              {task.assignees.slice(0, 3).map((assignee, index) => (
                <div
                  key={`${assignee.full_name}-${index}`}
                  className="ui-avatar border-2 border-[var(--color-surface)]"
                  title={assignee.full_name}
                >
                  <span>
                    {assignee.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-surface-elevated)]">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">+{task.assignees.length - 3}</span>
                </div>
              )}
            </div>
            {task.comment_count !== undefined && (
              <span
                role="img"
                aria-label={`${task.comment_count} ${task.comment_count === 1 ? 'comentario' : 'comentarios'}`}
                title={`${task.comment_count} ${task.comment_count === 1 ? 'comentario' : 'comentarios'}`}
                className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center text-[var(--color-text-muted)]"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" />
                </svg>
                <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--color-surface)] bg-[var(--color-primary)] px-1 text-[9px] font-semibold leading-none tabular-nums text-[var(--color-on-primary)]">
                  {task.comment_count}
                </span>
              </span>
            )}
          </div>
        )}

        {task.special_notes && (
          <div className="mt-2 flex items-start gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1.5 text-xs text-[var(--color-warning)] [overflow-wrap:anywhere]">
            <svg aria-hidden="true" className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
            </svg>
            {task.special_notes}
          </div>
        )}

        {task.attachment_count !== undefined && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
            <span>{task.attachment_count} {task.attachment_count === 1 ? 'adjunto' : 'adjuntos'}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {onMoveUp && canMoveUp && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoveUp() }}
                className="ui-button ui-button--sm px-2"
                aria-label="Subir dentro de la lista"
                title="Subir dentro de la lista"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            {onMoveDown && canMoveDown && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoveDown() }}
                className="ui-button ui-button--sm px-2"
                aria-label="Bajar dentro de la lista"
                title="Bajar dentro de la lista"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onMoveLeft && canMoveLeft && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoveLeft() }}
                className="ui-button ui-button--sm px-2"
                aria-label="Mover a la lista anterior"
                title="Mover a la lista anterior"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {onMoveRight && canMoveRight && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMoveRight() }}
                className="ui-button ui-button--sm px-2"
                aria-label="Mover a la lista siguiente"
                title="Mover a la lista siguiente"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {previewImage && (
        <Dialog title={previewImage.fileName} onClose={() => setPreviewImage(null)} className="max-w-6xl">
          <div className="dialog-body grid place-items-center">
            <img
              src={previewImage.signedUrl}
              alt={previewImage.fileName}
              className="max-h-[75dvh] max-w-full rounded-[var(--radius-md)] object-contain"
            />
          </div>
        </Dialog>
      )}
    </>
  )
}
