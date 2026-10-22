import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchBoardMembers, fetchBoards, moveTaskToBoard, renameBoard, setBoardActive } from './api'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), order: vi.fn(), select: vi.fn(), from: vi.fn(), eq: vi.fn(), range: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockReset()
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ order: mocks.order, eq: mocks.eq })
  mocks.eq.mockReturnValue({ order: mocks.order })
})
describe('Contratos de tableros', () => {
  it('carga todas las membresías antes de permitir reemplazar la lista', async () => {
    mocks.order.mockReturnValue({ range: mocks.range })
    mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ profiles: { id: String(id) } })), error: null })
      .mockResolvedValueOnce({ data: [{ profiles: { id: 'last' } }], error: null })
    expect(await fetchBoardMembers('board')).toHaveLength(501)
    expect(mocks.eq).toHaveBeenCalledWith('board_id', 'board')
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499)
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999)
  })
  it('consulta los tableros accesibles con el conteo de pendientes sin filtrar membresías en cliente', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: 'board', name: 'Offline', is_active: true, pending_count: 4, created_at: '2026-10-21' }], error: null })
    expect(await fetchBoards()).toEqual([{ id: 'board', name: 'Offline', is_active: true, pending_count: 4, created_at: '2026-10-21' }])
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('list_boards_with_pending_counts')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('normaliza el estado y el conteo devueltos por el servidor', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: 'board', name: 'Archivo', is_active: false, pending_count: '7', created_at: '2026-10-21' }], error: null })
    expect(await fetchBoards()).toEqual([{ id: 'board', name: 'Archivo', is_active: false, pending_count: 7, created_at: '2026-10-21' }])
  })
  it('propaga el fallo del catálogo sin confundirlo con ausencia de tableros', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('Fallo catálogo') })
    await expect(fetchBoards()).rejects.toThrow('Fallo catálogo')
  })
  it('traslada de forma atómica por RPC sin insertar otra tarea', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    await moveTaskToBoard('task', 'target')
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('move_task_to_board', { p_task_id: 'task', p_board_id: 'target' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('no confirma un traslado cuando el servidor lo rechaza', async () => {
    mocks.rpc.mockResolvedValue({ error: new Error('Acceso denegado') })
    await expect(moveTaskToBoard('task', 'target')).rejects.toThrow('Acceso denegado')
  })
  it('renombra y activa tableros por RPC sin escribir la tabla directamente', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    await renameBoard('board', '  Marketing  ')
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'rename_board', { p_board_id: 'board', p_name: 'Marketing' })
    await setBoardActive('board', false)
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'set_board_active', { p_board_id: 'board', p_active: false })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('no confirma el cambio de estado cuando el servidor lo rechaza', async () => {
    mocks.rpc.mockResolvedValue({ error: new Error('Acceso denegado') })
    await expect(setBoardActive('board', false)).rejects.toThrow('Acceso denegado')
  })
})
