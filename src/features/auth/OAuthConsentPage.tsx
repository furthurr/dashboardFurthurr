import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { authorizationId, redirectOAuthCallback } from './mcpOAuth'

type Details = Extract<NonNullable<Awaited<ReturnType<typeof supabase.auth.oauth.getAuthorizationDetails>>['data']>, { authorization_id: string }>

export function OAuthConsentPage() {
  const [params] = useSearchParams()
  const id = authorizationId(params.get('authorization_id'))
  const { user, profile, isLoading } = useAuth()
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id || isLoading || !user || !profile?.is_active) return
    let cancelled = false
    async function load() {
      setDetails(null); setError('')
      try {
        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id!)
        if (cancelled) return
        if (error || !data) throw new Error()
        if ('authorization_id' in data) {
          if (data.user.id !== user!.id) throw new Error()
          setDetails(data)
        } else redirectOAuthCallback(data.redirect_url)
      } catch {
        if (!cancelled) setError('No se pudo recuperar la autorización. Puede haber caducado o no estar habilitado OAuth. Vuelve a conectar desde tu cliente MCP.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [id, user, profile?.is_active, isLoading, attempt])

  async function decide(approve: boolean) {
    if (!id || !details || details.user.id !== user?.id || busy || !profile?.is_active) return
    setBusy(true); setError('')
    try {
      const { data, error } = approve
        ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true })
      if (error || !data) throw new Error()
      redirectOAuthCallback(data.redirect_url)
    } catch {
      setError('No se pudo completar la decisión. Reintenta o inicia una conexión nueva desde tu cliente MCP.')
      setBusy(false)
    }
  }

  if (!isLoading && id && !user) return <Navigate replace to={`/login?authorization_id=${encodeURIComponent(id)}`} />
  const active = profile?.is_active === true
  return <main className="auth-shell"><section className="auth-panel space-y-5" aria-labelledby="consent-title" aria-busy={busy || isLoading}>
    <div className="auth-heading"><h1 id="consent-title">Conectar con Dashboard Furthurr</h1><p>Autoriza a una aplicación para identificar tu cuenta.</p></div>
    {!id ? <p role="alert">Falta una solicitud de autorización válida. Inicia la conexión desde tu cliente MCP.</p>
      : isLoading ? <p role="status">Comprobando tu cuenta…</p>
      : !active ? <p role="alert">Necesitas un perfil activo de Furthurr para autorizar conexiones. Contacta a tu administrador.</p>
      : <>
        <p>Cuenta: <strong>{profile.email}</strong></p>
        {error && <div className="ui-feedback ui-feedback--error" role="alert"><p>{error}</p><button className="ui-button mt-3" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
        {!details && !error && <p role="status">Cargando solicitud…</p>}
        {details && <>
          <div className="ui-feedback space-y-3 break-words">
            <p>Aplicación: <strong>{details.client.name || 'Cliente sin nombre'}</strong></p>
            <p className="text-sm">ID del cliente: {details.client.id}</p>
            <p className="text-sm">Dirección de retorno: {details.redirect_uri}</p>
            <p className="text-sm">Scopes solicitados: {details.scope || 'Predeterminados'}</p>
          </div>
          <p>Esta conexión permite consultar tu identidad (nombre, correo, identificador y rol). No permite consultar tareas, comentarios o archivos sin una autorización adicional. Para habilitar get_task, autoriza expresamente la lectura de tareas en «Gestionar conexiones» después de conectar el cliente. No permite modificar datos.</p>
          <p className="text-sm text-[var(--color-text-muted)]">El nombre lo declara la aplicación; no acredita que sea de confianza. Revisa la dirección de retorno. Tu contraseña no se comparte con ella.</p>
          <div className="flex flex-wrap gap-3"><button className="ui-button ui-button--primary" disabled={busy} onClick={() => void decide(true)}>Autorizar conexión</button><button className="ui-button" disabled={busy} onClick={() => void decide(false)}>Denegar</button></div>
          <span role="status">{busy ? 'Completando autorización…' : ''}</span>
        </>}
      </>}
    <Link to="/profile/connections" className="ui-button">Gestionar conexiones</Link>
  </section></main>
}
