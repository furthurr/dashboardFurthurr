import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

type Grants = NonNullable<Awaited<ReturnType<typeof supabase.auth.oauth.listGrants>>['data']>

export function OAuthConnectionsPage() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<Grants | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setGrants(null); setError('')
      try {
        const { data, error } = await supabase.auth.oauth.listGrants()
        if (cancelled) return
        if (error || !data) throw new Error()
        setGrants(data)
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
      setGrants(current => current?.filter(grant => grant.client.id !== clientId) ?? null)
      setNotice('Conexión revocada. La aplicación deberá solicitar autorización de nuevo.')
    } catch { setError('No se pudo revocar la conexión. Inténtalo de nuevo.') }
    finally { setBusy(null) }
  }

  return <main className="board-shell min-h-screen">
    <header className="board-header"><div><h1>Conexiones autorizadas</h1><p>Controla qué aplicaciones pueden identificar tu cuenta de Furthurr.</p></div><Link className="ui-button" to="/profile">Volver al perfil</Link></header>
    <section className="mx-auto max-w-2xl space-y-5 px-4 py-8" aria-busy={busy !== null}>
      {notice && <p role="status" className="ui-feedback">{notice}</p>}
      {error && <div role="alert" className="ui-feedback ui-feedback--error"><p>{error}</p><button className="ui-button mt-3" disabled={busy !== null} onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      {!grants && !error && <p role="status">Cargando conexiones…</p>}
      {grants?.length === 0 && <p className="ui-feedback">No tienes conexiones autorizadas.</p>}
      {grants && grants.length > 0 && <ul className="space-y-4">{grants.map(grant => <li key={grant.client.id} className="ui-feedback space-y-3 break-words">
        <h2 className="font-semibold">{grant.client.name || 'Cliente sin nombre'}</h2>
        <p className="text-sm">ID: {grant.client.id}</p><p className="text-sm">Scopes: {grant.scopes.join(', ') || 'Predeterminados'}</p>
        <button className="ui-button ui-button--danger" disabled={busy !== null} onClick={() => void revoke(grant.client.id)} aria-label={`Revocar conexión de ${grant.client.name || grant.client.id}`}>{busy === grant.client.id ? 'Revocando…' : 'Revocar conexión'}</button>
      </li>)}</ul>}
    </section>
  </main>
}
