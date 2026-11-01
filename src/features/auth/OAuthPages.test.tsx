import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { OAuthConsentPage } from './OAuthConsentPage'
import { OAuthConnectionsPage } from './OAuthConnectionsPage'
import { permissionLabels } from './mcpWorkflowAccess'

const id = '00000000-0000-0000-0000-000000000001'
const state = vi.hoisted(() => ({ user: { id: '00000000-0000-0000-0000-000000000001' } as { id: string } | null, profile: { is_active: true, email: 'person@example.test' }, isLoading: false }))
const oauth = vi.hoisted(() => ({ getAuthorizationDetails: vi.fn(), approveAuthorization: vi.fn(), denyAuthorization: vi.fn(), listGrants: vi.fn(), revokeGrant: vi.fn() }))
const redirect = vi.hoisted(() => vi.fn())
const rpc = vi.hoisted(() => vi.fn())
vi.mock('./mcpOAuth', async importOriginal => ({ ...await importOriginal<typeof import('./mcpOAuth')>(), redirectOAuthCallback: redirect }))
vi.mock('./AuthContext', () => ({ useAuth: () => state }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { oauth }, rpc } }))
const details = { authorization_id: id, user: { id, email: 'person@example.test' }, client: { id, name: 'Cliente de prueba' }, redirect_uri: 'http://localhost:3000/callback', scope: 'email profile' }
const callback = 'http://localhost:3000/callback?code=fixture&state=fixture'
beforeEach(() => {
  vi.resetAllMocks()
  state.user = { id }; state.profile.is_active = true; state.isLoading = false
  rpc.mockResolvedValue({ data: [], error: null })
  oauth.getAuthorizationDetails.mockResolvedValue({ data: details, error: null })
  oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  oauth.revokeGrant.mockResolvedValue({ error: null })
  oauth.listGrants.mockResolvedValue({ data: [{ client: { id, name: 'Cliente de prueba' }, scopes: ['email'] }], error: null })
})
function consent() {
  render(<MemoryRouter initialEntries={[`/oauth/consent?authorization_id=${id}`]}><Routes>
    <Route path="/oauth/consent" element={<OAuthConsentPage />} />
    <Route path="/login" element={<h1>Login pendiente</h1>} />
  </Routes></MemoryRouter>)
}
function connections() { render(<MemoryRouter><OAuthConnectionsPage /></MemoryRouter>) }
function autoapproved(authorized: boolean) {
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: callback }, error: null })
  rpc.mockResolvedValueOnce({ data: { authorized, details }, error: null })
}
it('sin sesión exige login y no consulta ni aprueba', async () => {
  state.user = null; consent()
  expect(await screen.findByRole('heading', { name: 'Login pendiente' })).toBeVisible()
  expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled()
})
it('una cuenta inactiva no puede autorizar', () => {
  state.profile.is_active = false; consent()
  expect(screen.getByRole('alert')).toHaveTextContent('perfil activo')
  expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled()
})
it('explica todo el conjunto y sus consecuencias antes de aceptar', async () => {
  consent()
  expect(await screen.findByText('Cliente de prueba')).toBeVisible()
  expect(screen.getByText(/Dirección de retorno/)).toHaveTextContent(details.redirect_uri)
  for (const label of Object.values(permissionLabels)) expect(screen.getByText(label)).toBeVisible()
  expect(screen.getByText(/El avance automático está incluido/)).toHaveTextContent('sin una nueva aceptación')
  expect(screen.getByText(/Nunca permite finalizar tareas/)).toHaveTextContent('conexión completa')
  expect(screen.getByText(/Los adjuntos y comentarios se compartirán/)).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Autorizar conexión' }))
  expect(rpc).toHaveBeenCalledWith('mcp_authorize_workflow', { p_authorization_id: id })
  expect(redirect).toHaveBeenCalledWith(callback)
})
it('permite denegar sin conceder permisos', async () => {
  const denied = 'http://localhost:3000/callback?error=access_denied'
  oauth.denyAuthorization.mockResolvedValue({ data: { redirect_url: denied }, error: null })
  consent()
  await userEvent.click(await screen.findByRole('button', { name: 'Denegar' }))
  expect(redirect).toHaveBeenCalledWith(denied)
  expect(rpc).not.toHaveBeenCalled()
})
it('una autoaprobación con consentimiento de aplicación vigente continúa sin nueva autorización', async () => {
  autoapproved(true); consent()
  await screen.findByRole('heading', { name: 'Conectar con Dashboard Furthurr' })
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalledWith('mcp_authorize_workflow', expect.anything())
})
it('una identidad autoaprobada sin consentimiento de aplicación debe aceptar el conjunto', async () => {
  autoapproved(false); consent()
  await screen.findByRole('button', { name: 'Autorizar conexión' })
  expect(redirect).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Continuar sin/ })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Autorizar conexión' }))
  expect(rpc).toHaveBeenCalledWith('mcp_authorize_workflow', { p_authorization_id: id })
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(oauth.approveAuthorization).not.toHaveBeenCalled()
})
it('denegar una identidad autoaprobada revoca la conexión y no entrega su código', async () => {
  autoapproved(false); consent()
  await userEvent.click(await screen.findByRole('button', { name: 'Denegar' }))
  expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: id })
  expect(redirect).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent('Conexión denegada')
})
it('si falla la revocación al denegar, no entrega el código y permite reintentar', async () => {
  autoapproved(false); oauth.revokeGrant.mockResolvedValue({ error: {} }); consent()
  await userEvent.click(await screen.findByRole('button', { name: 'Denegar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar')
  expect(redirect).not.toHaveBeenCalled()
  oauth.revokeGrant.mockResolvedValue({ error: null })
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Conexión denegada')
  expect(rpc).not.toHaveBeenCalledWith('mcp_authorize_workflow', expect.anything())
})
it('no continúa si falla el permiso conjunto y reintenta sin aprobar OAuth dos veces', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: {} }); consent()
  await userEvent.click(await screen.findByRole('button', { name: 'Autorizar conexión' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar')
  expect(redirect).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(redirect).toHaveBeenCalledWith(callback)
  expect(oauth.approveAuthorization).toHaveBeenCalledTimes(1)
})
it('rechaza datos de otra identidad', async () => {
  oauth.getAuthorizationDetails.mockResolvedValue({ data: { ...details, user: { id: 'other-user' } }, error: null })
  consent()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo recuperar')
  expect(screen.queryByRole('button', { name: 'Autorizar conexión' })).not.toBeInTheDocument()
})
it('muestra permisos efectivos y automatización sin controles individuales', async () => {
  rpc.mockResolvedValueOnce({ data: [{ client_id: id, permissions: Object.keys(permissionLabels), automatic_advance: true }], error: null })
  connections()
  expect(await screen.findByText('Avance automático: Incluido')).toBeVisible()
  for (const label of Object.values(permissionLabels)) expect(screen.getByText(`${label}: Autorizado`)).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Retirar/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Revocar conexión de Cliente de prueba' }))
  expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: id })
  expect(await screen.findByText('No tienes conexiones autorizadas.')).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Conexión revocada')
})
it('una identidad sin consentimiento no aparece con permisos efectivos', async () => {
  connections()
  expect(await screen.findByText('Avance automático: No autorizado')).toBeVisible()
  expect(screen.getByText('Iniciar tareas en Haciendo: No autorizado')).toBeVisible()
})
it('permite revocar aunque falle la comprobación de permisos', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } }); connections()
  expect(await screen.findByRole('alert')).toHaveTextContent('Puede faltar la migración')
  expect(screen.getByText('Permisos de tareas: Sin verificar')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Revocar conexión de Cliente de prueba' })).toBeEnabled()
})
it('no declara revocación exitosa si falla', async () => {
  oauth.revokeGrant.mockResolvedValue({ error: {} }); connections()
  await userEvent.click(await screen.findByRole('button', { name: 'Revocar conexión de Cliente de prueba' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo revocar')
  expect(screen.getByRole('heading', { name: 'Cliente de prueba' })).toBeVisible()
})
it('informa cuando OAuth no está disponible y permite reintentar', async () => {
  oauth.listGrants.mockResolvedValue({ data: null, error: {} }); connections()
  expect(await screen.findByRole('alert')).toHaveTextContent('OAuth esté habilitado')
  oauth.listGrants.mockResolvedValue({ data: [], error: null })
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('No tienes conexiones autorizadas.')).toBeVisible()
})
