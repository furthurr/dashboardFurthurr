import { type TaskStatus } from '@/types'

export const BOARD_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'por_hacer', label: 'Por hacer' },
  { id: 'haciendo', label: 'Haciendo' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'finalizadas', label: 'Finalizadas' },
]

export const PRIORITY_COLORS: Record<string, string> = {
  urgente: 'var(--color-priority-urgent)',
  alta: 'var(--color-priority-high)',
  normal: 'var(--color-priority-normal)',
  baja: 'var(--color-priority-low)',
}
