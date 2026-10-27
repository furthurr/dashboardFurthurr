import { beforeEach, expect, it, vi } from 'vitest'
import { adminRequest, listUsers } from './api'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn(), select: vi.fn(), in: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: mocks.invoke }, from: mocks.from } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ in: mocks.in })
  mocks.in.mockResolvedValue({ data: [], error: null })
})

it('invoca la función y conserva el contrato paginado', async () => {
  const data = { users: [], total: 0, pageSize: 50 }
  mocks.invoke.mockResolvedValue({ data, error: null })
  expect(await listUsers(2)).toEqual(data)
  expect(mocks.invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'list', page: 2 } })
})
it('recupera avatar_url desde profiles si la función de administración desplegada lo omite', async () => {
  mocks.invoke.mockResolvedValue({
    data: { users: [{ id: 'person', full_name: 'Ana', email: 'ana@example.test', role: 'usuario', is_active: true }], total: 1, pageSize: 50 },
    error: null,
  })
  mocks.in.mockResolvedValue({ data: [{ id: 'person', avatar_url: 'https://example.test/ana.png' }], error: null })

  await expect(listUsers(1)).resolves.toEqual({
    users: [{ id: 'person', full_name: 'Ana', email: 'ana@example.test', avatar_url: 'https://example.test/ana.png', role: 'usuario', is_active: true }],
    total: 1,
    pageSize: 50,
  })
  expect(mocks.from).toHaveBeenCalledWith('profiles')
  expect(mocks.select).toHaveBeenCalledWith('id, avatar_url')
  expect(mocks.in).toHaveBeenCalledWith('id', ['person'])
})
it('muestra el error seguro de autorización de la función', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 }) } })
  await expect(listUsers(1)).rejects.toThrow('Acceso denegado')
})
it('envía la acción de promoción con el identificador de la cuenta', async () => {
  mocks.invoke.mockResolvedValue({ data: { success: true }, error: null })
  await expect(adminRequest({ action: 'promote-admin', userId: 'user' })).resolves.toEqual({ success: true })
  expect(mocks.invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'promote-admin', userId: 'user' } })
})
it('maneja errores de conexión y respuestas no JSON', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: { context: new Response('Gateway unavailable', { status: 503 }) } })
  await expect(adminRequest({ action: 'set-active', userId: 'user', active: false })).rejects.toThrow('Comprueba la conexión')
})
