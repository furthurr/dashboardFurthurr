import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type CommentWithAuthor } from '@/types'

async function fetchComments(taskId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles(id, full_name, avatar_url, role)
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as CommentWithAuthor[]
}

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => (taskId ? fetchComments(taskId) : Promise.resolve([])),
    enabled: !!taskId,
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId,
      authorId,
      body,
    }: {
      taskId: string
      authorId: string
      body: string
    }) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          author_id: authorId,
          body,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.taskId] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })
}