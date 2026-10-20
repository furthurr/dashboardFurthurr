import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'

const mockAuth = vi.hoisted(() => ({ role: 'admin', signOut: vi.fn() }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ profile: { role: mockAuth.role, full_name: 'Cuenta de prueba' }, signOut: mockAuth.signOut }) }))

describe('AccountMenu', () => {
  it('muestra la gestión de usuarios solo para administradores', async () => {
    const user = userEvent.setup()
    mockAuth.role = 'admin'
    const { rerender } = render(<MemoryRouter><AccountMenu /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.getByRole('button', { name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    mockAuth.role = 'usuario'
    rerender(<MemoryRouter><AccountMenu /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument()
  })
})
