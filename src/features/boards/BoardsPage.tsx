import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AssigneeProfile, Board } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'
import { AccountMenu } from '@/shared/ui/AccountMenu'
import { Dialog } from '@/shared/ui/Dialog'
import { AssigneePicker } from '@/features/board/AssigneePicker'
import { useAssignableUsers } from '@/features/board/assigneesApi'
import { useBoardMembers, useBoards, useCreateBoard, useSetBoardMembers } from './api'

export function BoardsPage() {
  const { profile } = useAuth()
  const boards = useBoards()
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState<Board | null>(null)
  const admin = profile?.role === 'admin'
  return <main className="board-shell">
    <header className="board-header">
      <div><p className="text-xs text-[var(--color-text-muted)]">Dashboard Furthurr</p><h1>Tableros</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Selecciona el tablero en el que vas a trabajar.</p></div>
      <div className="flex flex-wrap gap-2">{admin && <button className="ui-button ui-button--primary" onClick={() => setCreating(true)}>Crear tablero</button>}<AccountMenu /></div>
    </header>
    <section className="p-4 sm:p-8" aria-label="Tableros disponibles">
      {boards.isLoading ? <p role="status" className="ui-feedback">Cargando tableros…</p>
        : boards.error ? <div className="ui-feedback ui-feedback--error"><p role="alert">No se pudieron cargar los tableros.</p><button className="ui-button mt-3" onClick={() => { void boards.refetch() }}>Reintentar</button></div>
          : !boards.data?.length ? <div className="ui-empty"><strong>No tienes tableros asignados</strong><p>Solicita a un administrador que te asigne a un tablero.</p></div>
            : <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boards.data.map((board) => <li key={board.id} className="ui-list-card min-w-0 space-y-4">
                <Link to={`/board/${board.id}`} className="ui-button ui-button--secondary block w-full justify-start whitespace-normal break-words text-left"><span className="text-lg font-semibold">{board.name}</span></Link>
                {admin && <button className="ui-button ui-button--sm" aria-label={`Gestionar miembros de ${board.name}`} onClick={() => setManaging(board)}>Gestionar miembros</button>}
              </li>)}
            </ul>}
    </section>
    {creating && <CreateBoardDialog onClose={() => setCreating(false)} />}
    {managing && admin && <MembersDialog board={managing} onClose={() => setManaging(null)} />}
  </main>
}

function CreateBoardDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const create = useCreateBoard()
  const lock = useRef(false)
  const [error, setError] = useState('')
  return <Dialog title="Crear tablero" onClose={onClose} busy={create.isPending}>
    <form className="dialog-body space-y-4" onSubmit={async (event) => {
      event.preventDefault()
      if (lock.current || !name.trim()) return
      lock.current = true
      setError('')
      try { await create.mutateAsync(name); onClose() }
      catch (cause) { setError((cause as { code?: string }).code === '23505' ? 'Ya existe un tablero con ese nombre.' : 'No se pudo crear el tablero. Inténtalo de nuevo.') }
      finally { lock.current = false }
    }}>
      {error && <p role="alert" className="ui-feedback ui-feedback--error">{error}</p>}
      <label className="ui-label" htmlFor="board-name">Nombre del tablero</label>
      <input id="board-name" className="ui-field" maxLength={120} required value={name} disabled={create.isPending} onChange={(event) => setName(event.target.value)} />
      <p className="text-sm text-[var(--color-text-muted)]">Se creará sin miembros. Puedes asignarlos desde «Gestionar miembros».</p>
      <div className="dialog-footer"><button type="button" className="ui-button" disabled={create.isPending} onClick={onClose}>Cancelar</button>
        <button className="ui-button ui-button--primary" disabled={create.isPending || !name.trim()}>{create.isPending ? 'Creando…' : 'Crear tablero'}</button></div>
    </form>
  </Dialog>
}

function MembersDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const members = useBoardMembers(board.id)
  const users = useAssignableUsers(true)
  if (members.isLoading) return <Dialog title={`Miembros de ${board.name}`} onClose={onClose}><p role="status" className="dialog-body">Cargando miembros…</p></Dialog>
  if (members.error) return <Dialog title={`Miembros de ${board.name}`} onClose={onClose}><div className="dialog-body"><p role="alert">No se pudieron cargar los miembros.</p><button className="ui-button" onClick={() => { void members.refetch() }}>Reintentar</button></div></Dialog>
  return <MembersEditor key={board.id} board={board} initial={members.data ?? []} users={users} onClose={onClose} />
}

function MembersEditor({ board, initial, users, onClose }: { board: Board; initial: AssigneeProfile[]; users: ReturnType<typeof useAssignableUsers>; onClose: () => void }) {
  const [ids, setIds] = useState(initial.map((person) => person.id))
  const save = useSetBoardMembers()
  const lock = useRef(false)
  return <Dialog title={`Miembros de ${board.name}`} onClose={onClose} busy={save.isPending}>
    <div className="dialog-body space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">Solo los miembros y los administradores pueden acceder. Los responsables de tareas no reciben acceso automáticamente.</p>
      {save.error && <p role="alert" className="ui-feedback ui-feedback--error">No se pudieron guardar los miembros. Tus cambios se conservan.</p>}
      <AssigneePicker value={ids} onChange={setIds} initialAssignees={initial} users={users.data} loading={users.isLoading} error={!!users.error} onRetry={() => { void users.refetch() }} disabled={save.isPending} />
    </div>
    <footer className="dialog-footer"><button className="ui-button" disabled={save.isPending} onClick={onClose}>Cancelar</button><button className="ui-button ui-button--primary" disabled={save.isPending} onClick={async () => {
      if (lock.current) return
      lock.current = true
      try { await save.mutateAsync({ boardId: board.id, profileIds: ids }); onClose() } catch { /* Keep the draft and show mutation error. */ } finally { lock.current = false }
    }}>{save.isPending ? 'Guardando…' : 'Guardar miembros'}</button></footer>
  </Dialog>
}
