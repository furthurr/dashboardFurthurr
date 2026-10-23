import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type TaskWithAssignees, type TaskStatus, type TaskPriority, type AssigneeProfile, type Task } from '@/types'

export async function fetchTasks(boardId: string): Promise<TaskWithAssignees[]> {
  const [tasksResult, statsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        *,
        task_assignees(profile_id, profiles(id, full_name, email, avatar_url, role, is_active))
      `)
      .eq('board_id', boardId)
      .order('position'),
    supabase
      .from('tasks_with_stats')
      .select('id, comment_count')
      .eq('board_id', boardId),
  ])

  if (tasksResult.error) throw tasksResult.error
  if (statsResult.error) throw statsResult.error

  const commentCounts = new Map<string, number>()
  for (const stat of statsResult.data ?? []) {
    commentCounts.set(stat.id, Number(stat.comment_count))
  }

  return (tasksResult.data || []).map((task: Record<string, unknown>) => ({
    ...task,
    assignees: ((task.task_assignees as Array<{ profiles: unknown }>) || []).map(
      (ta) => ta.profiles
    ).filter(Boolean),
    comment_count: commentCounts.get(task.id as string) ?? 0,
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
