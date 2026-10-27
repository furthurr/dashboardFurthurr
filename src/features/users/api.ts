import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export type ManagedUser = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'role' | 'is_active'>
export type UserAction =
  | { action: 'create'; fullName: string; email: string; password: string }
  | { action: 'password'; userId: string; password: string }
  | { action: 'rename'; userId: string; fullName: string }
  | { action: 'set-active'; userId: string; active: boolean }
  | { action: 'promote-admin'; userId: string }

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
  return adminRequest<{ users: ManagedUser[]; total: number; pageSize: number }>({ action: 'list', page }).then(async (result) => {
    // Older deployed admin-users functions may omit avatar_url from their projection.
    // Read only that field from profiles so the UI can still show existing photos.
    const missingAvatarField = result.users.some((account) => !Object.prototype.hasOwnProperty.call(account, 'avatar_url'))
    if (!missingAvatarField || result.users.length === 0) return result

    const { data, error } = await supabase.from('profiles')
      .select('id, avatar_url')
      .in('id', result.users.map((account) => account.id))
    if (error) throw error

    const avatarUrls = new Map((data ?? []).map((profile) => [profile.id, profile.avatar_url]))
    return {
      ...result,
      users: result.users.map((account) => ({
        ...account,
        avatar_url: avatarUrls.has(account.id) ? avatarUrls.get(account.id) ?? null : account.avatar_url ?? null,
      })),
    }
  })
}
