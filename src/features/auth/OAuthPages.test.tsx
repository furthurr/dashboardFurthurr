import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { OAuthConsentPage } from './OAuthConsentPage'
import { OAuthConnectionsPage } from './OAuthConnectionsPage'

const id = '00000000-0000-0000-0000-000000000001'
const state = vi.hoisted(() => ({ user: { id: '00000000-0000-0000-0000-000000000001' } as { id: string } | null, profile: { is_active: true, email: 'person@example.test' }, isLoading: false }))
const oauth = vi.hoisted(() => ({ getAuthorizationDetails: vi.fn(), approveAuthorization: vi.fn(), denyAuthorization: vi.fn(), listGrants: vi.fn(), revokeGrant: vi.fn() }))
const redirect = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
vi.mock('./mcpOAuth', async importOriginal => ({ ...await importOriginal<typeof import('./mcpOAuth')>(), redirectOAuthCallback: redirect }))
vi.mock('./AuthContext', () => ({ useAuth: () => state }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { oauth }, rpc } }))
beforeEach(() => {
  vi.resetAllMocks()
  state.user = { id }; state.profile.is_active = true; state.isLoading = false
  rpc.mockResolvedValue({ data: [], error: null })
})
function consent() {
  render(<MemoryRouter initialEntries={[`/oauth/consent?authorization_id=${id}`]}><Routes>
    <Route path="/oauth/consent" element={<OAuthConsentPage />} />
    <Route path="/login" element={<h1>Login pendiente</h1>} />
  </Routes></MemoryRouter>)
}
const details = { authorization_id: id, user: { id, email: 'person@example.test' }, client: { id, name: 'Cliente de prueba' }, redirect_uri: 'http://localhost:3000/callback', scope: 'email profile' }
it('conexión antigua no recibe automatización y habilitar/retirar requiere acciones independientes', async () => {
  const permissions = ['read_tasks','start_task','comment_task','review_task']
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente' }, scopes: [] }], error: null })
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions }], error: null })
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ data: [{ client_id: id, permissions, automatic_advance: true }], error: null })
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ data: [{ client_id: id, permissions, automatic_advance: false }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  const box = await screen.findByRole('checkbox', { name: 'Avance automático de Cliente' })
  expect(box).not.toBeChecked()
  expect(rpc).not.toHaveBeenCalledWith('mcp_set_automation_consent', expect.anything())
  await userEvent.click(box)
  expect(rpc).toHaveBeenCalledWith('mcp_set_automation_consent', { p_client_id: id, p_enabled: true })
  expect(await screen.findByText(/Avance automático autorizado/)).toBeVisible()
  expect(box).toBeChecked()
  await userEvent.click(box)
  expect(rpc).toHaveBeenCalledWith('mcp_set_automation_consent', { p_client_id: id, p_enabled: false })
  expect(await screen.findByText('Autorización de avance automático retirada.')).toBeVisible()
  expect(box).not.toBeChecked()
})
it('no habilita automatización sin workflow y muestra error si no puede confirmar el cambio', async () => {
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente' }, scopes: [] }], error: null })
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions: ['read_tasks'] }], error: null })
  const view = render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  expect(await screen.findByRole('checkbox')).toBeDisabled()
  view.unmount()
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions: ['read_tasks','start_task','comment_task','review_task'] }], error: null })
    .mockResolvedValueOnce({ error: { code: '42501' } })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  await userEvent.click(await screen.findByRole('checkbox'))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar la autorización automática')
  expect(screen.getByRole('checkbox')).toBeDisabled()
})
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
  expect(screen.getByText(/sin pasos adicionales en tu perfil/)).toBeVisible()
  expect(screen.getByText('Publicar comentarios de trabajo')).toBeVisible()
  expect(screen.getByText(/Nunca permite finalizar tareas/)).toBeVisible()
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
  if (approve) expect(rpc).toHaveBeenCalledWith('mcp_authorize_workflow', { p_authorization_id: id })
  else expect(rpc).not.toHaveBeenCalled()
})
it('continúa una concesión ya aprobada sin inventar un callback', async () => {
  const callback = 'http://localhost:3000/callback?code=fixture&state=fixture'
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  rpc.mockResolvedValueOnce({ data: { authorized: true, details }, error: null })
  consent()
  await screen.findByRole('heading', { name: 'Conectar con Dashboard Furthurr' })
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
})
it('OAuth autoaprobado no amplía conexiones antiguas sin mostrar y aceptar los nuevos permisos', async () => {
  const callback = 'http://localhost:3000/callback?code=fixture&state=fixture'
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  rpc.mockResolvedValueOnce({ data: { authorized: false, details }, error: null })
  consent()
  await screen.findByRole('button', { name: 'Continuar sin ampliar permisos' })
  expect(redirect).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalledWith('mcp_authorize_workflow', expect.anything())
  await userEvent.click(screen.getByRole('button', { name: 'Autorizar conexión' }))
  expect(rpc).toHaveBeenCalledWith('mcp_authorize_workflow', { p_authorization_id: id })
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
})
it('permite continuar con la identidad ya aprobada sin conceder permisos adicionales', async () => {
  const callback = 'http://localhost:3000/callback?code=fixture&state=fixture'
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  rpc.mockResolvedValueOnce({ data: { authorized: false, details }, error: null })
  consent()
  await userEvent.click(await screen.findByRole('button', { name: 'Continuar sin ampliar permisos' }))
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(rpc).not.toHaveBeenCalledWith('mcp_authorize_workflow', expect.anything())
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

it('muestra los permisos concedidos al conectar y permite retirarlos sin revocar OAuth', async () => {
  const user = userEvent.setup()
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: ['email'], granted_at: '' }], error: null })
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions: ['read_tasks', 'read_attachments', 'start_task', 'comment_task', 'review_task'] }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  expect(await screen.findByText('Publicar comentarios de trabajo: Autorizado')).toBeVisible()
  expect(screen.getAllByRole('button', { name: /^Retirar permiso:/ })).toHaveLength(5)
  await user.click(screen.getByRole('button', { name: 'Retirar permiso: Publicar comentarios de trabajo de Cliente de prueba' }))
  expect(rpc).toHaveBeenCalledWith('mcp_revoke_workflow_permission', { p_client_id: id, p_permission: 'comment_task' })
  expect(await screen.findByText('Publicar comentarios de trabajo: No autorizado')).toBeVisible()
  expect(oauth.revokeGrant).not.toHaveBeenCalled()
})

