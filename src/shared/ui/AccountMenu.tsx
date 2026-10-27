import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { getAvatarFileError, uploadProfileAvatar } from '@/features/users/avatarApi'
import { ProfileAvatar } from './ProfileAvatar'

export function AccountMenu() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarNotice, setAvatarNotice] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !user || avatarBusy) return

    const validationError = getAvatarFileError(file)
    if (validationError) {
      setAvatarError(validationError)
      setAvatarNotice('')
      return
    }

    setAvatarBusy(true)
    setAvatarError('')
    setAvatarNotice('')
    try {
      await uploadProfileAvatar(user.id, file)
      await refreshProfile()
      setAvatarNotice('Foto de perfil actualizada.')
    } catch (failure) {
      setAvatarError(failure instanceof Error ? failure.message : 'No se pudo actualizar la foto de perfil.')
    } finally {
      setAvatarBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return <>
    <button type="button" className="ui-button" aria-expanded={open} aria-controls="account-menu-panel" onClick={() => setOpen((value) => !value)}>
      Menú
    </button>
    {open && <>
      <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-40 cursor-default bg-black/30" onClick={() => setOpen(false)} />
      <aside ref={panelRef} id="account-menu-panel" aria-label="Menú de cuenta" className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="mb-8">
          <div className="flex flex-col items-center gap-2">
            <ProfileAvatar src={profile?.avatar_url} name={profile?.full_name || 'Mi cuenta'} size="lg" />
            <input ref={avatarInputRef} id="account-avatar-file" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Seleccionar foto de perfil" onChange={changeAvatar} />
            <button type="button" className="ui-button ui-button--sm" aria-label="Cambiar foto de perfil" disabled={!user || avatarBusy}
              onClick={() => avatarInputRef.current?.click()}>
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16 5 3 3M4 20l4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10L4 20Z" />
              </svg>
              {avatarBusy ? 'Guardando…' : 'Cambiar foto'}
            </button>
            <p className="text-center text-xs text-[var(--color-text-muted)]">JPG, PNG o WebP · máximo 2 MB</p>
          </div>
          {avatarNotice && <p role="status" className="ui-feedback ui-feedback--success mt-3">{avatarNotice}</p>}
          {avatarError && <p role="alert" className="ui-feedback ui-feedback--error mt-3">{avatarError}</p>}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-semibold">{profile?.full_name || 'Mi cuenta'}</p><p className="text-sm text-[var(--color-text-muted)]">{profile?.role}</p></div>
            <button type="button" className="ui-button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button>
          </div>
        </div>
        <nav aria-label="Opciones de cuenta" className="flex flex-col gap-2">
          <button type="button" className="ui-button justify-start" onClick={() => { setOpen(false); navigate('/boards') }}>Tableros</button>
          {profile?.role === 'admin' && <button type="button" className="ui-button justify-start" onClick={() => { setOpen(false); navigate('/users') }}>Usuarios</button>}
          <button type="button" className="ui-button justify-start" onClick={() => { setOpen(false); navigate('/profile') }}>Perfil</button>
          <button type="button" className="ui-button justify-start" onClick={() => { void signOut() }}>Cerrar sesión</button>
        </nav>
      </aside>
    </>}
  </>
}
