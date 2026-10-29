import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { Dialog } from '@/shared/ui/Dialog'
import { listTaskReadAccess, setTaskReadAccess, type TaskReadAccess } from './mcpTaskAccess'

type Grants = NonNullable<Awaited<ReturnType<typeof supabase.auth.oauth.listGrants>>['data']>

export function OAuthConnectionsPage() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<Grants | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [taskAccess, setTaskAccess] = useState<TaskReadAccess[] | null>(null)
  const [accessError, setAccessError] = useState('')
  const [confirmRead, setConfirmRead] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setGrants(null); setError('')
      setTaskAccess(null); setAccessError('')
      try {
        const { data, error } = await supabase.auth.oauth.listGrants()
        if (cancelled) return
        if (error || !data) throw new Error()
        setGrants(data)
        try {
          const permissions = await listTaskReadAccess()
          if (!cancelled) setTaskAccess(permissions)
        } catch {
          if (!cancelled) setAccessError('No se pudieron comprobar los permisos de lectura de tareas. Puede faltar la migración del MCP.')
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
    setBusy(clientId); setError(''); setNotice('')
    try {
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (error) throw new Error()
      // Auth removes the sessions; SQL ON DELETE CASCADE removes task consent.
      setGrants(current => current?.filter(grant => grant.client.id !== clientId) ?? null)
      setNotice('Conexión revocada. La aplicación deberá solicitar autorización de nuevo.')
    } catch { setError('No se pudo revocar la conexión. Inténtalo de nuevo.') }
    finally { setBusy(null) }
  }

  async function changeReadAccess(clientId: string, enabled: boolean) {
    if (busy) return
    setBusy(clientId); setAccessError(''); setNotice('')
    try {
      await setTaskReadAccess(clientId, enabled)
      setTaskAccess(current => [...(current ?? []).filter(item => item.client_id !== clientId), { client_id: clientId, enabled, needs_authorization: !enabled }])
      setConfirmRead(null)
      setNotice(enabled ? 'Lectura de tareas autorizada para las sesiones actuales de esta conexión.' : 'Lectura de tareas retirada. La conexión conserva el acceso a tu identidad.')
    } catch {
      setAccessError('No se pudo cambiar el permiso de lectura. Reintenta o vuelve a conectar el cliente MCP.')
    } finally { setBusy(null) }
  }

  return <main className="board-shell min-h-screen">
    <header className="board-header"><div><h1>Conexiones autorizadas</h1><p>Controla qué aplicaciones pueden identificar tu cuenta y cuáles pueden leer tus tareas de Furthurr.</p></div><Link className="ui-button" to="/profile">Volver al perfil</Link></header>
    <section className="mx-auto max-w-2xl space-y-5 px-4 py-8" aria-busy={busy !== null}>
      {notice && <p role="status" className="ui-feedback">{notice}</p>}
      {accessError && !confirmRead && <p role="alert" className="ui-feedback ui-feedback--error">{accessError}</p>}
      <p className="text-sm text-[var(--color-text-muted)]">La lectura requiere una autorización adicional. Para cuentas no administradoras se exige ser miembro del tablero y que esté activo. Una conexión nueva no hereda este permiso. Los archivos descargados y enlaces temporales ya emitidos no se pueden retirar retroactivamente.</p>
      {error && <div role="alert" className="ui-feedback ui-feedback--error"><p>{error}</p><button className="ui-button mt-3" disabled={busy !== null} onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      {!grants && !error && <p role="status">Cargando conexiones…</p>}
      {grants?.length === 0 && <p className="ui-feedback">No tienes conexiones autorizadas.</p>}
      {grants && grants.length > 0 && <ul className="space-y-4">{grants.map(grant => <li key={grant.client.id} className="ui-feedback space-y-3 break-words">
        <h2 className="font-semibold">{grant.client.name || 'Cliente sin nombre'}</h2>
        <p className="text-sm">ID: {grant.client.id}</p><p className="text-sm">Scopes: {grant.scopes.join(', ') || 'Predeterminados'}</p>
        <p className="text-sm">Lectura de tareas: {taskAccess === null ? 'Sin verificar' : taskAccess.some(item => item.client_id === grant.client.id && item.enabled) ? 'Autorizada en las sesiones actuales' : 'Requiere autorización'}</p>
        <button className="ui-button" disabled={busy !== null || taskAccess === null}
          onClick={() => {
            if (taskAccess?.some(item => item.client_id === grant.client.id && item.enabled)) void changeReadAccess(grant.client.id, false)
            else { setAccessError(''); setConfirmRead({ id: grant.client.id, name: grant.client.name || 'Cliente sin nombre' }) }
          }}>
          {taskAccess?.some(item => item.client_id === grant.client.id && item.enabled) ? 'Retirar lectura de tareas' : 'Autorizar lectura de tareas'}
        </button>
        {taskAccess?.some(item => item.client_id === grant.client.id && item.enabled && item.needs_authorization) && <div className="space-y-2">
          <p className="text-sm">Hay sesiones nuevas que todavía no pueden leer tareas. Puedes autorizarlas o retirar la lectura de todas las sesiones.</p>
          <button className="ui-button" disabled={busy !== null} onClick={() => { setAccessError(''); setConfirmRead({ id: grant.client.id, name: grant.client.name || 'Cliente sin nombre' }) }}>Autorizar nuevas sesiones</button>
        </div>}
        <button className="ui-button ui-button--danger" disabled={busy !== null} onClick={() => void revoke(grant.client.id)} aria-label={`Revocar conexión de ${grant.client.name || grant.client.id}`}>{busy === grant.client.id ? 'Revocando…' : 'Revocar conexión'}</button>
      </li>)}</ul>}
    </section>
    {confirmRead && <Dialog title="Autorizar lectura de tareas" busy={busy !== null} onClose={() => setConfirmRead(null)}>
      <div className="dialog-body space-y-4">
        <p>Permitir que <strong>{confirmRead.name}</strong> consulte por ID el título, descripción, estado, prioridad, notas, responsables, comentarios y adjuntos de las tareas a las que tienes acceso.</p>
        <p>Incluye nombres de personas y enlaces de descarga de archivos válidos durante 60 segundos. No permite crear, editar ni eliminar datos. Autoriza solo aplicaciones de confianza.</p>
        <p>Se aplica a las sesiones actuales de este cliente. Puedes retirar la lectura sin revocar la conexión de identidad.</p>
        {accessError && <p role="alert" className="ui-feedback ui-feedback--error">{accessError}</p>}
      </div>
      <div className="dialog-footer">
        <button className="ui-button" disabled={busy !== null} onClick={() => setConfirmRead(null)}>Cancelar</button>
        <button className="ui-button ui-button--primary" disabled={busy !== null} onClick={() => void changeReadAccess(confirmRead.id, true)}>{busy ? 'Autorizando…' : 'Confirmar autorización de lectura'}</button>
      </div>
    </Dialog>}
  </main>
}
