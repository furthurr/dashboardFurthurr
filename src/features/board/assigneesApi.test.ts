import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAssignableUsers } from './assigneesApi'
import { createTaskWithAssignees, fetchTasks, setTaskAssignees } from './api'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), range: vi.fn(), order: vi.fn(),
  profileSelect: vi.fn(), profileEq: vi.fn(),
  taskSelect: vi.fn(), taskEq: vi.fn(), statsSelect: vi.fn(), statsEq: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: table === 'tasks' ? mocks.taskSelect : table === 'tasks_with_stats' ? mocks.statsSelect : mocks.profileSelect,
    }),
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq })
  mocks.profileEq.mockReturnValue({ order: mocks.order })
  mocks.taskSelect.mockReturnValue({ eq: mocks.taskEq })
  mocks.taskEq.mockReturnValue({ order: mocks.order })
  mocks.statsSelect.mockReturnValue({ eq: mocks.statsEq })
  mocks.order.mockReturnValue({ order: mocks.order, range: mocks.range })
})

describe('API de asignaciones', () => {
  it('consulta todas las páginas de cuentas activas con orden estable', async () => {
    const users = Array.from({ length: 500 }, (_, index) => ({ id: `person-${index}` }))
    mocks.range.mockResolvedValueOnce({ data: users, error: null }).mockResolvedValueOnce({ data: [{ id: 'last' }], error: null })
    expect(await fetchAssignableUsers()).toHaveLength(501)
    expect(mocks.profileEq).toHaveBeenCalledWith('is_active', true)
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499)
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999)
  })
  it('propaga errores de consulta sin devolver una lista vacía', async () => {
    mocks.range.mockResolvedValue({ data: null, error: new Error('Fallo de consulta') })
    await expect(fetchAssignableUsers()).rejects.toThrow('Fallo de consulta')
  })
  it('crea tarea y asignaciones mediante una sola llamada sin propietario enviado por el cliente', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'task' }, error: null })
    expect(await createTaskWithAssignees({ boardId: 'offline', title: 'Nueva', status: 'backlog', priority: 'normal', assigneeIds: ['a', 'b', 'a'] })).toEqual({ id: 'task' })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('create_task_with_assignees', {
      p_board_id: 'offline', p_title: 'Nueva', p_description: null, p_status: 'backlog', p_priority: 'normal', p_assignee_ids: ['a', 'b'],
    })
  })
  it('permite vaciar responsables y propaga fallos de la transacción', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: new Error('Transacción rechazada') })
    expect(await setTaskAssignees('task', [])).toEqual([])
    expect(mocks.rpc).toHaveBeenCalledWith('set_task_assignees', { p_task_id: 'task', p_assignee_ids: [] })
    await expect(setTaskAssignees('task', ['a'])).rejects.toThrow('Transacción rechazada')
  })
  it('recupera responsables, descarta relaciones nulas y asocia el conteo de comentarios', async () => {
    mocks.order.mockResolvedValueOnce({ data: [{ id: 'task', task_assignees: [{ profiles: { id: 'person', is_active: false } }, { profiles: null }] }], error: null })
    mocks.statsEq.mockResolvedValueOnce({ data: [{ id: 'task', comment_count: '3' }], error: null })
    const tasks = await fetchTasks('offline')
    expect(mocks.taskEq).toHaveBeenCalledWith('board_id', 'offline')
    expect(mocks.taskSelect).toHaveBeenCalledWith(expect.stringContaining('profiles(id, full_name, email, avatar_url, role, is_active)'))
    expect(mocks.statsSelect).toHaveBeenCalledWith('id, comment_count')
    expect(mocks.statsEq).toHaveBeenCalledWith('board_id', 'offline')
    expect(tasks[0].assignees).toEqual([{ id: 'person', is_active: false }])
    expect(tasks[0].comment_count).toBe(3)
  })
})
