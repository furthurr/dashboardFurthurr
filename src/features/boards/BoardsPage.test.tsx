import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardsPage, getBoardDeleteErrorMessage, getBoardUpdateErrorMessage, getCreateBoardErrorMessage } from './BoardsPage'
import { BoardRoute } from './BoardRoute'

const mocks = vi.hoisted(() => ({
  role: 'admin', boards: vi.fn(), members: vi.fn(), users: vi.fn(), create: vi.fn(), save: vi.fn(),
  rename: vi.fn(), setActive: vi.fn(), deleteBoard: vi.fn(),
  createError: null as unknown, saveError: null as unknown, boardId: 'offline',
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ profile: { role: mocks.role }, signOut: vi.fn() }) }))
vi.mock('./api', () => ({
  useBoards: mocks.boards, useBoardMembers: mocks.members,
  useCreateBoard: () => ({ mutateAsync: mocks.create, isPending: false, error: mocks.createError }),
  useSetBoardMembers: () => ({ mutateAsync: mocks.save, isPending: false, error: mocks.saveError }),
  useRenameBoard: () => ({ mutateAsync: mocks.rename, isPending: false, error: null }),
  useSetBoardActive: () => ({ mutateAsync: mocks.setActive, isPending: false, error: null }),
  useDeleteBoard: () => ({ mutateAsync: mocks.deleteBoard, isPending: false, error: null }),
}))
vi.mock('@/features/board/assigneesApi', () => ({ useAssignableUsers: mocks.users }))
vi.mock('@/features/board/BoardPage', () => ({ BoardPage: ({ boardId, boardName }: { boardId: string; boardName: string }) => <h1>{boardName} · {boardId}</h1> }))
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useParams: () => ({ boardId: mocks.boardId }) }))

const board = { id: 'offline', name: 'Offline', is_active: true, pending_count: 3, my_pending_count: 0, people: [], created_at: '2026-10-21' }
const assignedBoard = { id: 'assigned', name: 'Marketing', is_active: true, pending_count: 4, my_pending_count: 2, people: [{ id: 'ana', full_name: 'Ana Pérez', avatar_url: null }], created_at: '2026-10-21' }
const archivedBoard = { id: 'archived', name: 'Archivo 2025', is_active: false, pending_count: 7, my_pending_count: 0, people: [], created_at: '2026-10-21' }
const ana = { id: 'ana', full_name: 'Ana', email: 'ana@example.test', role: 'usuario' as const, is_active: true, avatar_url: null }
const renderPage = () => render(<MemoryRouter><BoardsPage /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'admin'
  mocks.boards.mockReturnValue({ data: [board], isLoading: false, error: null, refetch: vi.fn() })
  mocks.members.mockReturnValue({ data: [ana], isLoading: false, error: null, refetch: vi.fn() })
  mocks.users.mockReturnValue({ data: [ana], isLoading: false, error: null })
  mocks.create.mockResolvedValue(board)
  mocks.save.mockResolvedValue(undefined)
  mocks.rename.mockResolvedValue(undefined)
  mocks.setActive.mockResolvedValue(undefined)
  mocks.deleteBoard.mockResolvedValue(undefined)
  mocks.saveError = null
})

