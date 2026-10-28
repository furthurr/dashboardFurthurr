import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { OAuthConsentPage } from './OAuthConsentPage'
import { OAuthConnectionsPage } from './OAuthConnectionsPage'

const id = '00000000-0000-0000-0000-000000000001'
const state = vi.hoisted(() => ({ user: { id: 'fixture-user' } as { id: string } | null, profile: { is_active: true, email: 'person@example.test' }, isLoading: false }))
const oauth = vi.hoisted(() => ({ getAuthorizationDetails: vi.fn(), approveAuthorization: vi.fn(), denyAuthorization: vi.fn(), listGrants: vi.fn(), revokeGrant: vi.fn() }))
const redirect = vi.hoisted(() => vi.fn())
vi.mock('./mcpOAuth', async importOriginal => ({ ...await importOriginal<typeof import('./mcpOAuth')>(), redirectOAuthCallback: redirect }))
vi.mock('./AuthContext', () => ({ useAuth: () => state }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { oauth } } }))
beforeEach(() => {
  vi.resetAllMocks()
  state.user = { id: 'fixture-user' }; state.profile.is_active = true; state.isLoading = false
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
  expect(screen.getByText(/No permite consultar ni modificar/)).toBeVisible()
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
