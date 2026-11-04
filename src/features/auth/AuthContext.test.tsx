import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), single: vi.fn(), unsubscribe: vi.fn(), update: vi.fn(), updateSingle: vi.fn(),
  listener: undefined as undefined | ((event: string, session: unknown) => void),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {
  auth: {
    getSession: mock.getSession,
    onAuthStateChange: (listener: typeof mock.listener) => { mock.listener = listener; return { data: { subscription: { unsubscribe: mock.unsubscribe } } } },
    signOut: vi.fn(),
  },
  from: () => ({ select: () => ({ eq: () => ({ single: mock.single }) }), update: mock.update }),
} }))

function Probe() {
  const { profile, isLoading, setTheme } = useAuth()
  return <><p>{isLoading ? 'Cargando' : profile ? `${profile.id}:${profile.is_active}` : 'Sin perfil'}</p><button onClick={() => { void setTheme('light').catch(() => {}) }}>Claro</button></>
}
function setup() {
  const client = new QueryClient()
  render(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>)
  return client
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.getSession.mockResolvedValue({ data: { session: { user: { id: 'first' } } } })
  mock.single.mockResolvedValue({ data: { id: 'first', is_active: true }, error: null })
  mock.update.mockReturnValue({ eq: () => ({ select: () => ({ single: mock.updateSingle }) }) })
  mock.updateSingle.mockResolvedValue({ data: { id: 'first' }, error: null })
})
afterEach(() => vi.useRealTimers())

it('revalida al recuperar el foco y elimina datos cacheados al desactivar', async () => {
  const client = setup()
  await screen.findByText('first:true')
  client.setQueryData(['tasks'], ['private'])
  mock.single.mockResolvedValue({ data: { id: 'first', is_active: false }, error: null })
  act(() => window.dispatchEvent(new Event('focus')))
  await screen.findByText('first:false')
  expect(client.getQueryData(['tasks'])).toBeUndefined()
})
it('no restaura un perfil de la sesión anterior si termina tarde', async () => {
  let resolve!: (data: unknown) => void
  mock.single.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const client = setup()
  await waitFor(() => expect(mock.single).toHaveBeenCalledTimes(1))
  client.setQueryData(['admin-users'], ['private'])
  await act(async () => mock.listener?.('SIGNED_OUT', null))
  await act(async () => resolve({ data: { id: 'first', is_active: true }, error: null }))
  expect(screen.getByText('Sin perfil')).toBeInTheDocument()
  expect(client.getQueryData(['admin-users'])).toBeUndefined()
})
it('revalida el perfil cada 30 segundos', async () => {
  setup()
  await screen.findByText('first:true')
  vi.useFakeTimers()
  // The interval was installed with real timers; switch after remounting via an auth event.
  await act(async () => mock.listener?.('TOKEN_REFRESHED', { user: { id: 'first' } }))
  mock.single.mockResolvedValue({ data: { id: 'first', is_active: false }, error: null })
  await act(async () => vi.advanceTimersByTime(30_000))
  expect(screen.getByText('first:false')).toBeInTheDocument()
})
it('aplica oscuro por defecto, guarda claro y vuelve a oscuro al salir', async () => {
  setup()
  await screen.findByText('first:true')
  expect(document.documentElement.dataset.theme).toBe('dark')
  await act(async () => screen.getByRole('button', { name: 'Claro' }).click())
  expect(mock.update).toHaveBeenCalledWith({ theme_preference: 'light' })
  expect(document.documentElement.dataset.theme).toBe('light')
  await act(async () => mock.listener?.('SIGNED_OUT', null))
  expect(document.documentElement.dataset.theme).toBe('dark')
})
it('revierte el tema si no se puede guardar', async () => {
  mock.updateSingle.mockResolvedValue({ data: null, error: { message: 'error' } })
  setup()
  await screen.findByText('first:true')
  await act(async () => screen.getByRole('button', { name: 'Claro' }).click())
  expect(document.documentElement.dataset.theme).toBe('dark')
})
it('recupera la preferencia del perfil autenticado', async () => {
  mock.single.mockResolvedValue({ data: { id: 'first', is_active: true, theme_preference: 'light' }, error: null })
  setup()
  await screen.findByText('first:true')
  expect(document.documentElement.dataset.theme).toBe('light')
})
