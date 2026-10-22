import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchBoardMembers, fetchBoards, moveTaskToBoard } from './api'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), order: vi.fn(), select: vi.fn(), from: vi.fn(), eq: vi.fn(), range: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))
beforeEach(() => {
  vi.clearAllMocks()
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
  it('consulta los tableros accesibles sin construir filtros de membresía inseguros en cliente', async () => {
    mocks.order.mockResolvedValue({ data: [{ id: 'board', name: 'Offline' }], error: null })
    expect(await fetchBoards()).toEqual([{ id: 'board', name: 'Offline' }])
    expect(mocks.from).toHaveBeenCalledWith('boards')
    expect(mocks.order).toHaveBeenCalledWith('name')
  })
  it('propaga el fallo del catálogo sin confundirlo con ausencia de tableros', async () => {
    mocks.order.mockResolvedValue({ data: null, error: new Error('Fallo catálogo') })
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
})
