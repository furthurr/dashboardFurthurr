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
    upload: mutation(), deleteAttachment: mutation(), taskImages: vi.fn(),
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
  useTaskImagePreviews: mocks.taskImages,
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
  mocks.taskImages.mockReturnValue({ data: {} })
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

  it('muestra en los cards las miniaturas recibidas para cada tarea y abre su imagen', async () => {
    const user = userEvent.setup()
    mocks.taskImages.mockReturnValue({ data: {
      [task.id]: [{ id: 'image-1', fileName: 'referencia.png', signedUrl: 'https://example.test/referencia.png' }],
    } })
    renderBoard()

    await user.click(screen.getByRole('button', { name: 'Ampliar imagen: referencia.png' }))
    expect(screen.getByRole('dialog', { name: 'referencia.png' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'referencia.png' })).toHaveAttribute('src', 'https://example.test/referencia.png')
  })

  it('crea la tarea antes de subir los archivos seleccionados y los asocia a su id', async () => {
    const user = userEvent.setup()
    const createdTask = { ...task, id: 'new-task-id', title: 'Tarea con archivos' }
    let resolveCreate!: (value: TaskWithAssignees) => void
    mocks.create.mutateAsync.mockReturnValueOnce(new Promise<TaskWithAssignees>((resolve) => { resolveCreate = resolve }))
    const { container } = renderBoard()

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByLabelText(/título/i), 'Tarea con archivos')
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const firstFile = new File(['uno'], 'brief.pdf', { type: 'application/pdf' })
    const secondFile = new File(['dos'], 'captura.png', { type: 'image/png' })
    await user.upload(fileInput, [firstFile, secondFile])
    await user.click(screen.getByRole('button', { name: 'Crear Tarea' }))

    expect(mocks.create.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      title: 'Tarea con archivos', description: undefined, status: 'backlog', priority: 'normal', createdBy: 'user-1',
    })
    expect(mocks.upload.mutateAsync).not.toHaveBeenCalled()

    await act(async () => { resolveCreate(createdTask) })
    await waitFor(() => expect(mocks.upload.mutateAsync).toHaveBeenNthCalledWith(1, {
      taskId: 'new-task-id', uploadedBy: 'user-1', file: firstFile,
    }))
    expect(mocks.upload.mutateAsync).toHaveBeenNthCalledWith(2, {
      taskId: 'new-task-id', uploadedBy: 'user-1', file: secondFile,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status', { name: 'Estado del tablero' })).toHaveTextContent('Tarea creada correctamente.')
  })

  it('mantiene la tarea si falla alguna subida y anuncia los archivos que se pueden añadir desde el detalle', async () => {
    const user = userEvent.setup()
    mocks.create.mutateAsync.mockResolvedValueOnce({ ...task, id: 'created-with-upload-error' })
    mocks.upload.mutateAsync
      .mockRejectedValueOnce(new Error('detalle privado del servidor'))
      .mockResolvedValueOnce(undefined)
    const { container } = renderBoard()

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByLabelText(/título/i), 'Tarea parcialmente adjuntada')
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const failedFile = new File(['uno'], 'fallido.pdf', { type: 'application/pdf' })
    const successfulFile = new File(['dos'], 'correcto.png', { type: 'image/png' })
    await user.upload(fileInput, [failedFile, successfulFile])
    await user.click(screen.getByRole('button', { name: 'Crear Tarea' }))

    const warning = await screen.findByRole('alert')
    expect(warning).toHaveTextContent('Tarea creada')
    expect(warning).toHaveTextContent('fallido.pdf')
    expect(warning).toHaveTextContent('detalle de la tarea')
    expect(warning).not.toHaveTextContent('detalle privado del servidor')
    expect(mocks.create.mutateAsync).toHaveBeenCalledOnce()
    expect(mocks.upload.mutateAsync).toHaveBeenCalledTimes(2)
    expect(mocks.upload.mutateAsync).toHaveBeenNthCalledWith(1, {
      taskId: 'created-with-upload-error', uploadedBy: 'user-1', file: failedFile,
    })
    expect(mocks.upload.mutateAsync).toHaveBeenNthCalledWith(2, {
      taskId: 'created-with-upload-error', uploadedBy: 'user-1', file: successfulFile,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('no intenta subir adjuntos ni cierra el formulario si falla la creación de la tarea', async () => {
    const user = userEvent.setup()
    mocks.create.mutateAsync.mockRejectedValueOnce(new Error('detalle privado del servidor'))
    const { container } = renderBoard()

    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    await user.type(screen.getByLabelText(/título/i), 'No creada')
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(fileInput, new File(['contenido'], 'archivo.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Crear Tarea' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo crear la tarea')
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByLabelText(/título/i)).toHaveValue('No creada')
    expect(screen.getByRole('list', { name: 'Archivos seleccionados para adjuntar' })).toHaveTextContent('archivo.pdf')
    expect(mocks.upload.mutateAsync).not.toHaveBeenCalled()
    expect(screen.queryByText('detalle privado del servidor')).not.toBeInTheDocument()
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
