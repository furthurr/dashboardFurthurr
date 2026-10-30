import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { setConnectionAutomation } from './mcpAutomation'
import { listWorkflowAccess, permissionLabels, revokeWorkflowPermission, type WorkflowAccess, type WorkflowPermission } from './mcpWorkflowAccess'

type Grants = NonNullable<Awaited<ReturnType<typeof supabase.auth.oauth.listGrants>>['data']>

export function OAuthConnectionsPage() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<Grants | null>(null)
  const [access, setAccess] = useState<WorkflowAccess[] | null>(null)
  const [error, setError] = useState('')
  const [accessError, setAccessError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setGrants(null); setAccess(null); setError(''); setAccessError('')
      try {
        const { data, error } = await supabase.auth.oauth.listGrants()
        if (cancelled) return
        if (error || !data) throw new Error()
        setGrants(data)
        try {
          const permissions = await listWorkflowAccess()
          if (!cancelled) setAccess(permissions)
        } catch {
          if (!cancelled) setAccessError('No se pudieron comprobar los permisos. Puede faltar la migración del MCP.')
        }
      } catch {
        if (!cancelled) setError('No se pudieron cargar las conexiones. Comprueba que OAuth esté habilitado e inténtalo de nuevo.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.id, attempt])

  async function revoke(clientId: string, permission?: WorkflowPermission | 'all') {
    if (busy) return
    setBusy(clientId); setError(''); setAccessError(''); setNotice('')
    try {
      if (permission) {
        await revokeWorkflowPermission(clientId, permission)
        // Reload effective grants: legacy consent and dependencies can affect the result.
        setAccess(await listWorkflowAccess())
        setNotice('Permisos retirados. La conexión conserva el acceso a tu identidad.')
      } else {
        const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
        if (error) throw new Error()
        setGrants(current => current?.filter(grant => grant.client.id !== clientId) ?? null)
        setNotice('Conexión revocada. La aplicación deberá solicitar autorización de nuevo.')
      }
    } catch {
      if (permission) {
        setAccess(null)
        setAccessError('No se pudo confirmar el estado de los permisos. Reintenta para comprobarlo.')
      } else setError('No se pudo revocar la conexión. Inténtalo de nuevo.')
    } finally { setBusy(null) }
  }

  async function changeAutomation(clientId: string, enabled: boolean) {
    if (busy) return
    setBusy(clientId); setAccessError(''); setNotice('')
    try {
      await setConnectionAutomation(clientId, enabled)
      setAccess(await listWorkflowAccess())
      setNotice(enabled ? 'Avance automático autorizado para esta conexión. También debe habilitarse en cada tarea.' : 'Autorización de avance automático retirada.')
    } catch {
      setAccess(null)
      setAccessError('No se pudo confirmar la autorización automática. Reintenta para comprobar su estado.')
    } finally { setBusy(null) }
  }

  return <main className="board-shell min-h-screen">
    <header className="board-header"><div><h1>Conexiones autorizadas</h1><p>Consulta y retira los permisos de las aplicaciones conectadas.</p></div><Link className="ui-button" to="/profile">Volver al perfil</Link></header>
    <section className="mx-auto max-w-2xl space-y-5 px-4 py-8" aria-busy={busy !== null}>
      {notice && <p role="status" className="ui-feedback">{notice}</p>}
      {busy !== null && <p role="status">Actualizando conexión…</p>}
      {(error || accessError) && <div role="alert" className="ui-feedback ui-feedback--error"><p>{error || accessError}</p><button className="ui-button mt-3" disabled={busy !== null} onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      <p className="text-sm text-[var(--color-text-muted)]">Los permisos se conceden al autorizar la conexión, no al iniciar sesión. Solo se puede trabajar sobre tareas asignadas en etapas permitidas y con acceso al tablero. Retirar lectura de tareas bloquea también el trabajo. Para recuperar permisos retirados o ampliar una conexión antigua, vuelve a conectar desde el cliente MCP y acepta la autorización completa. Nunca se permite pasar a Finalizadas.</p>
      <p className="text-sm text-[var(--color-text-muted)]">Los archivos descargados y enlaces temporales ya emitidos no se pueden retirar retroactivamente.</p>
      {!grants && !error && <p role="status">Cargando conexiones…</p>}
      {grants?.length === 0 && <p className="ui-feedback">No tienes conexiones autorizadas.</p>}
      {grants && grants.length > 0 && <ul className="space-y-4">{grants.map(grant => {
        const permissions = access?.find(item => item.client_id === grant.client.id)?.permissions ?? []
        return <li key={grant.client.id} className="ui-feedback space-y-3 break-words">
          <h2>{grant.client.name || 'Cliente sin nombre'}</h2>
          <p className="text-sm">ID: {grant.client.id}</p><p className="text-sm">Scopes OAuth: {grant.scopes.join(', ') || 'Predeterminados'}</p>
          <p>Identidad: autorizada (nombre, correo, identificador y rol). Se retira revocando la conexión.</p>
          {access === null ? <p>Permisos de tareas: Sin verificar</p> : <ul className="space-y-2">{Object.entries(permissionLabels).map(([key, label]) => <li key={key}>
            <span>{label}: {permissions.includes(key as WorkflowPermission) ? 'Autorizado' : 'No autorizado'}</span>
            {permissions.includes(key as WorkflowPermission) && <button className="ui-button ui-button--sm ml-2" disabled={busy !== null} onClick={() => void revoke(grant.client.id, key as WorkflowPermission)} aria-label={`Retirar permiso: ${label} de ${grant.client.name || grant.client.id}`}>Retirar permiso</button>}
          </li>)}</ul>}
          <label className="flex items-center gap-2"><input type="checkbox"
            aria-label={`Avance automático de ${grant.client.name || grant.client.id}`}
            checked={access?.find(item => item.client_id === grant.client.id)?.automatic_advance === true}
            disabled={busy !== null || access === null || !['read_tasks','start_task','comment_task','review_task'].every(key => permissions.includes(key as WorkflowPermission))}
            onChange={event => void changeAutomation(grant.client.id, event.target.checked)} />Autorizar avance automático para esta conexión</label>
          <p className="text-sm">Autorización independiente y desactivada por defecto: permite iniciar y enviar a revisión sin aceptación adicional, solo en tareas que también lo habiliten y después de registrar resultados. No finaliza, asigna ni reabre. Puedes retirarla aquí; renovar o revocar el consentimiento OAuth la invalida. Las indicaciones al modelo no garantizan su cumplimiento.</p>
          <div className="flex flex-wrap gap-3">
            {permissions.length > 0 && <button className="ui-button" disabled={busy !== null || access === null} onClick={() => void revoke(grant.client.id, 'all')}>Retirar todos los permisos de tareas</button>}
            <button className="ui-button ui-button--danger" disabled={busy !== null} onClick={() => void revoke(grant.client.id)} aria-label={`Revocar conexión de ${grant.client.name || grant.client.id}`}>Revocar conexión</button>
          </div>
        </li>
      })}</ul>}
    </section>
  </main>
}
