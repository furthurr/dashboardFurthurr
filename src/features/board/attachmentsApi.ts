import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type TaskAttachment } from '@/types'

async function fetchAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as TaskAttachment[]
}

export function useAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => (taskId ? fetchAttachments(taskId) : Promise.resolve([])),
    enabled: !!taskId,
  })
}

export function useUploadAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId,
      uploadedBy,
      file,
    }: {
      taskId: string
      uploadedBy: string
      file: File
    }) => {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName)

      const { data, error } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          uploaded_by: uploadedBy,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.taskId] })
    },
  })
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ attachmentId, fileUrl }: { attachmentId: string; fileUrl: string }) => {
      const fileName = fileUrl.split('/').pop()
      if (fileName) {
        await supabase.storage.from('task-attachments').remove([fileName])
      }

      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
    },
  })
}