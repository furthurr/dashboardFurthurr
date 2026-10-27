import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getStorageObjectPath } from '@/lib/storage'
import { type TaskAttachment } from '@/types'

export interface TaskImagePreview {
  id: string
  fileName: string
  signedUrl: string
}

export async function fetchAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const attachments = (data || []) as TaskAttachment[]
  return Promise.all(attachments.map(async (attachment) => {
    const path = getStorageObjectPath(attachment.file_url)
    if (!path) throw new Error('Ruta de adjunto no válida')
    const { data: signed, error: signingError } = await supabase.storage.from('task-attachments').createSignedUrl(path, 60)
    if (signingError) throw signingError
    return { ...attachment, signed_url: signed.signedUrl }
  }))
}

export function useAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => (taskId ? fetchAttachments(taskId) : Promise.resolve([])),
    enabled: !!taskId,
    staleTime: 0,
    refetchInterval: 45_000,
  })
}

export async function renameAttachment(attachmentId: string, fileName: string): Promise<void> {
  const normalizedName = fileName.trim()
  if (!normalizedName) throw new Error('El nombre del adjunto no puede estar vacío')

  const { data, error } = await supabase
    .from('task_attachments')
    .update({ file_name: normalizedName })
    .eq('id', attachmentId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Adjunto no disponible o sin permisos')
}

export async function deleteAttachment(attachmentId: string, fileUrl: string): Promise<void> {
  const fileName = getStorageObjectPath(fileUrl)
  if (fileName) {
    const { error } = await supabase.storage.from('task-attachments').remove([fileName])
    if (error) throw error
  }

  const { data, error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Adjunto no disponible o sin permisos')
}

export async function fetchTaskImagePreviews(taskIds: string[]): Promise<Record<string, TaskImagePreview[]>> {
  if (taskIds.length === 0) return {}

  const { data, error } = await supabase
    .from('task_attachments')
    .select('id, task_id, file_name, file_url, mime_type')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true })

  if (error) throw error

  const attachmentRows = (data || []) as Array<{
    id: string
    task_id: string
    file_name: string
    file_url: string
    mime_type: string
  }>
  const imageRows = attachmentRows
    .filter((attachment) => attachment.mime_type.toLowerCase().startsWith('image/'))
    .map((attachment) => ({ attachment, path: getStorageObjectPath(attachment.file_url) }))
    .filter((entry): entry is { attachment: typeof attachmentRows[number]; path: string } => entry.path !== null)

  if (imageRows.length === 0) return {}

  const { data: signedUrls, error: signedUrlError } = await supabase.storage
    .from('task-attachments')
    .createSignedUrls(imageRows.map(({ path }) => path), 60)

  if (signedUrlError) throw signedUrlError

  const previewsByTask: Record<string, TaskImagePreview[]> = {}
  imageRows.forEach(({ attachment }, index) => {
    const signedUrl = signedUrls?.[index]?.signedUrl
    if (!signedUrl) return

    const previews = previewsByTask[attachment.task_id] ?? []
    previews.push({ id: attachment.id, fileName: attachment.file_name, signedUrl })
    previewsByTask[attachment.task_id] = previews
  })

  return previewsByTask
}

export function useTaskImagePreviews(taskIds: string[]) {
  const normalizedTaskIds = [...new Set(taskIds)].sort()

  return useQuery({
    queryKey: ['task-image-previews', normalizedTaskIds],
    queryFn: () => fetchTaskImagePreviews(normalizedTaskIds),
    enabled: normalizedTaskIds.length > 0,
    staleTime: 0,
    refetchInterval: 45_000,
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
      const fileName = `${taskId}/${crypto.randomUUID()}.${fileExt?.replace(/[^a-zA-Z0-9]/g, '') || 'bin'}`

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
      queryClient.invalidateQueries({ queryKey: ['task-image-previews'] })
    },
  })
}

export function useRenameAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ attachmentId, fileName }: { attachmentId: string; fileName: string }) =>
      renameAttachment(attachmentId, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
      queryClient.invalidateQueries({ queryKey: ['task-image-previews'] })
    },
  })
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ attachmentId, fileUrl }: { attachmentId: string; fileUrl: string }) =>
      deleteAttachment(attachmentId, fileUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
      queryClient.invalidateQueries({ queryKey: ['task-image-previews'] })
    },
  })
}
