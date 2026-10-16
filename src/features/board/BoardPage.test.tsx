import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardPage } from './BoardPage'
import type { TaskWithAssignees } from '@/types'

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  return {
    tasks: vi.fn(), refetch: vi.fn(), update: mutation(), status: mutation(), positions: mutation(),
    create: mutation(), remove: mutation(), comment: mutation(), deleteComment: mutation(),
    upload: mutation(), deleteAttachment: mutation(),
  }
})

vi.mock('./api', () => ({
  useTasks: mocks.tasks, useUpdateTask: () => mocks.update,
  useUpdateTaskStatus: () => mocks.status, useUpdateTaskPositions: () => mocks.positions,
  useCreateTask: () => mocks.create, useDeleteTask: () => mocks.remove,
}))
vi.mock('./commentsApi', () => ({
  useComments: () => ({ data: [], isLoading: false, error: null }),
  useCreateComment: () => mocks.comment, useDeleteComment: () => mocks.deleteComment,
}))
vi.mock('./attachmentsApi', () => ({
  useAttachments: () => ({ data: [], isLoading: false, error: null }),
  useUploadAttachment: () => mocks.upload, useDeleteAttachment: () => mocks.deleteAttachment,
}))
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'equipo@example.test' }, profile: { role: 'admin' }, signOut: vi.fn() }),
}))

const task: TaskWithAssignees = {
  id: 'task-1', title: 'Revisar diseño', description: 'Contexto', status: 'backlog',
  priority: 'normal', special_notes: null, created_by: 'user-1', position: 0,
  created_at: '2026-10-16', updated_at: '2026-10-16', assignees: [],
}
const renderBoard = () => render(<MemoryRouter><BoardPage /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.update.mutateAsync.mockResolvedValue(undefined)
  mocks.status.mutateAsync.mockResolvedValue(undefined)
  mocks.tasks.mockReturnValue({ data: [task], isLoading: false, error: null, refetch: mocks.refetch })
})

describe('Integración del tablero', () => {
  it('no persiste un movimiento al soltar la tarjeta sobre sí misma', async () => {
    const user = userEvent.setup()
    renderBoard()
    screen.getByRole('button', { name: `Arrastrar tarea: ${task.title}` }).focus()
    await user.keyboard(' ')
    await user.keyboard(' ')
    expect(mocks.status.mutateAsync).not.toHaveBeenCalled()
  })

  it('propaga el fallo del guardado y conserva el detalle y su borrador', async () => {
    mocks.update.mutateAsync.mockRejectedValueOnce(new Error('información privada'))
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Borrador pendiente')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo guardar/i)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByLabelText('Título')).toHaveValue('Borrador pendiente')
    expect(mocks.update.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.id, title: 'Borrador pendiente' }))
    expect(screen.queryByText(/información privada/)).not.toBeInTheDocument()
  })

  it('espera la promesa de guardar antes de cerrar y anuncia el éxito', async () => {
    let resolve!: () => void
    mocks.update.mutateAsync.mockReturnValueOnce(new Promise<void>((done) => { resolve = done }))
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()
    expect(screen.getByRole('dialog')).toBeVisible()
    await act(async () => resolve())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status', { name: 'Estado del tablero' })).toHaveTextContent(/tarea guardada/i)
  })

  it('muestra un error seguro al mover y restaura la tarea', async () => {
    mocks.status.mutateAsync.mockRejectedValueOnce(new Error('secreto del servidor'))
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'Mover a la lista siguiente' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo mover/i)
    expect(screen.queryByText(/secreto del servidor/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }).closest('section')).toHaveAttribute('data-column-id', 'backlog')
  })

  it('serializa movimientos mientras espera y anuncia su éxito', async () => {
    let resolve!: () => void
    mocks.status.mutateAsync.mockReturnValueOnce(new Promise<void>((done) => { resolve = done }))
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'Mover a la lista siguiente' }))
    const region = screen.getByRole('region', { name: /columnas del tablero/i })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: `Arrastrar tarea: ${task.title}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mover a la lista siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mover a la lista siguiente' }))
    expect(mocks.status.mutateAsync).toHaveBeenCalledOnce()
    await act(async () => resolve())
    expect(region).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('status', { name: 'Estado del tablero' })).toHaveTextContent(/tarea movida/i)
  })

  it('ofrece reintentar la consulta fallida', async () => {
    mocks.tasks.mockReturnValue({ data: [], isLoading: false, error: new Error('privado'), refetch: mocks.refetch })
    const user = userEvent.setup()
    renderBoard()
    expect(screen.getByRole('alert')).toHaveTextContent(/error cargando tareas/i)
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })
})
