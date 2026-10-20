import { useId } from 'react'
import type { AssigneeOptions } from './AssigneePicker'

interface AssigneeFilterProps extends AssigneeOptions {
  value: string[]
  onChange: (ids: string[]) => void
}

export function AssigneeFilter({ users = [], loading, error, onRetry, value, onChange }: AssigneeFilterProps) {
  const id = useId()
  return <details className="relative max-w-full" onKeyDown={(event) => {
    if (event.key === 'Escape') {
      event.currentTarget.open = false
      event.currentTarget.querySelector('summary')?.focus()
    }
  }}>
    <summary className="ui-button cursor-pointer">Filtrar usuarios: {value.length ? `${value.length} seleccionados` : 'Todos'}</summary>
    <fieldset className="absolute right-0 z-30 mt-2 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <legend className="sr-only">Filtrar tareas por usuarios asignados</legend>
      <label className="flex min-h-11 items-center gap-3 font-semibold" htmlFor={`${id}-all`}>
        <input id={`${id}-all`} type="checkbox" checked={value.length === 0} onChange={() => onChange([])} />Todos
      </label>
      {loading ? <p role="status">Cargando usuarios…</p>
        : error ? <div role="alert" className="ui-feedback ui-feedback--error"><p>No se pudieron cargar los usuarios del filtro.</p><button type="button" className="ui-button mt-2" onClick={onRetry}>Reintentar</button></div>
          : users.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No hay usuarios disponibles.</p>
            : <div className="max-h-64 overflow-y-auto">
              {users.map((person) => <label key={person.id} className="flex min-h-11 items-center gap-3 py-2">
                <input type="checkbox" checked={value.includes(person.id)} onChange={() => onChange(value.includes(person.id) ? value.filter((item) => item !== person.id) : [...value, person.id])} />
                <span className="min-w-0 break-words"><span className="block text-sm font-semibold">{person.full_name || person.email}</span><span className="block break-all text-xs text-[var(--color-text-muted)]">{person.email}</span></span>
              </label>)}
            </div>}
    </fieldset>
  </details>
}
