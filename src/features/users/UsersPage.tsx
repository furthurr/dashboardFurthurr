import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { Dialog } from '@/shared/ui/Dialog'
import { ProfileAvatar } from '@/shared/ui/ProfileAvatar'
import { getAvatarFileError, uploadProfileAvatar } from './avatarApi'
import { adminRequest, listUsers, type ManagedUser, type UserAction } from './api'

type Editor = { kind: 'create' } | { kind: 'password' | 'set-active' | 'rename' | 'avatar' | 'promote-admin'; user: ManagedUser }

export function UsersPage() {
  const { user, refreshProfile } = useAuth()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState('')
  const users = useQuery({ queryKey: ['admin-users', page], queryFn: () => listUsers(page), staleTime: 0 })

  return (
    <main className="board-shell">
      <header className="board-header">
        <div><p className="text-xs text-[var(--color-text-muted)]">Dashboard Furthurr</p><h1>Administración de usuarios</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Gestiona las cuentas y el acceso del equipo.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/board" className="ui-button">Volver al tablero</Link>
          <button className="ui-button ui-button--primary" onClick={() => { setNotice(''); setEditor({ kind: 'create' }) }}>Alta de usuario</button>
        </div>
      </header>
      <section className="px-4 py-6 sm:px-8" aria-label="Usuarios de la plataforma">
        {notice && <p role="status" className="ui-feedback mb-4">{notice}</p>}
        {users.isPending ? <p role="status">Cargando usuarios…</p>
          : users.isError ? <div role="alert" className="ui-feedback ui-feedback--error"><p>{users.error.message}</p><button className="ui-button mt-3" onClick={() => users.refetch()}>Reintentar</button></div>
          : <>
            {users.data.users.length === 0 ? <p className="ui-feedback">No hay usuarios en esta página.</p> :
              <ul className="space-y-3">
                {users.data.users.map((account) => <li key={account.id} className="ui-feedback flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 max-w-full items-center gap-3">
                    <ProfileAvatar src={account.avatar_url} name={account.full_name || account.email} size="md" fallback="initials" />
                    <div className="min-w-0">
                      <h2 className="font-semibold break-words">{account.full_name || 'Sin nombre'}{account.id === user?.id && ' (tú)'}</h2>
                      <p className="break-all text-sm text-[var(--color-text-muted)]">{account.email}</p>
                      <p className="text-sm">{account.role} · <strong>{account.is_active ? 'Activo' : 'Inactivo'}</strong></p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="ui-button" aria-label={`Editar nombre de ${account.email}`} onClick={() => { setNotice(''); setEditor({ kind: 'rename', user: account }) }}>Editar nombre</button>
                    <button className="ui-button" aria-label={`Cambiar foto de ${account.email}`} onClick={() => { setNotice(''); setEditor({ kind: 'avatar', user: account }) }}>Cambiar foto</button>
                    <button className="ui-button" aria-label={`Cambiar contraseña de ${account.email}`} onClick={() => { setNotice(''); setEditor({ kind: 'password', user: account }) }}>Cambiar contraseña</button>
                    <button className="ui-button" disabled={account.id === user?.id} title={account.id === user?.id ? 'No puedes desactivar tu propia cuenta' : undefined}
                      aria-label={`${account.is_active ? 'Desactivar' : 'Activar'} a ${account.email}`}
                      onClick={() => { setNotice(''); setEditor({ kind: 'set-active', user: account }) }}>{account.is_active ? 'Desactivar' : 'Activar'}</button>
                    {account.role !== 'admin' && <button className="ui-button" aria-label={`Promover a administrador a ${account.email}`}
                      onClick={() => { setNotice(''); setEditor({ kind: 'promote-admin', user: account }) }}>Hacer administrador</button>}
                  </div>
                </li>)}
              </ul>}
            <nav aria-label="Páginas de usuarios" className="mt-6 flex flex-wrap items-center gap-3">
              <button className="ui-button" disabled={page === 1 || users.isFetching} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {page} · {users.data.total} usuarios</span>
              <button className="ui-button" disabled={page * users.data.pageSize >= users.data.total || users.isFetching} onClick={() => setPage(page + 1)}>Siguiente</button>
            </nav>
          </>}
      </section>
      {editor && <UserEditor editor={editor} onClose={() => setEditor(null)} onSuccess={() => {
        setNotice(editor.kind === 'create' ? 'Cuenta creada. Ya puede iniciar sesión sin confirmar su correo.' : editor.kind === 'password' ? 'Contraseña actualizada.' : editor.kind === 'rename' ? 'Nombre actualizado.' : editor.kind === 'avatar' ? 'Foto de perfil actualizada.' : editor.kind === 'promote-admin' ? 'La cuenta ahora tiene rol de administrador.' : 'Estado del usuario actualizado.')
        if (editor.kind === 'rename' || editor.kind === 'avatar') {
          void client.invalidateQueries({ queryKey: ['tasks'] })
          void client.invalidateQueries({ queryKey: ['comments'] })
          void client.invalidateQueries({ queryKey: ['assignable-users'] })
        }
        if (editor.kind === 'avatar' && editor.user.id === user?.id) void refreshProfile()
        setEditor(null)
        void client.invalidateQueries({ queryKey: ['admin-users'] })
      }} />}
    </main>
  )
}

