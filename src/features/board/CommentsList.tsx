import { type CommentWithAuthor } from '@/types'

interface CommentsListProps {
  comments: CommentWithAuthor[]
  onDeleteComment?: (commentId: string) => void
  canDelete?: boolean
}

export function CommentsList({ comments, onDeleteComment, canDelete }: CommentsListProps) {
  if (comments.length === 0) {
    return (
      <div className="text-sm text-[#888888] py-4 text-center">
        No hay comentarios aún
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="bg-[#1a1a1a] rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#3b82f6] flex items-center justify-center">
                <span className="text-xs text-white">
                  {comment.author.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-white">
                {comment.author.full_name}
              </span>
              <span className="text-xs text-[#888888]">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            {canDelete && onDeleteComment && (
              <button
                onClick={() => onDeleteComment(comment.id)}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                Eliminar
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-[#cccccc]">{comment.body}</p>
        </div>
      ))}
    </div>
  )
}