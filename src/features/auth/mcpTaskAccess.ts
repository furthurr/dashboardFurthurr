import { supabase } from '@/lib/supabase'

export interface TaskReadAccess { client_id: string; enabled: boolean; needs_authorization: boolean }

export async function listTaskReadAccess(): Promise<TaskReadAccess[]> {
  const { data, error } = await supabase.rpc('mcp_list_task_read_access')
  if (error || !Array.isArray(data) || data.some(item => !item || typeof item.client_id !== 'string' || typeof item.enabled !== 'boolean' || typeof item.needs_authorization !== 'boolean')) {
    throw new Error('No se pudieron comprobar los permisos de lectura de tareas. Puede faltar la migración del MCP.')
  }
  return data as TaskReadAccess[]
}

export async function setTaskReadAccess(clientId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('mcp_set_task_read_access', { p_client_id: clientId, p_enabled: enabled })
  if (error) throw new Error('No se pudo cambiar el permiso de lectura. Reintenta o vuelve a conectar el cliente MCP.')
}
