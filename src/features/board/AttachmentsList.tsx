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
      <div className="text-sm text-[#888888] py-4 text-center">
        No hay adjuntos
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center gap-3 bg-[#1a1a1a] rounded-lg p-3"
        >
          <div className="w-8 h-8 rounded bg-[#333333] flex items-center justify-center text-white text-xs">
            📎
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{attachment.file_name}</p>
            <p className="text-xs text-[#888888]">
              {formatFileSize(attachment.file_size)}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={attachment.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition"
            >
              Ver
            </a>
            {canDelete && onDeleteAttachment && (
              <button
                onClick={() => onDeleteAttachment(attachment.id)}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}