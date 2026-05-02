import { useState } from 'react'
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

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({ title: title.trim(), description: description.trim() || undefined, status, priority })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl w-full max-w-md p-6 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Nueva Tarea</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Completa los detalles para crear</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface)] transition-all duration-[var(--transition-fast)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-[var(--color-text-muted)]">
              Título *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-[var(--transition-fast)]"
              placeholder="Título de la tarea"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-muted)]">
              Descripción
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-[var(--transition-fast)] resize-none"
              placeholder="Descripción opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="status" className="block text-sm font-medium text-[var(--color-text-muted)]">
                Estado
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-[var(--transition-fast)]"
              >
                {BOARD_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="priority" className="block text-sm font-medium text-[var(--color-text-muted)]">
                Prioridad
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-[var(--transition-fast)]"
              >
                {Object.entries(PRIORITY_COLORS).map(([key]) => (
                  <option key={key} value={key}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-white font-medium rounded-lg transition-all duration-[var(--transition-fast)] text-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-all duration-[var(--transition-fast)] text-sm hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[var(--color-primary)]/20"
            >
              {isLoading ? 'Creando...' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}