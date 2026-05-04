import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type TaskWithAssignees, type TaskStatus, type TaskPriority } from '@/types'

async function fetchTasks(): Promise<TaskWithAssignees[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_assignees(profile_id, profiles(full_name, avatar_url, role))
    `)
    .order('position')

  if (error) throw error

  return (data || []).map((task: Record<string, unknown>) => ({
    ...task,
    assignees: ((task.task_assignees as Array<{ profiles: unknown }>) || []).map(
      (ta) => ta.profiles
    ),
  })) as TaskWithAssignees[]
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
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
      description,
      status,
      priority,
      createdBy,
    }: {
      title: string
      description?: string
      status: TaskStatus
      priority: TaskPriority
      createdBy: string
    }) => {
      const { data: maxPosData } = await supabase
        .from('tasks')
        .select('position')
        .eq('status', status)
        .order('position', { ascending: false })
        .limit(1)

      const newPosition = maxPosData && maxPosData.length > 0 ? (maxPosData[0].position as number) + 1 : 0

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description: description || null,
          status,
          priority,
          created_by: createdBy,
          position: newPosition,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
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

export function useSwapTaskPosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId1,
      position1,
      taskId2,
      position2,
    }: {
      taskId1: string
      position1: number
      taskId2: string
      position2: number
    }) => {
      const { error: error1 } = await supabase
        .from('tasks')
        .update({ position: position1 })
        .eq('id', taskId2)

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('tasks')
        .update({ position: position2 })
        .eq('id', taskId1)

      if (error2) throw error2
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}