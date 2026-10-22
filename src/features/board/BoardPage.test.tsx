import { act, render, screen, waitFor, within } from '@testing-library/react'
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
    upload: mutation(), deleteAttachment: mutation(), taskImages: vi.fn(), assign: mutation(), users: vi.fn(), role: 'admin',
  }
})

vi.mock('./api', () => ({
  useTasks: mocks.tasks, useUpdateTask: () => mocks.update,
  useUpdateTaskStatus: () => mocks.status, useUpdateTaskPositions: () => mocks.positions,
  useCreateTask: () => mocks.create, useDeleteTask: () => mocks.remove,
  useSetTaskAssignees: () => mocks.assign,
}))
vi.mock('./assigneesApi', () => ({ useAssignableUsers: mocks.users }))
vi.mock('@/features/boards/api', () => ({ useMoveTaskToBoard: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
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
  useAuth: () => ({ user: { id: 'user-1', email: 'equipo@example.test' }, profile: { role: mocks.role }, signOut: vi.fn() }),
}))

const task: TaskWithAssignees = {
  board_id: 'offline',
  id: 'task-1', title: 'Revisar diseño', description: 'Contexto', status: 'backlog',
  priority: 'normal', special_notes: null, created_by: 'user-1', position: 0,
  created_at: '2026-10-16', updated_at: '2026-10-16', assignees: [],
}
const renderBoard = () => render(<MemoryRouter><BoardPage boardId="offline" boardName="Offline" boards={[]} /></MemoryRouter>)
const ana = { id: 'ana', full_name: 'Ana', email: 'ana@example.test', avatar_url: null, role: 'usuario' as const, is_active: true }
const bruno = { ...ana, id: 'bruno', full_name: 'Bruno', email: 'bruno@example.test' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.update.mutateAsync.mockResolvedValue(undefined)
  mocks.assign.mutateAsync.mockResolvedValue([])
  mocks.users.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() })
  mocks.role = 'admin'
  mocks.status.mutateAsync.mockResolvedValue(undefined)
  mocks.tasks.mockReturnValue({ data: [task], isLoading: false, error: null, refetch: mocks.refetch })
  mocks.taskImages.mockReturnValue({ data: {} })
})

