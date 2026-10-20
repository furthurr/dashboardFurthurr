import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export type ManagedUser = Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'is_active'>
export type UserAction =
  | { action: 'create'; fullName: string; email: string; password: string }
  | { action: 'password'; userId: string; password: string }
  | { action: 'rename'; userId: string; fullName: string }
  | { action: 'set-active'; userId: string; active: boolean }

export async function adminRequest<T>(body: UserAction | { action: 'list'; page: number }): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let message = 'No se pudo contactar con la administración de usuarios. Comprueba la conexión y el despliegue de la función.'
    if (error.context instanceof Response) {
      try {
        const payload = await error.context.json()
        if (typeof payload.error === 'string') message = payload.error
      } catch { /* Keep a safe fallback for non-JSON gateway errors. */ }
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export function listUsers(page: number) {
  return adminRequest<{ users: ManagedUser[]; total: number; pageSize: number }>({ action: 'list', page })
}
