import { useState } from 'react'
import { type TaskWithAssignees, type TaskStatus, type TaskPriority, type CommentWithAuthor, type TaskAttachment } from '@/types'
import { BOARD_COLUMNS } from './constants'
import { PRIORITY_COLORS } from './constants'
import { CommentsList } from './CommentsList'
import { AttachmentsList } from './AttachmentsList'

interface TaskDetailModalProps {
  task: TaskWithAssignees | null
  comments: CommentWithAuthor[]
  attachments: TaskAttachment[]
  isOpen: boolean
  onClose: () => void
  onSave?: (data: { title: string; description: string; status: TaskStatus; priority: TaskPriority }) => void
  onDelete?: () => void
  onAddComment?: (body: string) => void
  onDeleteComment?: (commentId: string) => void
  onUploadAttachment?: (file: File) => void
  onDeleteAttachment?: (attachmentId: string) => void
  canDeleteComments?: boolean
  canDeleteAttachments?: boolean
}

export function TaskDetailModal({
  task,
  comments,
  attachments,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onAddComment,
  onDeleteComment,
  onUploadAttachment,
  onDeleteAttachment,
  canDeleteComments,
  canDeleteAttachments,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'attachments'>('details')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'backlog')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'normal')
  const [newComment, setNewComment] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!isOpen || !task) return null

  const handleOpenTask = () => {
    if (editingTaskId !== task.id) {
      setEditingTaskId(task.id)
      setTitle(task.title || '')
      setDescription(task.description || '')
      setStatus(task.status || 'backlog')
      setPriority(task.priority || 'normal')
      setNewComment('')
      setActiveTab('details')
    }
  }

  handleOpenTask()

  const handleAddComment = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment.trim())
      setNewComment('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#242424] border border-[#333333] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-[#333333]">
          <h2 className="text-lg font-semibold text-white pr-4">Detalle de Tarea</h2>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white transition flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-[#333333]">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'details'
                ? 'text-white border-b-2 border-[#3b82f6]'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Detalles
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'comments'
                ? 'text-white border-b-2 border-[#3b82f6]'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Comentarios ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'attachments'
                ? 'text-white border-b-2 border-[#3b82f6]'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Adjuntos ({attachments.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="detail-title" className="block text-sm font-medium text-[#cccccc]">
                  Título
                </label>
                <input
                  id="detail-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="detail-description" className="block text-sm font-medium text-[#cccccc]">
                  Descripción
                </label>
                <textarea
                  id="detail-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="detail-status" className="block text-sm font-medium text-[#cccccc]">
                    Estado
                  </label>
                  <select
                    id="detail-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition"
                  >
                    {BOARD_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="detail-priority" className="block text-sm font-medium text-[#cccccc]">
                    Prioridad
                  </label>
                  <select
                    id="detail-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition"
                  >
                    {Object.keys(PRIORITY_COLORS).map((key) => (
                      <option key={key} value={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {task.special_notes && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-400">{task.special_notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {onAddComment && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white text-sm placeholder-[#555555] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#3b82f6]/50 text-white text-sm font-medium rounded-lg transition"
                  >
                    Enviar
                  </button>
                </div>
              )}
              <CommentsList
                comments={comments}
                onDeleteComment={onDeleteComment}
                canDelete={canDeleteComments}
              />
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {onUploadAttachment && (
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          alert('El archivo debe ser menor a 5 MB')
                          return
                        }
                        onUploadAttachment(file)
                        e.target.value = ''
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1a1a1a] border border-dashed border-[#333333] rounded-lg text-sm text-[#888888] hover:border-[#3b82f6] hover:text-[#3b82f6] cursor-pointer transition"
                  >
                    📎 Subir adjunto (máx. 5 MB)
                  </label>
                </div>
              )}
              <AttachmentsList
                attachments={attachments}
                onDeleteAttachment={onDeleteAttachment}
                canDelete={canDeleteAttachments}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-[#333333]">
          {onDelete && (showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#cccccc]">¿Eliminar tarea?</span>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onDelete()
                }}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition"
              >
                Sí
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-[#333333] hover:bg-[#444444] text-white text-xs font-medium rounded-lg transition"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition text-sm"
            >
              Eliminar
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#333333] hover:bg-[#444444] text-white font-medium rounded-lg transition text-sm"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              onSave?.({ title, description, status, priority })
              onClose()
            }}
            className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium rounded-lg transition text-sm"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  )
}