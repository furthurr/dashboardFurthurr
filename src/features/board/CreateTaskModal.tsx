import { useId, useRef, useState } from 'react'
import { Dialog } from '@/shared/ui/Dialog'
import { type TaskStatus, type TaskPriority } from '@/types'
import { BOARD_COLUMNS } from './constants'
import { PRIORITY_COLORS } from './constants'
import { AssigneePicker, type AssigneeOptions } from './AssigneePicker'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    title: string
    description?: string
    status: TaskStatus
    priority: TaskPriority
    files: File[]
    assigneeIds: string[]
  }) => void
  isLoading: boolean
  errorMessage?: string | null
  assigneeOptions?: AssigneeOptions
  initialAssigneeIds?: string[]
}

export function CreateTaskModal({ isOpen, onClose, onSubmit, isLoading, errorMessage, assigneeOptions, initialAssigneeIds = [] }: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('backlog')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [files, setFiles] = useState<File[]>([])
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => [...initialAssigneeIds])
  const [fileError, setFileError] = useState<string | null>(null)
  const formId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || !title.trim()) return
    onSubmit({ title: title.trim(), description: description.trim() || undefined, status, priority, files, assigneeIds })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    if (selectedFiles.length === 0) return

    const maxFileSize = 5 * 1024 * 1024
    const validFiles = selectedFiles.filter((file) => file.size <= maxFileSize)
    const oversizedFiles = selectedFiles.filter((file) => file.size > maxFileSize)

    if (validFiles.length > 0) setFiles((current) => [...current, ...validFiles])
    setFileError(oversizedFiles.length > 0
      ? `No se añadieron archivos superiores a 5 MB: ${oversizedFiles.map((file) => file.name).join(', ')}.`
      : null)
    // Permite volver a elegir el mismo archivo si se quitó de la lista.
    event.currentTarget.value = ''
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

        <AssigneePicker {...assigneeOptions} value={assigneeIds} onChange={setAssigneeIds} disabled={isLoading} />

        <div className="space-y-3">
          <p id={`${formId}-files-hint`} className="ui-label">Archivos adjuntos · máximo 5 MB por archivo</p>
          <input
            ref={fileInputRef}
            id={`${formId}-files`}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            disabled={isLoading}
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              aria-describedby={`${formId}-files-hint`}
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              Seleccionar archivos
            </button>
            {files.length === 0 && <span className="text-sm text-[var(--color-text-muted)]">Ningún archivo seleccionado</span>}
          </div>
          {fileError && <p id={`${formId}-files-error`} role="alert" className="ui-feedback ui-feedback--error">{fileError}</p>}
          {files.length > 0 && (
            <ul aria-label="Archivos seleccionados para adjuntar" className="space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="ui-list-card flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-0 flex-1 break-all text-sm text-[var(--color-text)]">{file.name}</span>
                  <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                    {file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                  <button
                    type="button"
                    className="ui-button ui-button--danger ui-button--sm"
                    aria-label={`Quitar ${file.name}`}
                    disabled={isLoading}
                    onClick={() => {
                      setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                      setFileError(null)
                    }}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
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
          {isLoading ? 'Creando tarea y adjuntos…' : 'Crear Tarea'}
        </button>
      </footer>
    </Dialog>
  )
}
