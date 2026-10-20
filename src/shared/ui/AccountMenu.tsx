import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

export function AccountMenu() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

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
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-semibold">{profile?.full_name || 'Mi cuenta'}</p><p className="text-sm text-[var(--color-text-muted)]">{profile?.role}</p></div>
          <button type="button" className="ui-button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button>
        </div>
        <nav aria-label="Opciones de cuenta" className="flex flex-col gap-2">
          {profile?.role === 'admin' && <button type="button" className="ui-button justify-start" onClick={() => { setOpen(false); navigate('/users') }}>Usuarios</button>}
          <button type="button" className="ui-button justify-start" onClick={() => { setOpen(false); navigate('/profile') }}>Perfil</button>
          <button type="button" className="ui-button justify-start" onClick={() => { void signOut() }}>Cerrar sesión</button>
        </nav>
      </aside>
    </>}
  </>
}
