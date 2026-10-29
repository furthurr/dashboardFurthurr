import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { OAuthConsentPage } from './OAuthConsentPage'
import { OAuthConnectionsPage } from './OAuthConnectionsPage'

const id = '00000000-0000-0000-0000-000000000001'
const state = vi.hoisted(() => ({ user: { id: 'fixture-user' } as { id: string } | null, profile: { is_active: true, email: 'person@example.test' }, isLoading: false }))
const oauth = vi.hoisted(() => ({ getAuthorizationDetails: vi.fn(), approveAuthorization: vi.fn(), denyAuthorization: vi.fn(), listGrants: vi.fn(), revokeGrant: vi.fn() }))
const redirect = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
vi.mock('./mcpOAuth', async importOriginal => ({ ...await importOriginal<typeof import('./mcpOAuth')>(), redirectOAuthCallback: redirect }))
vi.mock('./AuthContext', () => ({ useAuth: () => state }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { oauth }, rpc } }))
beforeEach(() => {
  vi.resetAllMocks()
  state.user = { id: 'fixture-user' }; state.profile.is_active = true; state.isLoading = false
  rpc.mockResolvedValue({ data: [], error: null })
})
function consent() {
  render(<MemoryRouter initialEntries={[`/oauth/consent?authorization_id=${id}`]}><Routes>
    <Route path="/oauth/consent" element={<OAuthConsentPage />} />
    <Route path="/login" element={<h1>Login pendiente</h1>} />
  </Routes></MemoryRouter>)
}
const details = { authorization_id: id, user: { id: 'fixture-user' }, client: { id, name: 'Cliente de prueba' }, redirect_uri: 'http://localhost:3000/callback', scope: 'email profile' }
it('sin sesión exige login y no consulta ni aprueba la solicitud', async () => {
  state.user = null
  consent()
  expect(await screen.findByRole('heading', { name: 'Login pendiente' })).toBeVisible()
  expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled()
})
it('una cuenta inactiva no puede autorizar', () => {
  state.profile.is_active = false
  consent()
  expect(screen.getByRole('alert')).toHaveTextContent('perfil activo')
  expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled()
})
it('muestra cliente, callback, alcance y requiere una decisión explícita', async () => {
  oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null })
  oauth.approveAuthorization.mockResolvedValue({ data: null, error: {} })
  consent()
  expect(await screen.findByText('Cliente de prueba')).toBeVisible()
  expect(screen.getByText(/Dirección de retorno/)).toHaveTextContent('http://localhost:3000/callback')
  expect(screen.getByText(/sin una autorización adicional/)).toBeVisible()
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Autorizar conexión' }))
  expect(oauth.approveAuthorization).toHaveBeenCalledWith(id, { skipBrowserRedirect: true })
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar')
})
it('permite denegar y recuperarse de un error sin aprobar', async () => {
  oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null })
  oauth.denyAuthorization.mockRejectedValue(new Error('internal'))
  consent()
  await userEvent.click(await screen.findByRole('button', { name: 'Denegar' }))
  expect(oauth.denyAuthorization).toHaveBeenCalledWith(id, { skipBrowserRedirect: true })
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).not.toHaveTextContent('internal')
})
it.each([true, false])('tras decidir (%s), vuelve al callback emitido por Auth', async approve => {
  oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null })
  const callback = `http://localhost:3000/callback?${approve ? 'code=fixture' : 'error=access_denied'}&state=fixture`
  const method = approve ? oauth.approveAuthorization : oauth.denyAuthorization
  method.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  consent()
  await userEvent.click(await screen.findByRole('button', { name: approve ? 'Autorizar conexión' : 'Denegar' }))
  expect(redirect).toHaveBeenCalledWith(callback)
})
it('continúa una concesión ya aprobada sin inventar un callback', async () => {
  const callback = 'http://localhost:3000/callback?code=fixture&state=fixture'
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  consent()
  await screen.findByRole('heading', { name: 'Conectar con Dashboard Furthurr' })
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
})
it('rechaza solicitudes caducadas y datos de otra identidad', async () => {
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { ...details, user: { id: 'other-user' } }, error: null })
  consent()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo recuperar')
  expect(screen.queryByRole('button', { name: 'Autorizar conexión' })).not.toBeInTheDocument()
})
it('lista conexiones y permite revocarlas', async () => {
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: ['email'], granted_at: '' }], error: null })
  oauth.revokeGrant.mockResolvedValue({ error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: 'Revocar conexión de Cliente de prueba' }))
  expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: id })
  expect(await screen.findByText('No tienes conexiones autorizadas.')).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Conexión revocada')
})
it('informa cuando OAuth no está disponible y ofrece reintentar', async () => {
  oauth.listGrants.mockResolvedValue({ data: null, error: {} })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('OAuth esté habilitado')
  oauth.listGrants.mockResolvedValue({ data: [], error: null })
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('No tienes conexiones autorizadas.')).toBeVisible()
})

