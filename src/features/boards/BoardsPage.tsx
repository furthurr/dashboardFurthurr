import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AssigneeProfile, Board } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'
import { AccountMenu } from '@/shared/ui/AccountMenu'
import { Dialog } from '@/shared/ui/Dialog'
import { AssigneePicker } from '@/features/board/AssigneePicker'
import { useAssignableUsers } from '@/features/board/assigneesApi'
import { useBoardMembers, useBoards, useCreateBoard, useRenameBoard, useSetBoardActive, useSetBoardMembers } from './api'

export function BoardsPage() {
  const { profile } = useAuth()
  const boards = useBoards()
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState<Board | null>(null)
  const [renaming, setRenaming] = useState<Board | null>(null)
  const [toggling, setToggling] = useState<Board | null>(null)
  const admin = profile?.role === 'admin'
  const activeBoards = boards.data?.filter((board) => board.is_active) ?? []
  const inactiveBoards = boards.data?.filter((board) => !board.is_active) ?? []
  return <main className="board-shell">
    <header className="board-header">
      <div><p className="text-xs text-[var(--color-text-muted)]">Dashboard Furthurr</p><h1>Tableros</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Selecciona el tablero en el que vas a trabajar.</p></div>
      <div className="flex flex-wrap gap-2">{admin && <button className="ui-button ui-button--primary" onClick={() => setCreating(true)}>Crear tablero</button>}<AccountMenu /></div>
    </header>
    <section className="space-y-8 p-4 sm:p-8" aria-label="Tableros disponibles">
      {boards.isLoading ? <p role="status" className="ui-feedback">Cargando tableros…</p>
        : boards.error ? <div className="ui-feedback ui-feedback--error"><p role="alert">No se pudieron cargar los tableros.</p><button className="ui-button mt-3" onClick={() => { void boards.refetch() }}>Reintentar</button></div>
          : !boards.data?.length ? <div className="ui-empty"><strong>No tienes tableros asignados</strong><p>Solicita a un administrador que te asigne a un tablero.</p></div>
            : <>
              <BoardSection title="Tableros activos" description="Tableros en los que puedes trabajar ahora mismo." boards={activeBoards}
                admin={admin} onManage={setManaging} onRename={setRenaming} onToggle={setToggling} />
              {admin && inactiveBoards.length > 0 && <BoardSection title="Tableros desactivados" description="Solo los administradores ven esta sección. Reactiva un tablero para devolverle el acceso a sus miembros." boards={inactiveBoards}
                admin={admin} onManage={setManaging} onRename={setRenaming} onToggle={setToggling} />}
            </>}
    </section>
    {creating && <CreateBoardDialog onClose={() => setCreating(false)} />}
    {managing && admin && <MembersDialog board={managing} onClose={() => setManaging(null)} />}
    {renaming && admin && <RenameBoardDialog board={renaming} onClose={() => setRenaming(null)} />}
    {toggling && admin && <ToggleBoardDialog board={toggling} onClose={() => setToggling(null)} />}
  </main>
}

function BoardSection({ title, description, boards, admin, onManage, onRename, onToggle }: {
  title: string
  description: string
  boards: Board[]
  admin: boolean
  onManage: (board: Board) => void
  onRename: (board: Board) => void
  onToggle: (board: Board) => void
}) {
  return <div className="space-y-4">
    <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-[var(--color-text-muted)]">{description}</p></div>
    {!boards.length ? <p className="ui-feedback">No hay tableros en esta sección.</p>
      : <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => <li key={board.id} className="ui-list-card min-w-0 space-y-4">
          <Link to={`/board/${board.id}`} className="ui-button ui-button--secondary block w-full justify-start whitespace-normal break-words text-left"><span className="text-lg font-semibold">{board.name}</span></Link>
          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">Tareas pendientes: <span className="ui-badge">{board.pending_count}</span></p>
          {admin && <div className="flex flex-wrap gap-2">
            <button className="ui-button ui-button--sm" aria-label={`Gestionar miembros de ${board.name}`} onClick={() => onManage(board)}>Gestionar miembros</button>
            <button className="ui-button ui-button--sm" aria-label={`Cambiar nombre de ${board.name}`} onClick={() => onRename(board)}>Cambiar nombre</button>
            <button className={board.is_active ? 'ui-button ui-button--sm ui-button--danger' : 'ui-button ui-button--sm'}
              aria-label={`${board.is_active ? 'Desactivar' : 'Activar'} ${board.name}`} onClick={() => onToggle(board)}>{board.is_active ? 'Desactivar' : 'Activar'}</button>
          </div>}
        </li>)}
      </ul>}
  </div>
}

