import { type TaskAttachment } from '@/types'

interface AttachmentsListProps {
  attachments: TaskAttachment[]
  onDeleteAttachment?: (attachmentId: string) => void
  canDelete?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsList({ attachments, onDeleteAttachment, canDelete }: AttachmentsListProps) {
  if (attachments.length === 0) {
    return (
      <div className="ui-empty">
        <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8M7 14l8-8" />
        </svg>
        <strong>Aún no hay archivos adjuntos</strong>
        <p>Los archivos de referencia de esta tarea aparecerán aquí.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3" aria-label="Archivos adjuntos de la tarea">
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="ui-list-card flex flex-wrap items-center gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] text-[var(--color-link)]">
            <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6M8 13h8M8 17h5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] [overflow-wrap:anywhere]">{attachment.file_name}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {formatFileSize(attachment.file_size)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={attachment.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-button ui-button--secondary ui-button--sm"
              aria-label={`Ver ${attachment.file_name} (se abre en otra pestaña)`}
            >
              Ver
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
              </svg>
            </a>
            {canDelete && onDeleteAttachment && (
              <button
                type="button"
                onClick={() => onDeleteAttachment(attachment.id)}
                className="ui-button ui-button--danger ui-button--sm"
                aria-label={`Eliminar ${attachment.file_name}`}
              >
                Eliminar
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
