import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { listWorkflowAccess, permissionLabels, type WorkflowAccess, type WorkflowPermission } from './mcpWorkflowAccess'

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

  async function revoke(clientId: string) {
    if (busy) return
    setBusy(clientId); setError(''); setAccessError(''); setNotice('')
    try {
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (error) throw new Error()
      setGrants(current => current?.filter(grant => grant.client.id !== clientId) ?? null)
      setNotice('Conexión revocada. La aplicación deberá solicitar autorización de nuevo.')
    } catch {
      setError('No se pudo revocar la conexión. Inténtalo de nuevo.')
    } finally { setBusy(null) }
  }

  return <main className="board-shell min-h-screen">
    <header className="board-header"><div><h1>Conexiones autorizadas</h1><p>Consulta los permisos o revoca una conexión completa.</p></div><Link className="ui-button" to="/profile">Volver al perfil</Link></header>
    <section className="mx-auto max-w-2xl space-y-5 px-4 py-8" aria-busy={busy !== null}>
      {notice && <p role="status" className="ui-feedback">{notice}</p>}
      {busy !== null && <p role="status">Actualizando conexión…</p>}
      {(error || accessError) && <div role="alert" className="ui-feedback ui-feedback--error"><p>{error || accessError}</p><button className="ui-button mt-3" disabled={busy !== null} onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      <p className="text-sm text-[var(--color-text-muted)]">Los permisos se conceden como un único conjunto al autorizar la conexión, no al iniciar sesión. Incluyen avance automático sin aceptación adicional, solo en tareas asignadas, etapas permitidas y con acceso al tablero. Para enviarlas a revisión se exige un resultado vigente y declarar el trabajo completado. Nunca se permite finalizar, asignar ni reabrir tareas. Solo puedes retirar los permisos revocando la conexión completa.</p>
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
          </li>)}</ul>}
          <p>Avance automático: {access === null ? 'Sin verificar' : access.find(item => item.client_id === grant.client.id)?.automatic_advance === true ? 'Incluido' : 'No autorizado'}</p>
          <div className="flex flex-wrap gap-3">
            <button className="ui-button ui-button--danger" disabled={busy !== null} onClick={() => void revoke(grant.client.id)} aria-label={`Revocar conexión de ${grant.client.name || grant.client.id}`}>Revocar conexión</button>
          </div>
        </li>
      })}</ul>}
    </section>
  </main>
}
