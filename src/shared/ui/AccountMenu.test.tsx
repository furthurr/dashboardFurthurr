import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountMenu } from './AccountMenu'

const mockAuth = vi.hoisted(() => ({ role: 'admin', avatarUrl: null as string | null, signOut: vi.fn(), refreshProfile: vi.fn(), uploadAvatar: vi.fn() }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'user-1' },
  profile: { role: mockAuth.role, full_name: 'Cuenta de prueba', avatar_url: mockAuth.avatarUrl },
  refreshProfile: mockAuth.refreshProfile,
  signOut: mockAuth.signOut,
}) }))
vi.mock('@/features/users/avatarApi', () => ({
  getAvatarFileError: () => null,
  uploadProfileAvatar: (...args: unknown[]) => mockAuth.uploadAvatar(...args),
}))

function renderMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={queryClient}>
    <MemoryRouter><AccountMenu /></MemoryRouter>
  </QueryClientProvider>)
  return { ...view, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.role = 'admin'
  mockAuth.avatarUrl = null
})

describe('AccountMenu', () => {
  it('muestra la gestión de usuarios solo para administradores', async () => {
    const user = userEvent.setup()
    mockAuth.role = 'admin'
    const { rerender, queryClient } = renderMenu()
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.getByRole('button', { name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    mockAuth.role = 'usuario'
    rerender(<QueryClientProvider client={queryClient}><MemoryRouter><AccountMenu /></MemoryRouter></QueryClientProvider>)
    expect(screen.queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument()
  })

  it('permite añadir la primera foto propia desde el menú y refresca el perfil', async () => {
    const user = userEvent.setup()
    mockAuth.role = 'usuario'
    mockAuth.avatarUrl = null
    mockAuth.uploadAvatar.mockResolvedValue('https://example.test/avatar.png')
    mockAuth.refreshProfile.mockImplementation(async () => { mockAuth.avatarUrl = 'https://example.test/avatar.png' })
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.getByRole('img', { name: 'Foto de Cuenta de prueba' }).querySelector('svg')).toBeInTheDocument()
    const file = new File(['image'], 'avatar.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Seleccionar foto de perfil'), file)

    expect(mockAuth.uploadAvatar).toHaveBeenCalledWith('user-1', file)
    expect(mockAuth.refreshProfile).toHaveBeenCalledOnce()
    expect(await screen.findByRole('status')).toHaveTextContent('Foto de perfil actualizada.')
  })
})