function UserEditor({ editor, onClose, onSuccess }: { editor: Editor; onClose: () => void; onSuccess: () => void }) {
  const [fullName, setFullName] = useState(editor.kind === 'rename' ? editor.user.full_name : '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const title = editor.kind === 'create' ? 'Alta de usuario' : editor.kind === 'password' ? 'Cambiar contraseña' : editor.kind === 'rename' ? 'Editar nombre' : editor.kind === 'avatar' ? 'Cambiar foto de perfil' : editor.kind === 'promote-admin' ? 'Promover a administrador' : editor.user.is_active ? 'Desactivar usuario' : 'Activar usuario'

  useEffect(() => () => {
    if (previewUrlRef.current && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  function selectAvatarFile(file: File | null) {
    if (previewUrlRef.current && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
    setPreviewUrl(previewUrlRef.current)
    setAvatarFile(file)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    if ((editor.kind === 'create' || editor.kind === 'rename') && (!fullName.trim() || fullName.trim().length > 120)) {
      setError('Introduce un nombre de entre 1 y 120 caracteres.')
      return
    }
    if (editor.kind === 'avatar') {
      const validationError = avatarFile ? getAvatarFileError(avatarFile) : 'Selecciona una foto de perfil.'
      if (validationError) { setError(validationError); return }
    }
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      if (editor.kind === 'avatar') {
        await uploadProfileAvatar(editor.user.id, avatarFile!)
      } else {
        const action: UserAction = editor.kind === 'create' ? { action: 'create', fullName: fullName.trim(), email, password }
          : editor.kind === 'password' ? { action: 'password', userId: editor.user.id, password }
            : editor.kind === 'rename' ? { action: 'rename', userId: editor.user.id, fullName: fullName.trim() }
              : editor.kind === 'promote-admin' ? { action: 'promote-admin', userId: editor.user.id }
                : { action: 'set-active', userId: editor.user.id, active: !editor.user.is_active }
        await adminRequest(action)
      }
      setPassword('')
      onSuccess()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo completar la operación.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <Dialog title={title} busy={busy} onClose={onClose}>
    <form onSubmit={submit} className="min-h-0 overflow-y-auto" aria-busy={busy}>
      <div className="dialog-body space-y-5">
        {editor.kind !== 'create' && <p className="break-all">{editor.user.full_name} · {editor.user.email}</p>}
        {error && <p role="alert" className="ui-feedback ui-feedback--error">{error}</p>}
        {editor.kind === 'promote-admin' && <p>Esta cuenta obtendrá permisos de administrador. El estado activo o inactivo no cambiará.</p>}
        <fieldset disabled={busy} className="space-y-5">
          {(editor.kind === 'create' || editor.kind === 'rename') && <>
            <div><label className="ui-label" htmlFor="user-name">Nombre completo</label><input id="user-name" className="ui-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} /></div>
          </>}
          {editor.kind === 'avatar' && <div className="grid justify-items-center gap-4">
            <ProfileAvatar src={previewUrl ?? editor.user.avatar_url} name={editor.user.full_name || editor.user.email} size="lg" fallback="initials" />
            <div className="w-full">
              <label className="ui-label" htmlFor="user-avatar">Foto de perfil</label>
              <input id="user-avatar" className="ui-field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectAvatarFile(event.target.files?.[0] ?? null)} />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">JPG, PNG o WebP, hasta 2 MB. Se mostrará recortada en un círculo.</p>
            </div>
          </div>}
          {editor.kind === 'create' && <>
            <div><label className="ui-label" htmlFor="user-email">Correo electrónico</label><input id="user-email" className="ui-field" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></div>
            <p className="text-sm text-[var(--color-text-muted)]">Se creará como usuario activo. Podrá entrar sin confirmar su correo.</p>
          </>}
          {(editor.kind === 'create' || editor.kind === 'password') && <div>
            <label className="ui-label" htmlFor="user-password">{editor.kind === 'create' ? 'Contraseña' : 'Nueva contraseña'}</label>
            <input id="user-password" className="ui-field" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} aria-describedby="user-password-hint" />
            <p id="user-password-hint" className="mt-2 text-sm text-[var(--color-text-muted)]">Entre 8 y 128 caracteres. Comunícala al usuario por un canal seguro.</p>
          </div>}
          {editor.kind === 'set-active' && <p>{editor.user.is_active ? 'Se bloqueará su acceso a la plataforma. Sus tareas y comentarios se conservarán.' : 'El usuario podrá volver a entrar con su contraseña.'}</p>}
        </fieldset>
        <span className="sr-only" role="status">{busy ? 'Guardando cambios…' : ''}</span>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="ui-button" disabled={busy} onClick={onClose}>Cancelar</button>
        <button type="submit" className="ui-button ui-button--primary" disabled={busy}>{busy ? 'Guardando…' : editor.kind === 'avatar' ? 'Guardar foto' : title}</button>
      </footer>
    </form>
  </Dialog>
}
