import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AssigneeProfile, Board } from '@/types'

export async function fetchBoards(): Promise<Board[]> {
  const { data, error } = await supabase.from('boards').select('*').order('name')
  if (error) throw error
  return data ?? []
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