describe('Integración del tablero', () => {
  it('consulta solo el tablero seleccionado y cierra el detalle si la tarea deja de pertenecerle', async () => {
    const user = userEvent.setup()
    const view = renderBoard()
    expect(mocks.tasks).toHaveBeenCalledWith('offline')
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    expect(screen.getByRole('dialog')).toBeVisible()
    mocks.tasks.mockReturnValue({ data: [], isLoading: false, error: null, refetch: mocks.refetch })
    view.rerender(<MemoryRouter><BoardPage boardId="offline" boardName="Offline" boards={[]} /></MemoryRouter>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('filtra por cualquiera de las personas, sin duplicados, y recupera Todos al quitar la última', async () => {
    const user = userEvent.setup()
    mocks.users.mockReturnValue({ data: [ana, bruno], isLoading: false, error: null })
    mocks.tasks.mockReturnValue({ data: [task,
      { ...task, id: 'a', title: 'Solo Ana', assignees: [ana] },
      { ...task, id: 'b', title: 'Solo Bruno', assignees: [bruno] },
      { ...task, id: 'both', title: 'Compartida', assignees: [ana, bruno] },
    ], isLoading: false })
    renderBoard()
    await user.click(screen.getByText('Filtrar usuarios: Todos'))
    const filter = within(screen.getByRole('group', { name: 'Filtrar tareas por usuarios asignados' }))
    expect(filter.getByRole('checkbox', { name: 'Todos' })).toBeChecked()
    expect(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` })).toBeVisible()
    await user.click(filter.getByRole('checkbox', { name: /Ana/ }))
    expect(filter.getByRole('checkbox', { name: 'Todos' })).not.toBeChecked()
    expect(screen.queryByRole('button', { name: `Abrir tarea: ${task.title}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir tarea: Solo Bruno' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir tarea: Solo Ana' })).toBeVisible()
    expect(within(screen.getByLabelText('Resumen de tareas')).getByText('Total').parentElement).toHaveTextContent('Total2')
    await user.click(filter.getByRole('checkbox', { name: /Bruno/ }))
    expect(screen.getAllByRole('button', { name: 'Abrir tarea: Compartida' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Abrir tarea: Solo Bruno' })).toBeVisible()
    await user.click(filter.getByRole('checkbox', { name: /Ana/ }))
    await user.click(filter.getByRole('checkbox', { name: /Bruno/ }))
    expect(filter.getByRole('checkbox', { name: 'Todos' })).toBeChecked()
    expect(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` })).toBeVisible()
    await user.click(filter.getByRole('checkbox', { name: /Ana/ }))
    await user.click(filter.getByRole('checkbox', { name: 'Todos' }))
    expect(filter.getByRole('checkbox', { name: /Ana/ })).not.toBeChecked()
  })

  it('precarga el filtro al crear, conserva cambios ante error y restablece las asignaciones al reabrir', async () => {
    const user = userEvent.setup()
    mocks.users.mockReturnValue({ data: [ana, bruno], isLoading: false, error: null })
    mocks.create.mutateAsync.mockRejectedValueOnce(new Error('fallo'))
    renderBoard()
    await user.click(screen.getByText('Filtrar usuarios: Todos'))
    const filter = within(screen.getByRole('group', { name: 'Filtrar tareas por usuarios asignados' }))
    await user.click(filter.getByRole('checkbox', { name: /Ana/ }))
    expect(screen.getByText('No hay tareas asignadas a los usuarios seleccionados.')).toBeVisible()
    await user.click(filter.getByRole('checkbox', { name: /Bruno/ }))
    await user.click(screen.getByText('Filtrar usuarios: 2 seleccionados'))
    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('button', { name: 'Desasignar a Ana' })).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Desasignar a Bruno' })).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Desasignar a Bruno' }))
    await user.type(dialog.getByLabelText(/título/i), 'Con filtro')
    await user.click(dialog.getByRole('button', { name: 'Crear Tarea' }))
    expect(mocks.create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: ['ana'] }))
    expect(await dialog.findByRole('alert')).toHaveTextContent('No se pudo crear')
    expect(dialog.getByRole('option', { name: /Bruno/ })).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desasignar a Bruno' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByText('Filtrar usuarios: 2 seleccionados'))
    await user.click(filter.getByRole('checkbox', { name: 'Todos' }))
    await user.click(screen.getByRole('button', { name: /nueva tarea/i }))
    expect(within(screen.getByRole('dialog')).getByRole('option', { name: /Ana/ })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('option', { name: /Bruno/ })).toBeInTheDocument()
  })

  it('calcula movimientos con las tareas ocultas y las conserva durante la actualización optimista', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    mocks.status.mutateAsync.mockReturnValueOnce(new Promise<void>((done) => { resolve = done }))
    mocks.users.mockReturnValue({ data: [ana], isLoading: false, error: null })
    mocks.tasks.mockReturnValue({ data: [
      { ...task, assignees: [ana] },
      { ...task, id: 'hidden', title: 'Oculta', status: 'por_hacer', position: 8 },
    ], isLoading: false })
    renderBoard()
    await user.click(screen.getByText('Filtrar usuarios: Todos'))
    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    await user.click(screen.getByRole('button', { name: 'Mover a la lista siguiente' }))
    expect(mocks.status.mutateAsync).toHaveBeenCalledWith({ taskId: task.id, status: 'por_hacer', position: 9 })
    await user.click(screen.getByRole('checkbox', { name: 'Todos' }))
    expect(screen.getByRole('button', { name: 'Abrir tarea: Oculta' })).toBeVisible()
    await act(async () => resolve())
  })

  it('reordena las tareas visibles incluyendo las posiciones de las ocultas', async () => {
    const user = userEvent.setup()
    mocks.users.mockReturnValue({ data: [ana], isLoading: false, error: null })
    mocks.tasks.mockReturnValue({ data: [
      { ...task, assignees: [ana] },
      { ...task, id: 'hidden', title: 'Oculta', position: 1 },
      { ...task, id: 'last', title: 'Última', position: 2, assignees: [ana] },
    ], isLoading: false })
    renderBoard()
    await user.click(screen.getByText('Filtrar usuarios: Todos'))
    await user.click(screen.getByRole('checkbox', { name: /Ana/ }))
    const firstCard = screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }).closest<HTMLDivElement>('.ui-list-card')!
    await user.click(within(firstCard).getByRole('button', { name: /bajar/i }))
    expect(mocks.positions.mutateAsync).toHaveBeenCalledWith([
      { taskId: 'hidden', position: 0 }, { taskId: 'last', position: 1 }, { taskId: task.id, position: 2 },
    ])
  })

  it('permite recuperar la lista de usuarios si falla sin restringir el tablero', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    mocks.users.mockReturnValue({ data: [], isLoading: false, error: new Error('fallo'), refetch: retry })
    renderBoard()
    await user.click(screen.getByText('Filtrar usuarios: Todos'))
    const filter = within(screen.getByRole('group', { name: 'Filtrar tareas por usuarios asignados' }))
    expect(filter.getByRole('checkbox', { name: 'Todos' })).toBeChecked()
    expect(filter.getByRole('alert')).toHaveTextContent('No se pudieron cargar los usuarios del filtro.')
    await user.click(filter.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` })).toBeVisible()
  })

  it.each(['usuario', 'invitado'])('permite al rol %s editar y asignar en tareas ajenas sin poder eliminarlas', async (role) => {
    const user = userEvent.setup()
    mocks.role = role
    const person = { id: 'person', full_name: 'Persona asignada', email: 'person@example.test', avatar_url: null, role: 'usuario' as const, is_active: true }
    mocks.users.mockReturnValue({ data: [person], isLoading: false, error: null, refetch: vi.fn() })
    mocks.tasks.mockReturnValue({ data: [{ ...task, created_by: 'someone-else' }], isLoading: false, error: null, refetch: mocks.refetch })
    mocks.assign.mutateAsync.mockResolvedValueOnce([person])
    renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    expect(screen.getByLabelText('Título')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar tarea' })).not.toBeInTheDocument()
    await user.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Asignar usuario'), 'person')
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciones' }))
    expect(mocks.assign.mutateAsync).toHaveBeenCalledExactlyOnceWith({ taskId: task.id, assigneeIds: ['person'] })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar asignaciones' })).toBeDisabled())
    expect(mocks.update.mutateAsync).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it.each(['usuario', 'invitado'])('permite al rol %s guardar los cambios de una tarea ajena', async (role) => {
    const user = userEvent.setup()
    mocks.role = role
    mocks.tasks.mockReturnValue({ data: [{ ...task, created_by: 'someone-else' }], isLoading: false, error: null, refetch: mocks.refetch })
    renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Editada por otra persona')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(mocks.update.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.id, title: 'Editada por otra persona' }))
  })

  it('reserva eliminar tarea al creador y al administrador', async () => {
    const user = userEvent.setup()
    mocks.role = 'usuario'
    mocks.tasks.mockReturnValue({ data: [{ ...task, created_by: 'someone-else' }], isLoading: false, error: null, refetch: mocks.refetch })
    const { unmount } = renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    expect(screen.queryByRole('button', { name: 'Eliminar tarea' })).not.toBeInTheDocument()
    unmount()

    mocks.role = 'usuario'
    mocks.tasks.mockReturnValue({ data: [{ ...task, created_by: 'user-1' }], isLoading: false, error: null, refetch: mocks.refetch })
    const own = renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    expect(screen.getByRole('button', { name: 'Eliminar tarea' })).toBeInTheDocument()
    own.unmount()

    mocks.role = 'admin'
    mocks.tasks.mockReturnValue({ data: [{ ...task, created_by: 'someone-else' }], isLoading: false, error: null, refetch: mocks.refetch })
    renderBoard()
    await user.click(screen.getByRole('button', { name: `Abrir tarea: ${task.title}` }))
    expect(screen.getByRole('button', { name: 'Eliminar tarea' })).toBeInTheDocument()
  })
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
      boardId: 'offline',
      title: 'Tarea con archivos', description: undefined, status: 'backlog', priority: 'normal', createdBy: 'user-1', assigneeIds: [],
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