function describeBoardError(cause: unknown, fallback: string): string {
  const error = cause as { code?: string; status?: number }
  if (error?.code === '23505') return 'Ya existe un tablero con ese nombre.'
  if (error?.code === '42501' || error?.status === 403) {
    return 'Supabase rechazó la operación por permisos. Comprueba que tu cuenta esté activa y tenga rol de administrador.'
  }
  if (error?.status === 401) return 'Tu sesión caducó. Cierra sesión e inicia sesión de nuevo.'
  if (error?.code === '22023' || error?.code === '23514') return 'El nombre no cumple las reglas del tablero. Usa entre 1 y 120 caracteres, sin espacios al inicio o al final.'
  if (error?.code === 'P0002') return 'El tablero ya no existe.'
  const code = error?.code ? ` (código ${error.code})` : ''
  return `${fallback}${code}. Comprueba la conexión e inténtalo de nuevo.`
}

export function getCreateBoardErrorMessage(cause: unknown): string {
  return describeBoardError(cause, 'No se pudo crear el tablero')
}

export function getBoardUpdateErrorMessage(cause: unknown): string {
  return describeBoardError(cause, 'No se pudo actualizar el tablero')
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
      catch (cause) { setError(getCreateBoardErrorMessage(cause)) }
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

function RenameBoardDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const [name, setName] = useState(board.name)
  const rename = useRenameBoard()
  const lock = useRef(false)
  const [error, setError] = useState('')
  return <Dialog title={`Cambiar nombre de ${board.name}`} onClose={onClose} busy={rename.isPending}>
    <form className="dialog-body space-y-4" onSubmit={async (event) => {
      event.preventDefault()
      if (lock.current || !name.trim()) return
      lock.current = true
      setError('')
      try { await rename.mutateAsync({ boardId: board.id, name }); onClose() }
      catch (cause) { setError(getBoardUpdateErrorMessage(cause)) }
      finally { lock.current = false }
    }}>
      {error && <p role="alert" className="ui-feedback ui-feedback--error">{error}</p>}
      <label className="ui-label" htmlFor="board-rename-name">Nombre del tablero</label>
      <input id="board-rename-name" className="ui-field" maxLength={120} required value={name} disabled={rename.isPending} onChange={(event) => setName(event.target.value)} />
      <p className="text-sm text-[var(--color-text-muted)]">El nombre debe ser único y tener entre 1 y 120 caracteres.</p>
      <div className="dialog-footer"><button type="button" className="ui-button" disabled={rename.isPending} onClick={onClose}>Cancelar</button>
        <button className="ui-button ui-button--primary" disabled={rename.isPending || !name.trim()}>{rename.isPending ? 'Guardando…' : 'Guardar nombre'}</button></div>
    </form>
  </Dialog>
}

function ToggleBoardDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const setActive = useSetBoardActive()
  const lock = useRef(false)
  const [error, setError] = useState('')
  const activating = !board.is_active
  return <Dialog title={`${activating ? 'Activar' : 'Desactivar'} ${board.name}`} onClose={onClose} busy={setActive.isPending}>
    <div className="dialog-body space-y-4">
      {error && <p role="alert" className="ui-feedback ui-feedback--error">{error}</p>}
      <p>{activating
        ? `Al activar «${board.name}» sus miembros recuperarán el acceso al tablero y a sus tareas.`
        : `Al desactivar «${board.name}» sus miembros dejarán de verlo y de acceder a sus tareas. No se borra ninguna tarea, comentario, adjunto ni membresía.`}</p>
    </div>
    <footer className="dialog-footer"><button className="ui-button" disabled={setActive.isPending} onClick={onClose}>Cancelar</button>
      <button className={activating ? 'ui-button ui-button--primary' : 'ui-button ui-button--danger'} disabled={setActive.isPending} onClick={async () => {
        if (lock.current) return
        lock.current = true
        setError('')
        try { await setActive.mutateAsync({ boardId: board.id, active: activating }); onClose() }
        catch (cause) { setError(getBoardUpdateErrorMessage(cause)) }
        finally { lock.current = false }
      }}>{setActive.isPending ? 'Guardando…' : activating ? 'Activar tablero' : 'Desactivar tablero'}</button></footer>
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
