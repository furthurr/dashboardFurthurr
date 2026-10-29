import { useEffect, useRef, useState } from 'react'

interface CopyTaskIdProps {
  taskId: string
  taskTitle: string
  showId?: boolean
}

export function CopyTaskId({ taskId, taskTitle, showId = false }: CopyTaskIdProps) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const pending = useRef(false)

  useEffect(() => {
    if (state !== 'copied') return
    const timer = window.setTimeout(() => setState('idle'), 4000)
    return () => window.clearTimeout(timer)
  }, [state])

  async function copy() {
    if (pending.current) return
    pending.current = true
    setState('copying')
    try {
      await navigator.clipboard.writeText(taskId)
      setState('copied')
    } catch {
      setState('error')
    } finally {
      pending.current = false
    }
  }

  return (
    <div className="min-w-0" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        {(showId || state === 'error') && <div className="min-w-0 flex-1">
          <span className="block text-xs text-[var(--color-text-muted)]">ID de tarea</span>
          <code className="select-text text-xs [overflow-wrap:anywhere]">{taskId}</code>
        </div>}
        <button type="button" className="ui-button ui-button--sm shrink-0"
          aria-label={`Copiar ID de ${taskTitle}`} title="Copiar ID de tarea"
          disabled={state === 'copying'} onClick={() => void copy()}>
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8V4H4v12h4" />
          </svg>
        </button>
      </div>
      {state === 'copied' && <p role="status" className="mt-1 text-xs text-[var(--color-text-muted)]">ID de tarea copiado</p>}
      {state === 'error' && <p role="alert" className="mt-1 text-xs text-[var(--color-warning)]">No se pudo copiar el ID. Selecciona el identificador y cópialo manualmente.</p>}
    </div>
  )
}
