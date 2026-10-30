import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { authorizationId, redirectOAuthCallback } from './mcpOAuth'
import { authorizeWorkflow, permissionLabels, workflowAuthorizationDetails } from './mcpWorkflowAccess'

type AuthorizationDetails = Extract<NonNullable<Awaited<ReturnType<typeof supabase.auth.oauth.getAuthorizationDetails>>['data']>, { authorization_id: string }>
type Details = Pick<AuthorizationDetails, 'authorization_id' | 'redirect_uri' | 'scope' | 'user'> & {
  client: Pick<AuthorizationDetails['client'], 'id' | 'name'>
}

export function OAuthConsentPage() {
  const [params] = useSearchParams()
  const id = authorizationId(params.get('authorization_id'))
  const { user, profile, isLoading } = useAuth()
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [approvedCallback, setApprovedCallback] = useState<string | null>(null)

  useEffect(() => {
    if (!id || isLoading || !user || !profile?.is_active) return
    let cancelled = false
    async function load() {
      setDetails(null); setApprovedCallback(null); setError('')
      try {
        const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id!)
        if (cancelled) return
        if (error || !data) throw new Error()
        if ('authorization_id' in data) {
          if (data.user.id !== user!.id) throw new Error()
          setDetails(data)
        } else {
          const request = await workflowAuthorizationDetails(id!)
          if (cancelled) return
          if (request.details.user.id !== user!.id || request.details.authorization_id !== id) throw new Error()
          if (request.authorized) redirectOAuthCallback(data.redirect_url)
          else {
            setDetails(request.details)
            setApprovedCallback(data.redirect_url)
          }
        }
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
      if (approve && approvedCallback) {
        await authorizeWorkflow(id)
        redirectOAuthCallback(approvedCallback)
        return
      }
      if (!approve && approvedCallback) {
        // OAuth identity was already approved by Auth. Do not broaden it.
        redirectOAuthCallback(approvedCallback)
        return
      }
      const { data, error } = approve
        ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
        : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true })
      if (error || !data) throw new Error()
      if (approve) {
        setApprovedCallback(data.redirect_url)
        await authorizeWorkflow(id)
      }
      redirectOAuthCallback(data.redirect_url)
    } catch {
      setError('No se pudo completar la decisión. Reintenta o inicia una conexión nueva desde tu cliente MCP.')
      setBusy(false)
    }
  }

  if (!isLoading && id && !user) return <Navigate replace to={`/login?authorization_id=${encodeURIComponent(id)}`} />
  const active = profile?.is_active === true
  return <main className="auth-shell"><section className="auth-panel space-y-5" aria-labelledby="consent-title" aria-busy={busy || isLoading}>
    <div className="auth-heading"><h1 id="consent-title">Conectar con Dashboard Furthurr</h1><p>Autoriza identidad y trabajo asistido sobre tus tareas.</p></div>
    {!id ? <p role="alert">Falta una solicitud de autorización válida. Inicia la conexión desde tu cliente MCP.</p>
      : isLoading ? <p role="status">Comprobando tu cuenta…</p>
      : !active ? <p role="alert">Necesitas un perfil activo de Furthurr para autorizar conexiones. Contacta a tu administrador.</p>
      : <>
        <p>Cuenta: <strong>{profile.email}</strong></p>
        {error && <div className="ui-feedback ui-feedback--error" role="alert"><p>{error}</p><button className="ui-button mt-3" disabled={busy} onClick={() => approvedCallback ? void decide(true) : setAttempt(value => value + 1)}>Reintentar</button></div>}
        {!details && !error && <p role="status">Cargando solicitud…</p>}
        {details && <>
          <div className="ui-feedback space-y-3 break-words">
            <p>Aplicación: <strong>{details.client.name || 'Cliente sin nombre'}</strong></p>
            <p className="text-sm">ID del cliente: {details.client.id}</p>
            <p className="text-sm">Dirección de retorno: {details.redirect_uri}</p>
            <p className="text-sm">Scopes solicitados: {details.scope || 'Predeterminados'}</p>
          </div>
          <p>Al autorizar concedes acceso a tu identidad (nombre, correo, identificador y rol) y estos permisos, sin pasos adicionales en tu perfil:</p>
          <ul className="list-disc space-y-2 pl-5">{Object.entries(permissionLabels).map(([key, label]) => <li key={key}>{label}</li>)}</ul>
          <p>Solo tareas donde estés asignado y tengas acceso al tablero, en Backlog, Por hacer o Haciendo. Iniciar y enviar a revisión requieren tu aceptación en la conversación salvo que habilites por separado el avance automático tanto en Perfil &gt; Conexiones como en el detalle de la tarea. Esta autorización no activa la automatización. Nunca permite finalizar tareas, asignarte ni reabrirlas. Puedes retirar permisos o revocar la conexión en tu perfil.</p>
          <p>Los adjuntos y comentarios se compartirán con la aplicación y su asistente. Los archivos descargados y enlaces temporales ya emitidos no se pueden retirar retroactivamente.</p>
          <p className="text-sm text-[var(--color-text-muted)]">El nombre lo declara la aplicación; no acredita que sea de confianza. Revisa la dirección de retorno. Tu contraseña no se comparte con ella.</p>
          {approvedCallback && <p>La identidad OAuth ya fue autorizada. Estos permisos adicionales requieren tu aceptación; continuar sin ampliarlos conserva únicamente los permisos existentes.</p>}
          <div className="flex flex-wrap gap-3"><button className="ui-button ui-button--primary" disabled={busy} onClick={() => void decide(true)}>Autorizar conexión</button><button className="ui-button" disabled={busy} onClick={() => void decide(false)}>{approvedCallback ? 'Continuar sin ampliar permisos' : 'Denegar'}</button></div>
          <span role="status">{busy ? 'Completando autorización…' : ''}</span>
        </>}
      </>}
    <Link to="/profile/connections" className="ui-button">Gestionar conexiones</Link>
  </section></main>
}
