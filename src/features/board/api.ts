import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type TaskWithAssignees, type TaskStatus, type TaskPriority, type AssigneeProfile, type Task } from '@/types'

async function fetchCommentCountsFromComments(taskIds: string[]): Promise<Map<string, number> | undefined> {
  const pageSize = 1000
  const counts = new Map(taskIds.map((taskId) => [taskId, 0]))

  for (let offset = 0; ; offset += pageSize) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('task_id')
        .in('task_id', taskIds)
        .range(offset, offset + pageSize - 1)

      if (error || !data) return undefined

      for (const comment of data) {
        counts.set(comment.task_id, (counts.get(comment.task_id) ?? 0) + 1)
      }

      if (data.length < pageSize) return counts
    } catch {
      return undefined
    }
  }
}

export async function fetchTasks(boardId: string): Promise<TaskWithAssignees[]> {
  const tasksResult = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees(profile_id, profiles(id, full_name, email, avatar_url, role, is_active))
    `)
    .eq('board_id', boardId)
    .order('position')

  if (tasksResult.error) throw tasksResult.error

  const taskRows = tasksResult.data ?? []
  if (taskRows.length === 0) return []

  const taskIds = taskRows.map((task) => task.id)
  let commentCounts: Map<string, number> | undefined
  try {
    const { data, error } = await supabase
      .from('tasks_with_stats')
      .select('id, comment_count')
      // Older deployed views were created before tasks.board_id existed, so they
      // can expose id/counts without exposing board_id for PostgREST filtering.
      .in('id', taskIds)

    if (!error) {
      commentCounts = new Map((data ?? []).map((stat) => [stat.id, Number(stat.comment_count)]))
    }
  } catch {
    // A stats-view failure must not make the whole board unavailable.
  }
  commentCounts ??= await fetchCommentCountsFromComments(taskIds)

  return taskRows.map((task: Record<string, unknown>) => ({
    ...task,
    assignees: ((task.task_assignees as Array<{ profiles: unknown }>) || []).map(
      (ta) => ta.profiles
    ).filter(Boolean),
    ...(commentCounts
      ? { comment_count: commentCounts.get(task.id as string) ?? 0 }
      : {}),
  })) as TaskWithAssignees[]
}

export function useTasks(boardId: string) {
  return useQuery({
    queryKey: ['tasks', boardId],
    queryFn: () => fetchTasks(boardId),
    staleTime: 0,
    refetchInterval: 30_000,
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskId, status, position }: { taskId: string; status: TaskStatus; position: number }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status, position })
        .eq('id', taskId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      title,
      boardId,
      description,
      status,
      priority,
      assigneeIds = [],
    }: {
      title: string
      boardId: string
      description?: string
      status: TaskStatus
      priority: TaskPriority
      createdBy: string
      assigneeIds?: string[]
    }) => {
      // Ownership is derived from auth.uid() in SQL, never from client-supplied createdBy.
      return createTaskWithAssignees({ boardId, title, description, status, priority, assigneeIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export async function createTaskWithAssignees(data: {
  boardId: string; title: string; description?: string; status: TaskStatus; priority: TaskPriority; assigneeIds: string[]
}): Promise<Task> {
  const { data: task, error } = await supabase.rpc('create_task_with_assignees', {
    p_board_id: data.boardId,
    p_title: data.title, p_description: data.description || null, p_status: data.status,
    p_priority: data.priority, p_assignee_ids: [...new Set(data.assigneeIds)],
  })
  if (error) throw error
  return task as Task
}

export async function setTaskAssignees(taskId: string, assigneeIds: string[]): Promise<AssigneeProfile[]> {
  const { data, error } = await supabase.rpc('set_task_assignees', {
    p_task_id: taskId, p_assignee_ids: [...new Set(assigneeIds)],
  })
  if (error) throw error
  return data as AssigneeProfile[]
}

export function useSetTaskAssignees() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, assigneeIds }: { taskId: string; assigneeIds: string[] }) => setTaskAssignees(taskId, assigneeIds),
    onSuccess: (assignees, { taskId }) => {
      queryClient.setQueriesData<TaskWithAssignees[]>({ queryKey: ['tasks'] }, (tasks) => tasks?.map((task) => task.id === taskId ? { ...task, assignees } : task))
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId,
      title,
      description,
      status,
      priority,
    }: {
      taskId: string
      title: string
      description?: string | null
      status: TaskStatus
      priority: TaskPriority
    }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ title, description, status, priority })
        .eq('id', taskId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useUpdateTaskPositions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Array<{ taskId: string; position: number }>) => {
      await Promise.all(
        updates.map(async ({ taskId, position }) => {
          const { error } = await supabase
            .from('tasks')
            .update({ position })
            .eq('id', taskId)

          if (error) throw error
        })
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
