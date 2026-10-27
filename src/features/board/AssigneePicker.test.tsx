import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AssigneeProfile } from '@/types'
import { AssigneePicker } from './AssigneePicker'

export const people: AssigneeProfile[] = [
  { id: 'person-a', full_name: 'Ana Equipo', email: 'ana@example.test', avatar_url: null, role: 'usuario', is_active: true },
  { id: 'person-b', full_name: 'Bruno Equipo', email: 'bruno@example.test', avatar_url: null, role: 'invitado', is_active: true },
]

describe('Selector de responsables', () => {
  it('retira las personas seleccionadas del dropdown y las devuelve al desasignarlas', async () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([])
      return <AssigneePicker users={people} value={value} onChange={setValue} />
    }
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText('Asignar usuario'), 'person-a')
    expect(screen.queryByRole('option', { name: /Ana Equipo/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Asignar usuario'), 'person-b')
    const selected = within(screen.getByRole('list', { name: 'Usuarios seleccionados' }))
    expect(selected.getAllByRole('listitem')).toHaveLength(2)
    expect(within(selected.getByRole('img', { name: 'Foto de Ana Equipo' })).getByText('A')).toBeInTheDocument()
    expect(screen.getByLabelText('Asignar usuario')).toBeDisabled()
    await user.click(selected.getByRole('button', { name: 'Desasignar a Ana Equipo' }))
    await user.click(screen.getByRole('button', { name: 'Desasignar a Bruno Equipo' }))
    expect(screen.getByText('Sin usuarios asignados.')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Ana Equipo/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Bruno Equipo/ })).toBeInTheDocument()
  })
  it('muestra la foto del responsable seleccionado cuando está disponible', () => {
    const person = { ...people[0], avatar_url: 'https://example.test/ana.png' }
    render(<AssigneePicker users={[person]} value={[person.id]} onChange={vi.fn()} />)

    const avatar = screen.getByRole('img', { name: 'Foto de Ana Equipo' })
    expect(avatar.querySelector('img')).toHaveAttribute('src', person.avatar_url)
  })
  it('Todos añade los activos restantes sin duplicar ni retirar asignados inactivos', async () => {
    const inactive = { ...people[1], id: 'inactive', full_name: 'Inactivo', is_active: false }
    function Harness() {
      const [value, setValue] = useState<string[]>([inactive.id, people[0].id])
      return <AssigneePicker users={[...people, inactive]} value={value} onChange={setValue} />
    }
    render(<Harness />)
    await userEvent.selectOptions(screen.getByLabelText('Asignar usuario'), 'all')
    expect(screen.getByRole('list', { name: 'Usuarios seleccionados' }).children).toHaveLength(3)
    expect(screen.getByText('Inactivo (inactivo)')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Todos' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Asignar usuario')).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Desasignar a Ana Equipo' }))
    await userEvent.selectOptions(screen.getByLabelText('Asignar usuario'), 'all')
    expect(screen.getByRole('list', { name: 'Usuarios seleccionados' }).children).toHaveLength(3)
  })
  it('conserva responsables inactivos y permite retirarlos sin ofrecerlos para nuevas asignaciones', async () => {
    const inactive = { ...people[0], is_active: false }
    const change = vi.fn()
    render(<AssigneePicker users={[inactive, people[1]]} initialAssignees={[inactive]} value={[inactive.id]} onChange={change} />)
    expect(screen.getByText('Ana Equipo (inactivo)')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ana Equipo/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desasignar a Ana Equipo' }))
    expect(change).toHaveBeenCalledWith([])
  })
  it('distingue carga, error con reintento y lista vacía', async () => {
    const retry = vi.fn()
    const props = { value: [], onChange: vi.fn(), onRetry: retry }
    const { rerender } = render(<AssigneePicker {...props} loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando usuarios')
    rerender(<AssigneePicker {...props} error />)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar usuarios' }))
    expect(retry).toHaveBeenCalledOnce()
    rerender(<AssigneePicker {...props} />)
    expect(screen.getByText('No hay usuarios activos disponibles.')).toBeInTheDocument()
    rerender(<AssigneePicker {...props} users={people} />)
    expect(screen.getByLabelText('Asignar usuario')).toBeEnabled()
    expect(screen.getByRole('option', { name: /ana@example.test/ })).toBeInTheDocument()
  })
})