describe('Selección y gestión de tableros', () => {
  it('explica errores de permisos/sesión y aporta el código seguro en fallos no clasificados', () => {
    expect(getCreateBoardErrorMessage({ code: '42501' })).toMatch(/permisos.*administrador/i)
    expect(getCreateBoardErrorMessage({ status: 401 })).toMatch(/sesión caducó/i)
    expect(getCreateBoardErrorMessage({ code: 'PGRST205' })).toContain('código PGRST205')
    expect(getCreateBoardErrorMessage({ code: '23514' })).toMatch(/1 y 120 caracteres/i)
    expect(getBoardUpdateErrorMessage({ code: '23505' })).toMatch(/Ya existe un tablero/i)
    expect(getBoardUpdateErrorMessage({ code: 'P0002' })).toMatch(/ya no existe/i)
    expect(getBoardDeleteErrorMessage({ code: '55000' })).toMatch(/desactivados/i)
    expect(getBoardDeleteErrorMessage({ code: 'BOARD_ATTACHMENTS_DELETE_FAILED' })).toMatch(/archivos podrían haberse eliminado/i)
    expect(getBoardDeleteErrorMessage({ code: 'BOARD_DELETE_FAILED_AFTER_STORAGE' })).toMatch(/archivos adjuntos ya se eliminaron/i)
  })
  it('muestra cards con enlace al tablero y gestión solo para administradores', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Offline' })).toHaveAttribute('href', '/board/offline')
    expect(screen.getByRole('button', { name: 'Crear tablero' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Gestionar miembros de Offline' })).toBeVisible()
  })
  it('separa tableros con mis tareas pendientes y muestra conteos y personas asignadas', () => {
    mocks.boards.mockReturnValue({ data: [board, assignedBoard, archivedBoard], isLoading: false, error: null })
    renderPage()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Tableros con mis tareas pendientes', 'Tableros activos', 'Tableros desactivados',
    ])
    const assignedSection = screen.getByRole('heading', { name: 'Tableros con mis tareas pendientes' }).parentElement?.parentElement as HTMLElement
    const assignedCard = within(assignedSection).getByRole('link', { name: 'Marketing' }).closest('li') as HTMLElement
    expect(within(assignedCard).getByText('Tareas pendientes:')).toBeVisible()
    expect(within(assignedCard).getByText('4')).toBeVisible()
    expect(within(assignedCard).getByText('Mis tareas pendientes:')).toBeVisible()
    expect(within(assignedCard).getByText('2')).toBeVisible()
    expect(within(assignedCard).getByText('Ana')).toBeVisible()
    expect(within(assignedCard).getByRole('img', { name: 'Foto de Ana Pérez' })).toBeVisible()
    const activeSection = screen.getByRole('heading', { name: 'Tableros activos' }).parentElement?.parentElement as HTMLElement
    expect(within(activeSection).queryByRole('link', { name: 'Marketing' })).not.toBeInTheDocument()
    expect(within(activeSection).getByRole('link', { name: 'Offline' })).toBeVisible()
  })
  it.each(['usuario', 'invitado'])('no ofrece creación ni gestión a %s', (role) => {
    mocks.role = role
    renderPage()
    expect(screen.queryByRole('button', { name: 'Crear tablero' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gestionar miembros/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cambiar nombre/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar tablero/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Offline' })).toBeVisible()
  })
  it('explica el estado sin membresías sin mostrar tableros ajenos', () => {
    mocks.boards.mockReturnValue({ data: [], isLoading: false, error: null })
    renderPage()
    expect(screen.getByText('No tienes tableros asignados')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Offline' })).not.toBeInTheDocument()
  })
  it('muestra carga y permite reintentar errores', async () => {
    mocks.boards.mockReturnValue({ isLoading: true })
    const view = renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tableros')
    const retry = vi.fn()
    mocks.boards.mockReturnValue({ isLoading: false, error: new Error('fallo'), refetch: retry })
    view.rerender(<MemoryRouter><BoardsPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
  })
  it('crea con nombre y muestra un mensaje específico si está duplicado', async () => {
    const user = userEvent.setup()
    mocks.create.mockRejectedValueOnce({ code: '23505' })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Crear tablero' }))
    await user.type(screen.getByLabelText('Nombre del tablero'), 'Offline')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tablero' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un tablero')
    expect(screen.getByLabelText('Nombre del tablero')).toHaveValue('Offline')
    await user.clear(screen.getByLabelText('Nombre del tablero'))
    await user.type(screen.getByLabelText('Nombre del tablero'), 'Marketing')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tablero' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.create).toHaveBeenLastCalledWith('Marketing')
  })
  it('precarga miembros y permite retirar todos sin modificar responsables', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Gestionar miembros de Offline' }))
    expect(screen.getByRole('button', { name: 'Desasignar a Ana' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Desasignar a Ana' }))
    await user.click(screen.getByRole('button', { name: 'Guardar miembros' }))
    expect(mocks.save).toHaveBeenCalledWith({ boardId: 'offline', profileIds: [] })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('no deja guardar una lista vacía si falla la carga de miembros', async () => {
    mocks.members.mockReturnValue({ error: new Error('fallo'), isLoading: false })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Gestionar miembros de Offline' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los miembros')
    expect(screen.queryByRole('button', { name: 'Guardar miembros' })).not.toBeInTheDocument()
  })
})

describe('Resumen de tareas pendientes', () => {
  it('muestra la suma de tareas pendientes en cada tablero', () => {
    renderPage()
    const card = screen.getByRole('link', { name: 'Offline' }).closest('li') as HTMLElement
    expect(within(card).getByText('Tareas pendientes:')).toBeVisible()
    expect(within(card).getByText('3')).toBeVisible()
  })
})

describe('Ciclo de vida de los tableros', () => {
  it('separa los tableros desactivados y ofrece reactivarlos al administrador', () => {
    mocks.boards.mockReturnValue({ data: [board, archivedBoard], isLoading: false, error: null })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Tableros activos' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Tableros desactivados' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Archivo 2025' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Desactivar Offline' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Activar Archivo 2025' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Eliminar tablero Offline' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar tablero Archivo 2025' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Desactivar Archivo 2025' })).not.toBeInTheDocument()
  })
  it.each(['usuario', 'invitado'])('no muestra la sección de desactivados a %s', (role) => {
    mocks.role = role
    mocks.boards.mockReturnValue({ data: [board, archivedBoard], isLoading: false, error: null })
    renderPage()
    expect(screen.queryByRole('heading', { name: 'Tableros desactivados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Archivo 2025' })).not.toBeInTheDocument()
  })
  it('explica que no hay tableros activos cuando solo existen desactivados', () => {
    mocks.boards.mockReturnValue({ data: [archivedBoard], isLoading: false, error: null })
    renderPage()
    expect(screen.getByText('No hay tableros en esta sección.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Tableros desactivados' })).toBeVisible()
  })
  it('renombra un tablero con el nombre precargado', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cambiar nombre de Offline' }))
    const field = screen.getByLabelText('Nombre del tablero')
    expect(field).toHaveValue('Offline')
    await user.clear(field)
    await user.type(field, 'Marketing')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar nombre' }))
    expect(mocks.rename).toHaveBeenCalledWith({ boardId: 'offline', name: 'Marketing' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('conserva el borrador y explica el error si el nombre está duplicado', async () => {
    const user = userEvent.setup()
    mocks.rename.mockRejectedValueOnce({ code: '23505' })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cambiar nombre de Offline' }))
    const field = screen.getByLabelText('Nombre del tablero')
    await user.clear(field)
    await user.type(field, 'General')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar nombre' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un tablero')
    expect(screen.getByLabelText('Nombre del tablero')).toHaveValue('General')
  })
  it('desactiva un tablero confirmando la acción', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Desactivar Offline' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('dejarán de verlo')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar tablero' }))
    expect(mocks.setActive).toHaveBeenCalledWith({ boardId: 'offline', active: false })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('reactiva un tablero desactivado', async () => {
    const user = userEvent.setup()
    mocks.boards.mockReturnValue({ data: [board, archivedBoard], isLoading: false, error: null })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Activar Archivo 2025' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('recuperarán el acceso')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Activar tablero' }))
    expect(mocks.setActive).toHaveBeenCalledWith({ boardId: 'archived', active: true })
  })
  it('explica el rechazo del servidor al desactivar', async () => {
    const user = userEvent.setup()
    mocks.setActive.mockRejectedValueOnce({ code: '42501' })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Desactivar Offline' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar tablero' }))
    expect(screen.getByRole('alert')).toHaveTextContent('permisos')
  })
  it('advierte del borrado irreversible y cancelar no elimina el tablero', async () => {
    mocks.boards.mockReturnValue({ data: [board, archivedBoard], isLoading: false, error: null })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Eliminar tablero Archivo 2025' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('se eliminarán todas sus tareas, comentarios, asignaciones y archivos adjuntos')
    expect(dialog).toHaveTextContent('No será posible recuperar ni el tablero ni las tareas')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(mocks.deleteBoard).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('elimina un tablero desactivado solo después de confirmar en el diálogo', async () => {
    mocks.boards.mockReturnValue({ data: [board, archivedBoard], isLoading: false, error: null })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Eliminar tablero Archivo 2025' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar tablero' }))

    expect(mocks.deleteBoard).toHaveBeenCalledExactlyOnceWith('archived')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('mantiene abierto el diálogo y explica fallos en la limpieza de Storage', async () => {
    mocks.boards.mockReturnValue({ data: [board, archivedBoard], isLoading: false, error: null })
    mocks.deleteBoard.mockRejectedValueOnce({ code: 'BOARD_ATTACHMENTS_DELETE_FAILED' })
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Eliminar tablero Archivo 2025' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar tablero' }))

    expect(screen.getByRole('alert')).toHaveTextContent('El tablero y sus tareas siguen')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Acceso a ruta de tablero', () => {
  it('monta el tablero con identidad explícita cuando está disponible', () => {
    render(<MemoryRouter><BoardRoute /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Offline · offline' })).toBeVisible()
  })
  it('no monta tareas de un tablero inaccesible aunque se conozca su ruta', () => {
    mocks.boards.mockReturnValue({ data: [], error: null, isLoading: false })
    render(<MemoryRouter><BoardRoute /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('no tienes acceso')
    expect(screen.queryByRole('heading', { name: 'Offline · offline' })).not.toBeInTheDocument()
  })
})
