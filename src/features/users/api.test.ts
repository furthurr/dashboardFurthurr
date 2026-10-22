import { beforeEach, expect, it, vi } from 'vitest'
import { adminRequest, listUsers } from './api'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))
beforeEach(() => vi.clearAllMocks())

it('invoca la función y conserva el contrato paginado', async () => {
  const data = { users: [], total: 0, pageSize: 50 }
  invoke.mockResolvedValue({ data, error: null })
  expect(await listUsers(2)).toEqual(data)
  expect(invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'list', page: 2 } })
})
it('muestra el error seguro de autorización de la función', async () => {
  invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 }) } })
  await expect(listUsers(1)).rejects.toThrow('Acceso denegado')
})
it('envía la acción de promoción con el identificador de la cuenta', async () => {
  invoke.mockResolvedValue({ data: { success: true }, error: null })
  await expect(adminRequest({ action: 'promote-admin', userId: 'user' })).resolves.toEqual({ success: true })
  expect(invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'promote-admin', userId: 'user' } })
})
it('maneja errores de conexión y respuestas no JSON', async () => {
  invoke.mockResolvedValue({ data: null, error: { context: new Response('Gateway unavailable', { status: 503 }) } })
  await expect(adminRequest({ action: 'set-active', userId: 'user', active: false })).rejects.toThrow('Comprueba la conexión')
})
