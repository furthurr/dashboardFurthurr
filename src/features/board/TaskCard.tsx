import { useState, type ReactNode } from 'react'
import { type TaskWithAssignees } from '@/types'
import { Dialog } from '@/shared/ui/Dialog'
import { ProfileAvatar } from '@/shared/ui/ProfileAvatar'
import { type TaskImagePreview } from './attachmentsApi'
import { PRIORITY_COLORS } from './constants'

interface TaskCardProps {
  task: TaskWithAssignees
  images?: TaskImagePreview[]
  isDragging?: boolean
  onClick?: () => void
  onCommentClick?: () => void
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
  onCommentClick,
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
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const previewIndex = previewImageId === null ? -1 : images.findIndex((image) => image.id === previewImageId)
  const previewImage = previewIndex < 0 ? null : images[previewIndex]

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
                  setPreviewImageId(image.id)
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

        {(task.assignees.length > 0 || onCommentClick) && (
          <div className="mt-3 flex min-h-8 items-center justify-between gap-2">
            <div className="flex -space-x-2">
              {task.assignees.slice(0, 3).map((assignee, index) => (
                <ProfileAvatar
                  key={`${assignee.full_name}-${index}`}
                  src={assignee.avatar_url}
                  name={assignee.full_name}
                  size="sm"
                  fallback="initials"
                  className="border-2 border-[var(--color-surface)]"
                />
              ))}
              {task.assignees.length > 3 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-surface-elevated)]">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">+{task.assignees.length - 3}</span>
                </div>
              )}
            </div>
            {onCommentClick && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onCommentClick()
                }}
                aria-label={`Ver comentarios de ${task.title}${task.comment_count === undefined ? '' : ` (${task.comment_count} ${task.comment_count === 1 ? 'comentario' : 'comentarios'})`}`}
                title={task.comment_count === undefined ? 'Ver comentarios' : `${task.comment_count} ${task.comment_count === 1 ? 'comentario' : 'comentarios'}`}
                className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
              >
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" />
                </svg>
                {task.comment_count !== undefined && task.comment_count > 0 && (
                  <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--color-surface)] bg-[var(--color-primary)] px-1 text-[9px] font-semibold leading-none tabular-nums text-[var(--color-on-primary)]">
                    {task.comment_count}
                  </span>
                )}
              </button>
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
        <Dialog title={task.title} subtitle={previewImage.fileName} onClose={() => setPreviewImageId(null)} className="max-w-6xl">
          <div className="dialog-body space-y-5">
            <div className="relative flex min-h-56 w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)]">
              <img
                src={previewImage.signedUrl}
                alt={previewImage.fileName}
                className="max-h-[65dvh] max-w-full object-contain"
              />
              {images.length > 1 && <>
                <button
                  type="button"
                  aria-label={`Imagen anterior de ${task.title}`}
                  title="Imagen anterior"
                  disabled={previewIndex <= 0}
                  onClick={() => {
                    const previousImage = images[previewIndex - 1]
                    if (previousImage) setPreviewImageId(previousImage.id)
                  }}
                  className="ui-button ui-button--secondary absolute left-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 justify-center rounded-full p-0 shadow-lg"
                >
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label={`Imagen siguiente de ${task.title}`}
                  title="Imagen siguiente"
                  disabled={previewIndex >= images.length - 1}
                  onClick={() => {
                    const nextImage = images[previewIndex + 1]
                    if (nextImage) setPreviewImageId(nextImage.id)
                  }}
                  className="ui-button ui-button--secondary absolute right-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 justify-center rounded-full p-0 shadow-lg"
                >
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </>}
            </div>
            <section aria-label="Descripción de la actividad" className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Descripción de la actividad</h3>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text-muted)] [overflow-wrap:anywhere]">
                {task.description?.trim() ? task.description : 'Esta tarea no tiene descripción.'}
              </p>
            </section>
          </div>
        </Dialog>
      )}
    </>
  )
}
