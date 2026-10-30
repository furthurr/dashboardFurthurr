import { beforeEach, expect, it, vi } from 'vitest'
import { getTaskAutomation, setTaskAutomation, setConnectionAutomation } from './mcpAutomation'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
beforeEach(() => vi.resetAllMocks())
it('consulta el estado con contrato booleano y no interpreta ausencia como autorización', async () => {
  for (const value of [true, false]) {
    rpc.mockResolvedValueOnce({ data: value, error: null })
    expect(await getTaskAutomation('task')).toBe(value)
  }
  for (const value of [null, {}, 'true']) {
    rpc.mockResolvedValueOnce({ data: value, error: null })
    await expect(getTaskAutomation('task')).rejects.toThrow('No se pudo consultar')
  }
  expect(rpc).toHaveBeenCalledWith('mcp_get_task_automation', { p_task_id: 'task' })
})
it('habilitación y retirada usan RPC independientes y no silencian errores', async () => {
  for (const enabled of [true, false]) {
    rpc.mockResolvedValueOnce({ error: null })
    await setTaskAutomation('task', enabled)
    expect(rpc).toHaveBeenLastCalledWith('mcp_set_task_automation', { p_task_id: 'task', p_enabled: enabled })
    rpc.mockResolvedValueOnce({ error: null })
    await setConnectionAutomation('client', enabled)
    expect(rpc).toHaveBeenLastCalledWith('mcp_set_automation_consent', { p_client_id: 'client', p_enabled: enabled })
  }
  rpc.mockResolvedValue({ error: { message: 'private' } })
  await expect(setTaskAutomation('task', true)).rejects.toThrow('No se pudo guardar')
  await expect(setConnectionAutomation('client', true)).rejects.toThrow('No se pudo guardar')
  await expect(getTaskAutomation('task')).rejects.toThrow('No se pudo consultar')
})
