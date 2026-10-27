import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

const mocks = vi.hoisted(() => ({
  list: vi.fn(), request: vi.fn(), uploadAvatar: vi.fn(), getAvatarFileError: vi.fn(),
  auth: { session: {}, user: { id: 'admin' }, profile: { role: 'admin', is_active: true }, isLoading: false, signOut: vi.fn(), refreshProfile: vi.fn() },
}))
vi.mock('./api', () => ({ listUsers: (...args: unknown[]) => mocks.list(...args), adminRequest: (...args: unknown[]) => mocks.request(...args) }))
vi.mock('./avatarApi', () => ({ uploadProfileAvatar: (...args: unknown[]) => mocks.uploadAvatar(...args), getAvatarFileError: (...args: unknown[]) => mocks.getAvatarFileError(...args) }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => mocks.auth }))
const account = { id: 'person', full_name: 'Persona', email: 'person@example.test', avatar_url: null, role: 'usuario', is_active: true }

function setup(protectedRoute = false) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/users']}><Routes>
      <Route path="/users" element={protectedRoute ? <ProtectedRoute adminOnly><UsersPage /></ProtectedRoute> : <UsersPage />} />
      <Route path="/board" element={<p>Tablero</p>} />
    </Routes></MemoryRouter>
  </QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.profile = { role: 'admin', is_active: true }
  mocks.list.mockResolvedValue({ users: [account, { ...account, id: 'admin', email: 'admin@example.test', role: 'admin' }], total: 2, pageSize: 50 })
  mocks.request.mockResolvedValue({ success: true })
  mocks.uploadAvatar.mockResolvedValue('https://example.test/avatar.png')
  mocks.getAvatarFileError.mockReturnValue(null)
})

