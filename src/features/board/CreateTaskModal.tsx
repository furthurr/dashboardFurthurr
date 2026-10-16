import { useId, useState } from 'react'
import { Dialog } from '@/shared/ui/Dialog'
import { type TaskStatus, type TaskPriority } from '@/types'
import { BOARD_COLUMNS } from './constants'
import { PRIORITY_COLORS } from './constants'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    description?: string
    status: TaskStatus
    priority: TaskPriority
  }) => void
  isLoading: boolean
  errorMessage?: string | null
}

export function CreateTaskModal({ isOpen, onClose, onSubmit, isLoading, errorMessage }: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('backlog')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const formId = useId()

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || !title.trim()) return
    onSubmit({ title: title.trim(), description: description.trim() || undefined, status, priority })
  }

  return (
    <Dialog title="Nueva tarea" onClose={onClose} busy={isLoading} className="max-w-lg">
      <form id={formId} onSubmit={handleSubmit} className="dialog-body space-y-4">
        {errorMessage && (
          <div role="alert" className="ui-feedback ui-feedback--error">
            <p>{errorMessage}</p>
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor={`${formId}-title`} className="ui-label">
            Título *
          </label>
          <input
            id={`${formId}-title`}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isLoading}
            className="ui-field"
            placeholder="Título de la tarea"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={`${formId}-description`} className="ui-label">
            Descripción
          </label>
          <textarea
            id={`${formId}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={isLoading}
            className="ui-field resize-none"
            placeholder="Descripción opcional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor={`${formId}-status`} className="ui-label">
              Estado
            </label>
            <select
              id={`${formId}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={isLoading}
              className="ui-field"
            >
              {BOARD_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor={`${formId}-priority`} className="ui-label">
              Prioridad
            </label>
            <select
              id={`${formId}-priority`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={isLoading}
              className="ui-field"
            >
              {Object.entries(PRIORITY_COLORS).map(([key]) => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
      <footer className="dialog-footer">
        <button
          type="button"
          form={formId}
          disabled={isLoading}
          onClick={() => { if (!isLoading) onClose() }}
          className="ui-button ui-button--secondary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form={formId}
          disabled={isLoading || !title.trim()}
          className="ui-button ui-button--primary"
        >
          {isLoading ? 'Creando...' : 'Crear Tarea'}
        </button>
      </footer>
    </Dialog>
  )
}
