import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAssignableUsers } from './assigneesApi'
import { createTaskWithAssignees, fetchTasks, setTaskAssignees } from './api'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), profileRange: vi.fn(), profileOrder: vi.fn(), profileEq: vi.fn(),
  profileSelect: vi.fn(), taskSelect: vi.fn(), taskEq: vi.fn(), taskOrder: vi.fn(),
  statsSelect: vi.fn(), statsIn: vi.fn(), commentsSelect: vi.fn(), commentsIn: vi.fn(), commentsRange: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: table === 'tasks' ? mocks.taskSelect
        : table === 'tasks_with_stats' ? mocks.statsSelect
          : table === 'comments' ? mocks.commentsSelect
            : mocks.profileSelect,
    }),
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq })
  mocks.profileEq.mockReturnValue({ order: mocks.profileOrder })
  mocks.profileOrder.mockReturnValue({ order: mocks.profileOrder, range: mocks.profileRange })
  mocks.taskSelect.mockReturnValue({ eq: mocks.taskEq })
  mocks.taskEq.mockReturnValue({ order: mocks.taskOrder })
  mocks.taskOrder.mockResolvedValue({ data: [], error: null })
  mocks.statsSelect.mockReturnValue({ in: mocks.statsIn })
  mocks.statsIn.mockResolvedValue({ data: [], error: null })
  mocks.commentsSelect.mockReturnValue({ in: mocks.commentsIn })
  mocks.commentsIn.mockReturnValue({ range: mocks.commentsRange })
  mocks.commentsRange.mockResolvedValue({ data: [], error: null })
})

describe('API de asignaciones', () => {
  it('consulta todas las páginas de cuentas activas con orden estable', async () => {
    const users = Array.from({ length: 500 }, (_, index) => ({ id: `person-${index}` }))
    mocks.profileRange.mockResolvedValueOnce({ data: users, error: null }).mockResolvedValueOnce({ data: [{ id: 'last' }], error: null })
    expect(await fetchAssignableUsers()).toHaveLength(501)
    expect(mocks.profileEq).toHaveBeenCalledWith('is_active', true)
    expect(mocks.profileRange).toHaveBeenNthCalledWith(1, 0, 499)
    expect(mocks.profileRange).toHaveBeenNthCalledWith(2, 500, 999)
  })
  it('propaga errores de consulta sin devolver una lista vacía', async () => {
    mocks.profileRange.mockResolvedValue({ data: null, error: new Error('Fallo de consulta') })
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
    mocks.taskOrder.mockResolvedValueOnce({ data: [{ id: 'task', task_assignees: [{ profiles: { id: 'person', is_active: false } }, { profiles: null }] }], error: null })
    mocks.statsIn.mockResolvedValueOnce({ data: [{ id: 'task', comment_count: '3' }], error: null })
    const tasks = await fetchTasks('offline')
    expect(mocks.taskEq).toHaveBeenCalledWith('board_id', 'offline')
    expect(mocks.taskSelect).toHaveBeenCalledWith(expect.stringContaining('profiles(id, full_name, email, avatar_url, role, is_active)'))
    expect(mocks.statsSelect).toHaveBeenCalledWith('id, comment_count')
    expect(mocks.statsIn).toHaveBeenCalledWith('id', ['task'])
    expect(mocks.commentsSelect).not.toHaveBeenCalled()
    expect(tasks[0].assignees).toEqual([{ id: 'person', is_active: false }])
    expect(tasks[0].comment_count).toBe(3)
  })

  it('filtra la vista por IDs y usa comments si la vista falla por no exponer board_id', async () => {
    mocks.taskOrder.mockResolvedValueOnce({ data: [
      { id: 'task-1', task_assignees: [] },
      { id: 'task-2', task_assignees: [] },
    ], error: null })
    mocks.statsIn.mockResolvedValueOnce({ data: null, error: new Error('column board_id does not exist on tasks_with_stats') })
    mocks.commentsRange.mockResolvedValueOnce({ data: [
      { task_id: 'task-1' }, { task_id: 'task-1' }, { task_id: 'task-2' },
    ], error: null })

    const tasks = await fetchTasks('offline')

    expect(mocks.statsIn).toHaveBeenCalledWith('id', ['task-1', 'task-2'])
    expect(mocks.commentsIn).toHaveBeenCalledWith('task_id', ['task-1', 'task-2'])
    expect(mocks.commentsRange).toHaveBeenCalledWith(0, 999)
    expect(tasks.map((task) => task.comment_count)).toEqual([2, 1])
  })

  it('pagina el fallback de comentarios para contar todas las filas', async () => {
    mocks.taskOrder.mockResolvedValueOnce({ data: [{ id: 'task-1', task_assignees: [] }], error: null })
    mocks.statsIn.mockResolvedValueOnce({ data: null, error: new Error('Vista de estadísticas no disponible') })
    mocks.commentsRange
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ task_id: 'task-1' })), error: null })
      .mockResolvedValueOnce({ data: [{ task_id: 'task-1' }], error: null })

    const tasks = await fetchTasks('offline')

    expect(mocks.commentsRange).toHaveBeenNthCalledWith(1, 0, 999)
    expect(mocks.commentsRange).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(tasks[0].comment_count).toBe(1001)
  })

  it('mantiene las tareas disponibles si fallan tanto la vista como el fallback', async () => {
    mocks.taskOrder.mockResolvedValueOnce({ data: [{ id: 'task-1', task_assignees: [] }], error: null })
    mocks.statsIn.mockResolvedValueOnce({ data: null, error: new Error('Vista de estadísticas no disponible') })
    mocks.commentsRange.mockResolvedValueOnce({ data: null, error: new Error('Lectura de comentarios no disponible') })

    const tasks = await fetchTasks('offline')

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).not.toHaveProperty('comment_count')
  })
})
