import { supabase } from '@/lib/supabase'

export async function getTaskAutomation(taskId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mcp_get_task_automation', { p_task_id: taskId })
  if (error || typeof data !== 'boolean') throw new Error('No se pudo consultar la automatización.')
  return data
}
export async function setTaskAutomation(taskId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('mcp_set_task_automation', { p_task_id: taskId, p_enabled: enabled })
  if (error) throw new Error('No se pudo guardar la automatización.')
}
export async function setConnectionAutomation(clientId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('mcp_set_automation_consent', { p_client_id: clientId, p_enabled: enabled })
  if (error) throw new Error('No se pudo guardar la autorización automática.')
}
