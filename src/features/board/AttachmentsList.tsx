import { useId, useState } from 'react'
import { type TaskAttachment } from '@/types'

interface AttachmentsListProps {
  attachments: TaskAttachment[]
  onRenameAttachment?: (attachmentId: string, fileName: string) => Promise<boolean> | boolean
  onDeleteAttachment?: (attachmentId: string) => void
  canManageAttachment?: (attachment: TaskAttachment) => boolean
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function splitFileName(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot < name.length - 1
    ? { base: name.slice(0, dot), extension: name.slice(dot) }
    : { base: name, extension: '' }
}

export function AttachmentsList({ attachments, onRenameAttachment, onDeleteAttachment, canManageAttachment, disabled = false }: AttachmentsListProps) {
  const id = useId()
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

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
      {attachments.map((attachment) => {
        const isEditing = editingAttachmentId === attachment.id
        const canManage = canManageAttachment?.(attachment) ?? false
        const trimmedFileName = fileName.trim()
        const { base, extension } = splitFileName(attachment.file_name)
        const invalidExtension = !extension && Boolean(splitFileName(trimmedFileName).extension)

        return <li
          key={attachment.id}
          className="ui-list-card flex flex-wrap items-center gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] text-[var(--color-link)]">
            <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6M8 13h8M8 17h5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? <form className="space-y-2" onSubmit={async (event) => {
              event.preventDefault()
              if (!trimmedFileName || invalidExtension || !onRenameAttachment) return
              const saved = await onRenameAttachment(attachment.id, trimmedFileName + extension)
              if (saved) setEditingAttachmentId(null)
            }}>
              <label htmlFor={`${id}-file-name`} className="sr-only">Nuevo nombre de {attachment.file_name}</label>
              <input id={`${id}-file-name`} className="ui-field" autoFocus required value={fileName}
                disabled={disabled} aria-describedby={`${id}-file-extension`} onChange={(event) => setFileName(event.target.value)} />
              <p id={`${id}-file-extension`} className="text-xs text-[var(--color-text-muted)]">
                {extension ? `Extensión (no editable): ${extension}` : 'Archivo sin extensión. No añadas una extensión.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="ui-button ui-button--primary ui-button--sm"
                  disabled={disabled || !trimmedFileName || invalidExtension || trimmedFileName === base}>Guardar nombre</button>
                <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={disabled}
                  onClick={() => setEditingAttachmentId(null)}>Cancelar</button>
              </div>
            </form> : <p className="text-sm font-medium text-[var(--color-text)] [overflow-wrap:anywhere]">{attachment.file_name}</p>}
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {formatFileSize(attachment.file_size)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={attachment.signed_url}
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
            {canManage && !isEditing && onRenameAttachment && (
              <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={disabled}
                aria-label={`Cambiar nombre de ${attachment.file_name}`}
                onClick={() => { setFileName(base); setEditingAttachmentId(attachment.id) }}>
                Cambiar nombre
              </button>
            )}
            {canManage && onDeleteAttachment && (
              <button type="button" onClick={() => onDeleteAttachment(attachment.id)}
                className="ui-button ui-button--danger ui-button--sm" disabled={disabled || isEditing}
                aria-label={`Eliminar ${attachment.file_name}`}>Eliminar</button>
            )}
          </div>
        </li>
      })}
    </ul>
  )
}
