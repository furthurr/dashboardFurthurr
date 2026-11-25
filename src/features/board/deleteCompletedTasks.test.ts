import { expect, it, vi } from 'vitest'
import { deleteCompletedTasks } from './api'

const mocks = vi.hoisted(() => {
  const result = { count: 3, error: null as Error | null }
  const eq = vi.fn().mockReturnThis()
  return {
    result, eq,
    from: vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq, then: (resolve: (value: typeof result) => void) => resolve(result) }),
    }),
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))

it('borra en una operación limitada al tablero y al estado Finalizadas', async () => {
  expect(await deleteCompletedTasks('board-1')).toBe(3)
  expect(mocks.from).toHaveBeenCalledExactlyOnceWith('tasks')
  expect(mocks.from.mock.results[0].value.delete).toHaveBeenCalledExactlyOnceWith({ count: 'exact' })
  expect(mocks.eq.mock.calls).toEqual([['board_id', 'board-1'], ['status', 'finalizadas']])
})

it('propaga un rechazo del servidor', async () => {
  mocks.result.error = new Error('forbidden')
  await expect(deleteCompletedTasks('board-1')).rejects.toThrow('forbidden')
})