describe('Administración de usuarios', () => {
  it('precarga el nombre y actualiza el listado sin enviar otros campos', async () => {
    const user = userEvent.setup()
    mocks.request.mockImplementationOnce(async () => {
      mocks.list.mockResolvedValue({ users: [{ ...account, full_name: 'Nombre actualizado' }], total: 1, pageSize: 50 })
      return { success: true }
    })
    setup()
    await user.click(await screen.findByRole('button', { name: 'Editar nombre de person@example.test' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText('Nombre completo')).toHaveValue('Persona')
    expect(dialog.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(dialog.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
    await user.clear(dialog.getByLabelText('Nombre completo'))
    await user.type(dialog.getByLabelText('Nombre completo'), '  Nombre actualizado  ')
    await user.click(dialog.getByRole('button', { name: 'Editar nombre' }))
    expect(mocks.request).toHaveBeenCalledWith({ action: 'rename', userId: 'person', fullName: 'Nombre actualizado' })
    expect(await screen.findByText('Nombre actualizado.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Nombre actualizado' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('rechaza nombres de solo espacios sin enviar la petición', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Editar nombre de person@example.test' }))
    await user.clear(screen.getByLabelText('Nombre completo'))
    await user.type(screen.getByLabelText('Nombre completo'), '   ')
    await user.click(screen.getByRole('button', { name: 'Editar nombre' }))
    expect(screen.getByRole('alert')).toHaveTextContent('entre 1 y 120 caracteres')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('permite al administrador cambiar la foto de una cuenta y refresca los datos asociados', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Cambiar foto de person@example.test' }))
    const file = new File(['image'], 'perfil.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Foto de perfil'), file)
    await user.click(screen.getByRole('button', { name: 'Guardar foto' }))

    expect(mocks.uploadAvatar).toHaveBeenCalledWith('person', file)
    expect(await screen.findByText('Foto de perfil actualizada.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('requiere seleccionar una imagen antes de guardar la foto', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Cambiar foto de person@example.test' }))
    await user.click(screen.getByRole('button', { name: 'Guardar foto' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona una foto')
    expect(mocks.uploadAvatar).not.toHaveBeenCalled()
  })
  it('conserva el borrador ante un error al guardar el nombre y permite cancelar', async () => {
    const user = userEvent.setup()
    mocks.request.mockRejectedValueOnce(new Error('No se pudo actualizar el nombre'))
    setup()
    await user.click(await screen.findByRole('button', { name: 'Editar nombre de person@example.test' }))
    await user.clear(screen.getByLabelText('Nombre completo'))
    await user.type(screen.getByLabelText('Nombre completo'), 'Otro nombre')
    await user.click(screen.getByRole('button', { name: 'Editar nombre' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el nombre')
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Otro nombre')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it('muestra usuarios y bloquea la desactivación propia', async () => {
    setup()
    expect(await screen.findByText('person@example.test')).toBeInTheDocument()
    const avatars = await screen.findAllByRole('img', { name: 'Foto de Persona' })
    expect(within(avatars[0]!).getByText('P')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desactivar a admin@example.test' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Promover a administrador a person@example.test' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Promover a administrador a admin@example.test' })).not.toBeInTheDocument()
  })
  it('muestra la foto de perfil en el círculo cuando la cuenta tiene avatar', async () => {
    mocks.list.mockResolvedValue({ users: [{ ...account, avatar_url: 'https://example.test/person.png' }], total: 1, pageSize: 50 })
    setup()

    const avatar = await screen.findByRole('img', { name: 'Foto de Persona' })
    expect(avatar.querySelector('img')).toHaveAttribute('src', 'https://example.test/person.png')
  })
  it('confirma la promoción de una cuenta no administradora y actualiza el listado', async () => {
    const user = userEvent.setup()
    mocks.request.mockImplementationOnce(async () => {
      mocks.list.mockResolvedValue({ users: [{ ...account, role: 'admin' }], total: 1, pageSize: 50 })
      return { success: true }
    })
    setup()
    await user.click(await screen.findByRole('button', { name: 'Promover a administrador a person@example.test' }))
    const dialogElement = screen.getByRole('dialog')
    const dialog = within(dialogElement)
    expect(dialogElement).toHaveTextContent('obtendrá permisos de administrador')
    expect(mocks.request).not.toHaveBeenCalled()
    await user.click(dialog.getByRole('button', { name: 'Promover a administrador' }))
    expect(mocks.request).toHaveBeenCalledWith({ action: 'promote-admin', userId: 'person' })
    expect(await screen.findByText('La cuenta ahora tiene rol de administrador.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Promover a administrador a person@example.test' })).not.toBeInTheDocument())
  })
  it('ofrece promoción a invitados inactivos sin cambiar su estado', async () => {
    mocks.list.mockResolvedValue({ users: [{ ...account, role: 'invitado', is_active: false }], total: 1, pageSize: 50 })
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: 'Promover a administrador a person@example.test' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('El estado activo o inactivo no cambiará')
    await user.click(within(dialog).getByRole('button', { name: 'Promover a administrador' }))
    expect(mocks.request).toHaveBeenCalledWith({ action: 'promote-admin', userId: 'person' })
  })
  it('crea sin selector de rol y anuncia acceso inmediato', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Alta de usuario' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Nombre completo'), 'Nueva Persona')
    await user.type(dialog.getByLabelText('Correo electrónico'), 'new@example.test')
    await user.type(dialog.getByLabelText('Contraseña'), 'test-password')
    expect(dialog.queryByRole('combobox')).not.toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Alta de usuario' }))
    expect(mocks.request).toHaveBeenCalledWith({ action: 'create', fullName: 'Nueva Persona', email: 'new@example.test', password: 'test-password' })
    expect(await screen.findByText(/Cuenta creada/)).toHaveTextContent('sin confirmar su correo')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('cambia contraseñas y permite reintentar errores sin cerrar el diálogo', async () => {
    const user = userEvent.setup()
    mocks.request.mockRejectedValueOnce(new Error('Operación rechazada'))
    setup()
    await user.click(await screen.findByRole('button', { name: 'Cambiar contraseña de person@example.test' }))
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Operación rechazada')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByText('Contraseña actualizada.')).toBeInTheDocument()
    expect(mocks.request).toHaveBeenLastCalledWith({ action: 'password', userId: 'person', password: 'new-password' })
  })
  it.each([true, false])('confirma el cambio de estado desde activo=%s', async (active) => {
    mocks.list.mockResolvedValue({ users: [{ ...account, is_active: active }], total: 1, pageSize: 50 })
    const user = userEvent.setup()
    setup()
    await user.click(await screen.findByRole('button', { name: `${active ? 'Desactivar' : 'Activar'} a person@example.test` }))
    expect(mocks.request).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: `${active ? 'Desactivar' : 'Activar'} usuario` }))
    expect(mocks.request).toHaveBeenCalledWith({ action: 'set-active', userId: 'person', active: !active })
  })
  it('presenta errores de listado y permite reintentar', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Sin conexión'))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('person@example.test')).toBeInTheDocument()
  })
  it('muestra estado vacío', async () => {
    mocks.list.mockResolvedValue({ users: [], total: 0, pageSize: 50 })
    setup()
    expect(await screen.findByText('No hay usuarios en esta página.')).toBeInTheDocument()
  })
  it.each(['usuario', 'invitado'])('impide acceso directo al rol %s', async (role) => {
    mocks.auth.profile.role = role
    setup(true)
    expect(await screen.findByText('Tablero')).toBeInTheDocument()
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it('bloquea cuentas inactivas aunque tengan sesión', () => {
    mocks.auth.profile.is_active = false
    setup(true)
    expect(screen.getByRole('alert')).toHaveTextContent('cuenta está desactivada')
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
