import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const person = z.object({ id: z.guid().nullable(), full_name: z.string().nullable() })
const attachment = z.object({
  id: z.guid(), file_name: z.string(), mime_type: z.string(), file_size: z.number().int().nonnegative(),
  created_at: z.string().nullable(),
})
const page = <T extends z.ZodType>(item: T) => z.object({
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(),
  next_offset: z.number().int().nonnegative().nullable(), items: z.array(item),
})
export const taskInput = z.object({
  task_id: z.guid().transform(value => value.toLowerCase()),
  comments_offset: z.number().int().min(0).max(2147483547).default(0),
  attachments_offset: z.number().int().min(0).max(2147483547).default(0),
  page_size: z.number().int().min(1).max(100).default(50),
}).strict()
const fields = {
  automatic_advance: z.boolean().optional(),
  task: z.object({ id: z.guid(), title: z.string(), description: z.string().nullable(),
    status: z.enum(['backlog', 'por_hacer', 'haciendo', 'en_revision', 'finalizadas']),
    priority: z.enum(['urgente', 'alta', 'normal', 'baja']), special_notes: z.string().nullable(),
    created_at: z.string().nullable(), updated_at: z.string().nullable() }),
  board: z.object({ id: z.guid(), name: z.string() }),
  assignees: z.array(person),
  comments: page(z.object({ id: z.guid(), body: z.string(), author: person,
    created_at: z.string().nullable(), updated_at: z.string().nullable() })),
}
export const rawTaskSchema = z.object({ ...fields, attachments: page(attachment.extend({ file_url: z.string() })) })
export const taskOutput = z.object({ ...fields, attachments: page(attachment.extend({
  download_url: z.string().url().nullable(), expires_at: z.string().nullable(), download_error: z.string().nullable(),
})), workflow: z.object({ next_tool: z.literal('start_task'), guidance: z.string() }).optional() })
export type TaskInput = z.infer<typeof taskInput>
export type RawTask = z.infer<typeof rawTaskSchema>
export type TaskResult = z.infer<typeof taskOutput>

export class TaskError extends Error {
  constructor(public code: string) { super('Task query failed') }
}

export function tokenClient(url: string, key: string, token: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// A metadata URL is user-controlled. Never let it select an arbitrary host,
// bucket or another task's object for the privileged, server-only signer.
export function attachmentPath(fileUrl: string, supabaseUrl: string, taskId: string): string | null {
  try {
    const url = new URL(fileUrl)
    if (url.origin !== new URL(supabaseUrl).origin || url.search || url.hash || url.username || url.password) return null
    const prefix = '/storage/v1/object/public/task-attachments/'
    if (!url.pathname.startsWith(prefix)) return null
    const path = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!path.startsWith(`${taskId}/`) || path.split('/').length !== 2
      || !path.split('/')[1] || /[\\%?#]/.test(path) || Array.from(path).some(char => char.charCodeAt(0) < 32)
      || path.split('/').some(part => part === '.' || part === '..')) return null
    return path
  } catch { return null }
}

export async function addDownloads(raw: RawTask, supabaseUrl: string,
  sign: (path: string, seconds: number) => Promise<string>): Promise<TaskResult> {
  // Bound concurrency even for pages with 100 attachments.
  const items: TaskResult['attachments']['items'] = []
  const startedAt = Date.now()
  const convert = async (entry: RawTask['attachments']['items'][number]) => {
    const { file_url, ...metadata } = entry
    const path = attachmentPath(file_url, supabaseUrl, raw.task.id)
    let download_url: string | null
    let expires_at: string | null = null
    let download_error: string | null = null
    try {
      if (!path || Date.now() - startedAt > 15_000) throw new Error('Unsafe, legacy or timed-out path')
      const issuedAt = Date.now()
      download_url = await sign(path, 60)
      const signed = new URL(download_url)
      if (signed.origin !== new URL(supabaseUrl).origin) throw new Error('Unexpected signing origin')
      expires_at = new Date(issuedAt + 60_000).toISOString()
    } catch {
      download_url = null
      download_error = 'No se pudo generar un enlace seguro para este adjunto. Puede estar ausente o usar una ruta antigua. Consulta el archivo desde el tablero.'
    }
    return { ...metadata, download_url, expires_at, download_error }
  }
  for (let offset = 0; offset < raw.attachments.items.length; offset += 5) {
    items.push(...await Promise.all(raw.attachments.items.slice(offset, offset + 5).map(convert)))
  }
  return taskOutput.parse({ ...raw, attachments: { ...raw.attachments, items }, workflow: {
    next_tool: 'start_task',
    guidance: 'Consulta todas las páginas y estudia los adjuntos relevantes. Aclara dudas esenciales; si no puedes completar el contexto, detente. ' +
      (raw.automatic_advance ? 'Ambas autorizaciones vigentes: puedes usar start_task con authorization_mode=automatic sin aceptación adicional ni user_approved.'
        : 'Obtén aceptación explícita antes de iniciar; usa user_approved=true solo si ocurrió.') +
      ' Usa task.id y task.updated_at como task_id y expected_updated_at, y un request_id UUID nuevo. La consulta no cambia el estado.',
  } })
}
