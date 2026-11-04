import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const mock = vi.hoisted(() => ({ setTheme: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, profile: { id: 'user', full_name: 'Equipo', theme_preference: 'dark' }, refreshProfile: vi.fn(), setTheme: mock.setTheme }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

it('permite elegir el tema claro desde perfil y confirma el guardado', async () => {
  mock.setTheme.mockResolvedValueOnce(undefined)
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  expect(screen.getByRole('radio', { name: 'Oscuro · Noche' })).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: 'Claro · Estudio' }))
  expect(mock.setTheme).toHaveBeenCalledWith('light')
  expect(await screen.findByText('Tema guardado.')).toBeVisible()
})

it('informa si falla el guardado del tema', async () => {
  mock.setTheme.mockRejectedValueOnce(new Error('error'))
  render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('radio', { name: 'Claro · Estudio' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el tema')
})
