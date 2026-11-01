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
  const [lastDecision, setLastDecision] = useState(true)

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
    setLastDecision(approve)
    setBusy(true); setError('')
    try {
      if (approve && approvedCallback) {
        await authorizeWorkflow(id)
        redirectOAuthCallback(approvedCallback)
        return
      }
      if (!approve && approvedCallback) {
        // Identity approval is not application consent. Do not deliver its code.
        const { error } = await supabase.auth.oauth.revokeGrant({ clientId: details.client.id })
        if (error) throw new Error()
        setApprovedCallback(null); setDetails(null)
        setError('Conexión denegada. Inicia una nueva solicitud desde tu cliente MCP si deseas conectar.')
        setBusy(false)
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
        {error && <div className="ui-feedback ui-feedback--error" role="alert"><p>{error}</p><button className="ui-button mt-3" disabled={busy} onClick={() => approvedCallback ? void decide(lastDecision) : setAttempt(value => value + 1)}>Reintentar</button></div>}
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
          <p>Solo tareas donde estés asignado y tengas acceso al tablero, en Backlog, Por hacer o Haciendo. El avance automático está incluido: la aplicación puede iniciar tareas y enviarlas a revisión sin una nueva aceptación en la conversación, después de publicar un resultado vigente y declarar el trabajo completado. Nunca permite finalizar tareas, asignarte ni reabrirlas. Todos los permisos se conceden como un único conjunto; solo puedes retirarlos revocando la conexión completa en Perfil → Conexiones.</p>
          <p>Los adjuntos y comentarios se compartirán con la aplicación y su asistente. Los archivos descargados y enlaces temporales ya emitidos no se pueden retirar retroactivamente.</p>
          <p className="text-sm text-[var(--color-text-muted)]">El nombre lo declara la aplicación; no acredita que sea de confianza. Revisa la dirección de retorno. Tu contraseña no se comparte con ella.</p>
          {approvedCallback && <p>La identidad OAuth ya fue autorizada, pero falta un consentimiento de aplicación válido. Acepta el conjunto completo para conectar o deniega para revocar esta conexión.</p>}
          <div className="flex flex-wrap gap-3"><button className="ui-button ui-button--primary" disabled={busy} onClick={() => void decide(true)}>Autorizar conexión</button><button className="ui-button" disabled={busy} onClick={() => void decide(false)}>Denegar</button></div>
          <span role="status">{busy ? 'Completando autorización…' : ''}</span>
        </>}
      </>}
    <Link to="/profile/connections" className="ui-button">Gestionar conexiones</Link>
  </section></main>
}
