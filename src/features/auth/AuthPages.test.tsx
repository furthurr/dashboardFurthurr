import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))

describe.each([
  { name: 'acceso', Component: LoginPage, action: 'Iniciar sesión', pending: 'Iniciando sesión…', method: 'signInWithPassword' as const },
  { name: 'registro', Component: RegisterPage, action: 'Crear cuenta', pending: 'Creando cuenta…', method: 'signUp' as const },
])('Accesibilidad de $name', ({ Component, action, pending, method }) => {
  it('separa el anuncio de estado del contenido del botón para conservar su nombre', () => {
    render(<MemoryRouter><Component /></MemoryRouter>)
    const button = screen.getByRole('button', { name: action })
    expect(button).toHaveAccessibleName(action)
    expect(within(button).queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('anuncia la operación pendiente y conserva un nombre accesible al reintentar', async () => {
    const user = userEvent.setup()
    let resolve!: (value: { error: { message: string } }) => void
    auth[method].mockReturnValueOnce(new Promise((done) => { resolve = done }))
    render(<MemoryRouter><Component /></MemoryRouter>)
    const name = screen.queryByLabelText(/nombre completo/i)
    if (name) await user.type(name, 'Persona de prueba')
    await user.type(screen.getByLabelText('Correo electrónico'), 'equipo@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'fixture-password')
    await user.click(screen.getByRole('button', { name: action }))
    expect(screen.getByRole('button', { name: pending })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(pending)
    await act(async () => resolve({ error: { message: 'Prueba de fallo' } }))
    expect(screen.getByRole('button', { name: action })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Prueba de fallo')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