it('no amplía conexiones existentes y exige confirmar la lectura; permite retirarla sin revocar OAuth', async () => {
  const user = userEvent.setup()
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: ['email'], granted_at: '' }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  const enable = await screen.findByRole('button', { name: 'Autorizar lectura de tareas' })
  expect(await screen.findByText('Lectura de tareas: Requiere autorización')).toBeVisible()
  expect(rpc).toHaveBeenCalledWith('mcp_list_task_read_access')
  expect(rpc).not.toHaveBeenCalledWith('mcp_set_task_read_access', expect.anything())
  await user.click(enable)
  const dialog = screen.getByRole('dialog', { name: 'Autorizar lectura de tareas' })
  expect(within(dialog).getByText(/enlaces de descarga/)).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Confirmar autorización de lectura' }))
  expect(rpc).toHaveBeenLastCalledWith('mcp_set_task_read_access', { p_client_id: id, p_enabled: true })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('Lectura de tareas: Autorizada en las sesiones actuales')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Retirar lectura de tareas' }))
  expect(rpc).toHaveBeenLastCalledWith('mcp_set_task_read_access', { p_client_id: id, p_enabled: false })
  expect(oauth.revokeGrant).not.toHaveBeenCalled()
  expect(screen.getByText('Lectura de tareas: Requiere autorización')).toBeVisible()
})

it('mantiene la confirmación y no declara éxito si falla la autorización adicional', async () => {
  const user = userEvent.setup()
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: [], granted_at: '' }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  await screen.findByText('Lectura de tareas: Requiere autorización')
  await user.click(screen.getByRole('button', { name: 'Autorizar lectura de tareas' }))
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'internal' } })
  await user.click(screen.getByRole('button', { name: 'Confirmar autorización de lectura' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cambiar el permiso')
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(screen.queryByText(/Lectura de tareas autorizada para/)).not.toBeInTheDocument()
})

it('mantiene disponible la revocación OAuth aunque falte la migración de lectura', async () => {
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: [], granted_at: '' }], error: null })
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Puede faltar la migración')
  expect(screen.getByRole('button', { name: 'Autorizar lectura de tareas' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Revocar conexión de Cliente de prueba' })).toBeEnabled()
})

it('permite retirar permisos parciales y autorizar sesiones nuevas solo tras otra confirmación', async () => {
  const user = userEvent.setup()
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: [], granted_at: '' }], error: null })
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, enabled: true, needs_authorization: true }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'Retirar lectura de tareas' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Autorizar nuevas sesiones' }))
  expect(rpc).not.toHaveBeenCalledWith('mcp_set_task_read_access', expect.anything())
  await user.click(screen.getByRole('button', { name: 'Confirmar autorización de lectura' }))
  expect(rpc).toHaveBeenLastCalledWith('mcp_set_task_read_access', { p_client_id: id, p_enabled: true })
  expect(screen.queryByRole('button', { name: 'Autorizar nuevas sesiones' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retirar lectura de tareas' })).toBeEnabled()
})
