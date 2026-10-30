import { useEffect, useRef, useState } from 'react'
import { getTaskAutomation, setTaskAutomation } from '../auth/mcpAutomation'

export function TaskAutomation({ taskId }: { taskId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    getTaskAutomation(taskId).then(value => { if (!cancelled) setEnabled(value) })
      .catch(() => { if (!cancelled) setError('No se pudo consultar el avance automático. No se asume autorizado.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [taskId, attempt])
  async function toggle() {
    if (locked.current || enabled === null) return
    locked.current = true; setBusy(true); setError('')
    try {
      await setTaskAutomation(taskId, !enabled)
      setEnabled(await getTaskAutomation(taskId))
    } catch {
      setEnabled(null)
      setError('No se pudo confirmar el avance automático. Reintenta para comprobar su estado.')
    } finally { locked.current = false; setBusy(false) }
  }
  return <section className="ui-feedback mt-5 space-y-3" aria-label="Automatización MCP" aria-busy={loading || busy}>
    <label className="flex items-center gap-2"><input type="checkbox" checked={enabled === true}
      disabled={loading || busy || enabled === null} onChange={() => void toggle()} />Avance automático MCP de esta tarea</label>
    <p className="text-sm">Desactivado por defecto. Permite iniciar en Haciendo y enviar a En revisión tras registrar el resultado, sin aprobaciones adicionales, solo si la conexión también lo autoriza. No finaliza, asigna ni reabre tareas. Las instrucciones al modelo son guía, no garantía de ejecución.</p>
    {(loading || busy) && <p role="status">{busy ? 'Guardando automatización…' : 'Cargando automatización…'}</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className="ui-button" disabled={busy || loading} onClick={() => {
      setLoading(true); setError(''); setAttempt(value => value + 1)
    }}>Reintentar automatización</button></div>}
  </section>
}
