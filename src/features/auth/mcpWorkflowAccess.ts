import { z } from 'zod'
import { supabase } from '@/lib/supabase'

export const permissionLabels = {
  read_tasks: 'Leer contexto y comentarios de tareas',
  read_attachments: 'Leer archivos de texto, imágenes y otros adjuntos',
  start_task: 'Iniciar tareas en Haciendo',
  comment_task: 'Publicar comentarios de trabajo',
  review_task: 'Enviar tareas a En revisión tras tu validación',
} as const
export type WorkflowPermission = keyof typeof permissionLabels
const accessSchema = z.array(z.object({ client_id: z.guid(), permissions: z.array(z.enum([
  'read_tasks', 'read_attachments', 'start_task', 'comment_task', 'review_task',
])) }))
export type WorkflowAccess = z.infer<typeof accessSchema>[number]

const requestSchema = z.object({ authorized: z.boolean(), details: z.object({
  authorization_id: z.string(), client: z.object({ id: z.guid(), name: z.string() }),
  user: z.object({ id: z.guid(), email: z.string() }), redirect_uri: z.string(), scope: z.string(),
}) })
export async function workflowAuthorizationDetails(authorizationId: string) {
  const { data, error } = await supabase.rpc('mcp_workflow_authorization_details', { p_authorization_id: authorizationId })
  const parsed = requestSchema.safeParse(data)
  if (error || !parsed.success) throw new Error('No se pudo comprobar la autorización ampliada.')
  return parsed.data
}

export async function authorizeWorkflow(authorizationId: string): Promise<void> {
  const { error } = await supabase.rpc('mcp_authorize_workflow', { p_authorization_id: authorizationId })
  if (error) throw new Error('No se pudieron autorizar los permisos MCP. No se continuará al cliente.')
}
export async function listWorkflowAccess(): Promise<WorkflowAccess[]> {
  const { data, error } = await supabase.rpc('mcp_list_workflow_access')
  const parsed = accessSchema.safeParse(data)
  if (error || !parsed.success) throw new Error('No se pudieron comprobar los permisos. Puede faltar la migración del MCP.')
  return parsed.data
}
export async function revokeWorkflowPermission(clientId: string, permission: WorkflowPermission | 'all'): Promise<void> {
  const { error } = await supabase.rpc('mcp_revoke_workflow_permission', { p_client_id: clientId, p_permission: permission })
  if (error) throw new Error('No se pudo retirar el permiso. Inténtalo de nuevo.')
}
