import { type CommentWithAuthor } from '@/types'
import { ProfileAvatar } from '@/shared/ui/ProfileAvatar'

interface CommentsListProps {
  comments: CommentWithAuthor[]
  onDeleteComment?: (commentId: string) => void
  canDelete?: boolean
}

export function CommentsList({ comments, onDeleteComment, canDelete }: CommentsListProps) {
  if (comments.length === 0) {
    return (
      <div className="ui-empty">
        <svg aria-hidden="true" className="ui-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3zM8 8h8M8 12h5" />
        </svg>
        <strong>Aún no hay comentarios</strong>
        <p>Comparte una actualización o una pregunta sobre esta tarea.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3" aria-label="Comentarios de la tarea">
      {comments.map((comment) => (
        <li key={comment.id} className="ui-list-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ProfileAvatar src={comment.author.avatar_url} name={comment.author.full_name} fallback="initials" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)] [overflow-wrap:anywhere]">
                  {comment.author.full_name}
                </p>
                <time dateTime={comment.created_at} className="block text-xs text-[var(--color-text-muted)]">
                  {new Date(comment.created_at).toLocaleDateString()}
                </time>
              </div>
            </div>
            {canDelete && onDeleteComment && (
              <button
                type="button"
                onClick={() => onDeleteComment(comment.id)}
                className="ui-button ui-button--danger ui-button--sm"
                aria-label={`Eliminar comentario de ${comment.author.full_name}`}
              >
                Eliminar
              </button>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text)] [overflow-wrap:anywhere]">{comment.body}</p>
        </li>
      ))}
    </ul>
  )
}
