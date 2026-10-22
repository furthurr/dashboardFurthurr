import { Link, useParams } from 'react-router-dom'
import { useBoards } from './api'
import { BoardPage } from '@/features/board/BoardPage'

export function BoardRoute() {
  const { boardId } = useParams()
  const boards = useBoards()
  if (boards.isLoading) return <main className="board-shell p-8"><p role="status">Cargando tablero…</p></main>
  if (boards.error) return <main className="board-shell p-8"><p role="alert">No se pudo comprobar el acceso al tablero.</p><button className="ui-button" onClick={() => { void boards.refetch() }}>Reintentar</button><Link className="ui-button" to="/boards">Volver a tableros</Link></main>
  const board = boards.data?.find((item) => item.id === boardId)
  if (!board) return <main className="board-shell p-8"><p role="alert">El tablero no existe o no tienes acceso.</p><Link className="ui-button mt-4" to="/boards">Volver a tableros</Link></main>
  return <BoardPage key={board.id} boardId={board.id} boardName={board.name} boards={boards.data ?? []} />
}
