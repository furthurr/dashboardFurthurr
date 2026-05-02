import { type TaskStatus } from '@/types'

export const BOARD_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'por_hacer', label: 'Por hacer' },
  { id: 'haciendo', label: 'Haciendo' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'finalizadas', label: 'Finalizadas' },
]

export const PRIORITY_COLORS: Record<string, string> = {
  urgente: '#ef4444',
  alta: '#f97316',
  normal: '#3b82f6',
  baja: '#22c55e',
}