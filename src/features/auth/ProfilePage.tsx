import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'

export function ProfilePage() {
  const { user, profile, refreshProfile, setTheme } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [themeBusy, setThemeBusy] = useState(false)
  const [themeMessage, setThemeMessage] = useState('')
  const [themeError, setThemeError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!user || busy) return
    const name = fullName.trim()
    if (!name || name.length > 120) { setError('El nombre debe tener entre 1 y 120 caracteres.'); return }
    if (password && (password.length < 8 || password.length > 128)) { setError('La contraseña debe tener entre 8 y 128 caracteres.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: nameError } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id)
      if (nameError) throw nameError
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password })
        if (passwordError) throw passwordError
      }
      await refreshProfile()
      setPassword('')
      setNotice('Perfil actualizado correctamente.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el perfil.')
    } finally { setBusy(false) }
  }

  return <main className="board-shell min-h-screen">
    <header className="board-header"><div><p className="text-xs text-[var(--color-text-muted)]">Dashboard Furthurr</p><h1>Mi perfil</h1><p className="text-sm text-[var(--color-text-muted)]">Actualiza tu nombre y contraseña.</p></div><Link to="/board" className="ui-button">Volver al tablero</Link></header>
    <section className="mx-auto max-w-xl px-4 py-8 sm:px-8">
      <fieldset className="ui-feedback mb-5" disabled={themeBusy} aria-busy={themeBusy}>
        <legend className="ui-label">Tema de apariencia</legend>
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">Tu elección se guarda en tu cuenta y se aplica en tus dispositivos.</p>
        <div className="flex flex-wrap gap-4">
          {([{ value: 'dark', label: 'Oscuro · Noche' }, { value: 'light', label: 'Claro · Estudio' }] as const).map((option) => <label key={option.value} className="flex items-center gap-2">
            <input type="radio" name="theme" value={option.value} checked={(profile?.theme_preference ?? 'dark') === option.value} onChange={async () => {
              setThemeBusy(true); setThemeError(''); setThemeMessage('')
              try { await setTheme(option.value); setThemeMessage('Tema guardado.') }
              catch { setThemeError('No se pudo guardar el tema. Inténtalo de nuevo.') }
              finally { setThemeBusy(false) }
            }} />{option.label}
          </label>)}
        </div>
        {themeBusy && <p role="status">Guardando tema…</p>}
        {themeMessage && <p role="status">{themeMessage}</p>}
        {themeError && <p role="alert" className="ui-feedback ui-feedback--error mt-3">{themeError}</p>}
      </fieldset>
      <form className="ui-feedback space-y-5" onSubmit={submit} aria-busy={busy}>
        {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="ui-feedback--error">{error}</p>}
        <div><label className="ui-label" htmlFor="profile-name">Nombre de usuario</label><input id="profile-name" className="ui-field" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} /></div>
        <div><label className="ui-label" htmlFor="profile-password">Nueva contraseña</label><input id="profile-password" className="ui-field" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} /><p className="mt-2 text-sm text-[var(--color-text-muted)]">Déjala vacía si no quieres cambiarla. Si la cambias, usa entre 8 y 128 caracteres.</p></div>
        <button className="ui-button ui-button--primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>
      <Link to="/profile/connections" className="ui-button mt-5">Gestionar conexiones MCP</Link>
    </section>
  </main>
}