it('no continúa al cliente si falla el permiso conjunto y permite reintentarlo sin aprobar dos veces', async () => {
  const user = userEvent.setup()
  oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null })
  oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: 'https://example.test/callback?code=fixture' }, error: null })
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'internal' } })
  consent()
  await user.click(await screen.findByRole('button', { name: 'Autorizar conexión' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar')
  expect(redirect).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(redirect).toHaveBeenCalledWith('https://example.test/callback?code=fixture')
  expect(oauth.approveAuthorization).toHaveBeenCalledTimes(1)
})

it('mantiene disponible la revocación OAuth aunque falte la migración de lectura', async () => {
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: [], granted_at: '' }], error: null })
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Puede faltar la migración')
  expect(screen.getByText('Permisos de tareas: Sin verificar')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Revocar conexión de Cliente de prueba' })).toBeEnabled()
})

it('permite retirar todos los permisos y no ofrece habilitarlos desde el perfil', async () => {
  const user = userEvent.setup()
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: [], granted_at: '' }], error: null })
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions: ['read_tasks'] }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'Retirar todos los permisos de tareas' }))
  expect(rpc).toHaveBeenCalledWith('mcp_revoke_workflow_permission', { p_client_id: id, p_permission: 'all' })
  expect(await screen.findByRole('status')).toHaveTextContent('Permisos retirados')
  expect(screen.queryByRole('button', { name: /Autorizar/ })).not.toBeInTheDocument()
  expect(oauth.revokeGrant).not.toHaveBeenCalled()
})

it('no declara retirada verificada si falla y conserva la revocación de conexión', async () => {
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: [], granted_at: '' }], error: null })
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions: ['start_task'] }], error: null })
  render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>)
  await screen.findByText('Iniciar tareas en Haciendo: Autorizado')
  rpc.mockResolvedValueOnce({ data: null, error: {} })
  await userEvent.click(screen.getByRole('button', { name: 'Retirar todos los permisos de tareas' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(screen.queryByText('Permisos retirados.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revocar conexión de Cliente de prueba' })).toBeEnabled()
})
