import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getStorageObjectPath } from '@/lib/storage'
import type { AssigneeProfile, Board } from '@/types'

type BoardRow = { id: string; name: string; is_active: boolean; pending_count: number | string; created_at: string }
const boardDataPageSize = 500
const storageRemovalBatchSize = 100

function boardError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}

export async function fetchBoards(): Promise<Board[]> {
  // The RPC applies the same visibility as RLS and adds the pending task count.
  const { data, error } = await supabase.rpc('list_boards_with_pending_counts')
  if (error) throw error
  return (data ?? []).map((row: BoardRow) => ({
    id: String(row.id),
    name: String(row.name),
    is_active: Boolean(row.is_active),
    pending_count: Number(row.pending_count ?? 0),
    created_at: String(row.created_at),
  }))
}

export function useBoards() {
  return useQuery({ queryKey: ['boards'], queryFn: fetchBoards, staleTime: 0, refetchInterval: 30_000 })
}

export function useCreateBoard() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('boards').insert({ name: name.trim() }).select().single()
      if (error) throw error
      return data as Board
    },
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['boards'] }) },
  })
}

export function useRenameBoard() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, name }: { boardId: string; name: string }) => renameBoard(boardId, name),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['boards'] }) },
  })
}

export async function renameBoard(boardId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_board', { p_board_id: boardId, p_name: name.trim() })
  if (error) throw error
}

export function useSetBoardActive() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, active }: { boardId: string; active: boolean }) => setBoardActive(boardId, active),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['boards'] }) },
  })
}

export async function setBoardActive(boardId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_board_active', { p_board_id: boardId, p_active: active })
  if (error) throw error
}

async function fetchBoardAttachmentPaths(boardId: string): Promise<string[]> {
  const paths: string[] = []

  for (let taskOffset = 0; ; taskOffset += boardDataPageSize) {
    const { data: tasks, error: tasksError } = await supabase.from('tasks')
      .select('id').eq('board_id', boardId).order('id')
      .range(taskOffset, taskOffset + boardDataPageSize - 1)
    if (tasksError) throw tasksError

    const taskIds = (tasks ?? []).map((task) => task.id as string)
    for (let taskStart = 0; taskStart < taskIds.length; taskStart += storageRemovalBatchSize) {
      const taskBatch = taskIds.slice(taskStart, taskStart + storageRemovalBatchSize)
      for (let attachmentOffset = 0; ; attachmentOffset += boardDataPageSize) {
        const { data: attachments, error: attachmentsError } = await supabase.from('task_attachments')
          .select('file_url').in('task_id', taskBatch).order('id')
          .range(attachmentOffset, attachmentOffset + boardDataPageSize - 1)
        if (attachmentsError) throw attachmentsError

        for (const attachment of attachments ?? []) {
          const path = getStorageObjectPath(attachment.file_url as string)
          if (!path) throw boardError('BOARD_ATTACHMENT_PATH_INVALID', 'No se pudo identificar la ruta de un archivo adjunto.')
          paths.push(path)
        }

        if (!attachments || attachments.length < boardDataPageSize) break
      }
    }

    if (!tasks || tasks.length < boardDataPageSize) return paths
  }
}

export async function deleteInactiveBoard(boardId: string): Promise<void> {
  // Check before touching Storage; the database RPC below repeats this guard
  // and is the authoritative protection against direct or stale clients.
  const { data: board, error: boardErrorFromSupabase } = await supabase.from('boards')
    .select('is_active').eq('id', boardId).maybeSingle()
  if (boardErrorFromSupabase) throw boardErrorFromSupabase
  if (!board) throw boardError('P0002', 'El tablero ya no existe.')
  if (board.is_active) throw boardError('55000', 'Solo se pueden eliminar tableros desactivados.')

  const paths = [...new Set(await fetchBoardAttachmentPaths(boardId))]
  for (let offset = 0; offset < paths.length; offset += storageRemovalBatchSize) {
    const { error } = await supabase.storage.from('task-attachments')
      .remove(paths.slice(offset, offset + storageRemovalBatchSize))
    if (error) {
      throw Object.assign(new Error('Falló la eliminación de archivos adjuntos.'), {
        code: 'BOARD_ATTACHMENTS_DELETE_FAILED',
        cause: error,
      })
    }
  }

  const { error } = await supabase.rpc('delete_inactive_board', { p_board_id: boardId })
  if (error) {
    if (paths.length) {
      throw Object.assign(new Error(error.message), {
        code: 'BOARD_DELETE_FAILED_AFTER_STORAGE',
        originalCode: error.code,
        cause: error,
      })
    }
    throw error
  }
}

export function useDeleteBoard() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (boardId: string) => deleteInactiveBoard(boardId),
    onSuccess: (_data, boardId) => {
      cache.removeQueries({ queryKey: ['tasks', boardId] })
      cache.removeQueries({ queryKey: ['comments'] })
      cache.removeQueries({ queryKey: ['attachments'] })
      cache.removeQueries({ queryKey: ['task-image-previews'] })
      void cache.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export async function fetchBoardMembers(boardId: string): Promise<AssigneeProfile[]> {
  const members: AssigneeProfile[] = []
  const pageSize = 500
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from('board_members')
      .select('profiles(id, full_name, email, avatar_url, role, is_active)').eq('board_id', boardId)
      .order('profile_id').range(start, start + pageSize - 1)
    if (error) throw error
    members.push(...(data ?? []).flatMap((row) => row.profiles ? [row.profiles as unknown as AssigneeProfile] : []))
    if (!data || data.length < pageSize) return members
  }
}

export function useBoardMembers(boardId: string) {
  return useQuery({
    queryKey: ['board-members', boardId], staleTime: 0,
    queryFn: () => fetchBoardMembers(boardId),
  })
}

export function useSetBoardMembers() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async ({ boardId, profileIds }: { boardId: string; profileIds: string[] }) => {
      const { error } = await supabase.rpc('set_board_members', { p_board_id: boardId, p_profile_ids: [...new Set(profileIds)] })
      if (error) throw error
    },
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['board-members'] }) },
  })
}

export async function moveTaskToBoard(taskId: string, boardId: string) {
  const { error } = await supabase.rpc('move_task_to_board', { p_task_id: taskId, p_board_id: boardId })
  if (error) throw error
}

export function useMoveTaskToBoard() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, boardId }: { taskId: string; boardId: string }) => moveTaskToBoard(taskId, boardId),
    onSuccess: async () => {
      // Drop task-scoped content after a transfer; its access may have changed.
      cache.removeQueries({ queryKey: ['comments'] })
      cache.removeQueries({ queryKey: ['attachments'] })
      cache.removeQueries({ queryKey: ['task-image-previews'] })
      await cache.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
