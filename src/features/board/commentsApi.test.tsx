import type { PropsWithChildren } from 'react'
import { cleanup, renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateComment, useDeleteComment } from './commentsApi'

const mocks = vi.hoisted(() => {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
  }
  return { query, from: vi.fn() }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue(mocks.query)
  mocks.query.insert.mockReturnValue(mocks.query)
  mocks.query.select.mockReturnValue(mocks.query)
  mocks.query.single.mockResolvedValue({ data: { id: 'comment-1' }, error: null })
  mocks.query.delete.mockReturnValue(mocks.query)
  mocks.query.eq.mockResolvedValue({ error: null })
})

afterEach(cleanup)

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('caché de comentarios', () => {
  it('invalida los conteos de tareas al crear o eliminar comentarios', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    client.setQueryData(['tasks', 'board-1'], [])
    const wrapper = createWrapper(client)

    const createHook = renderHook(() => useCreateComment(), { wrapper })
    await act(async () => {
      await createHook.result.current.mutateAsync({ taskId: 'task-1', authorId: 'user-1', body: 'Comentario' })
    })
    expect(client.getQueryState(['tasks', 'board-1'])?.isInvalidated).toBe(true)
    createHook.unmount()

    client.setQueryData(['tasks', 'board-1'], [])
    const deleteHook = renderHook(() => useDeleteComment(), { wrapper })
    await act(async () => {
      await deleteHook.result.current.mutateAsync({ commentId: 'comment-1' })
    })
    expect(client.getQueryState(['tasks', 'board-1'])?.isInvalidated).toBe(true)

    client.clear()
  })
})
