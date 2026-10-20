import { useId } from 'react'
import type { AssigneeProfile } from '@/types'

export interface AssigneePickerProps {
  users?: AssigneeProfile[]
  initialAssignees?: AssigneeProfile[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export type AssigneeOptions = Pick<AssigneePickerProps, 'users' | 'loading' | 'error' | 'onRetry'>

export function AssigneePicker({ users = [], initialAssignees = [], value, onChange, disabled = false,
  loading = false, error = false, onRetry }: AssigneePickerProps) {
  const id = useId()
  const people = new Map([...initialAssignees, ...users].map((person) => [person.id, person]))
  const available = users.filter((person) => person.is_active && !value.includes(person.id))

  return <fieldset disabled={disabled} className="space-y-3 min-w-0">
    <legend className="ui-label">Usuarios asignados</legend>
    {value.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Sin usuarios asignados.</p> :
      <ul aria-label="Usuarios seleccionados" className="flex flex-wrap gap-2">
        {value.map((personId) => {
          const person = people.get(personId)
          const name = person?.full_name || person?.email || 'Usuario no disponible'
          return <li key={personId} className="ui-list-card flex max-w-full items-center gap-2 px-3 py-2">
            <span className="min-w-0 break-words text-sm">{name}{person?.is_active === false ? ' (inactivo)' : ''}</span>
            <button type="button" className="ui-button ui-button--sm shrink-0" aria-label={`Desasignar a ${name}`} onClick={() => onChange(value.filter((item) => item !== personId))}>Quitar</button>
          </li>
        })}
      </ul>}
    {loading ? <p role="status" className="text-sm">Cargando usuarios…</p>
      : error ? <div role="alert" className="ui-feedback ui-feedback--error"><p>No se pudieron cargar los usuarios.</p>
        {onRetry && <button type="button" className="ui-button mt-2" onClick={onRetry}>Reintentar usuarios</button>}</div>
        : <div>
          <label htmlFor={id} className="ui-label">Asignar usuario</label>
          <select id={id} className="ui-field" value="" disabled={disabled || available.length === 0} onChange={(event) => {
            const selected = event.target.value
            if (selected === 'all') onChange([...new Set([...value, ...available.map((person) => person.id)])])
            else if (available.some((person) => person.id === selected)) onChange([...value, selected])
          }}>
            <option value="" disabled>Selecciona un usuario</option>
            {available.length > 0 && <option value="all">Todos</option>}
            {available.map((person) => <option key={person.id} value={person.id}>{person.full_name || 'Sin nombre'} · {person.email}</option>)}
          </select>
          {available.length === 0 && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{users.some((person) => person.is_active) ? 'Todos los usuarios disponibles ya están asignados.' : 'No hay usuarios activos disponibles.'}</p>}
        </div>}
  </fieldset>
}
