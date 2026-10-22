import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardsPage } from './BoardsPage'
import { BoardRoute } from './BoardRoute'

const mocks = vi.hoisted(() => ({
  role: 'admin', boards: vi.fn(), members: vi.fn(), users: vi.fn(), create: vi.fn(), save: vi.fn(),
  createError: null as unknown, saveError: null as unknown, boardId: 'offline',
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ profile: { role: mocks.role }, signOut: vi.fn() }) }))
vi.mock('./api', () => ({
  useBoards: mocks.boards, useBoardMembers: mocks.members,
  useCreateBoard: () => ({ mutateAsync: mocks.create, isPending: false, error: mocks.createError }),
  useSetBoardMembers: () => ({ mutateAsync: mocks.save, isPending: false, error: mocks.saveError }),
}))
vi.mock('@/features/board/assigneesApi', () => ({ useAssignableUsers: mocks.users }))
vi.mock('@/features/board/BoardPage', () => ({ BoardPage: ({ boardId, boardName }: { boardId: string; boardName: string }) => <h1>{boardName} · {boardId}</h1> }))
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useParams: () => ({ boardId: mocks.boardId }) }))

const board = { id: 'offline', name: 'Offline', created_at: '2026-10-21' }
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
  mocks.saveError = null
})

describe('Selección y gestión de tableros', () => {
  it('muestra cards con enlace al tablero y gestión solo para administradores', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Offline' })).toHaveAttribute('href', '/board/offline')
    expect(screen.getByRole('button', { name: 'Crear tablero' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Gestionar miembros de Offline' })).toBeVisible()
  })
  it.each(['usuario', 'invitado'])('no ofrece creación ni gestión a %s', (role) => {
    mocks.role = role
    renderPage()
    expect(screen.queryByRole('button', { name: 'Crear tablero' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gestionar miembros/ })).not.toBeInTheDocument()
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
