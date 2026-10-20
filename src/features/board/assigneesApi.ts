import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AssigneeProfile } from '@/types'

export async function fetchAssignableUsers(): Promise<AssigneeProfile[]> {
  const users: AssigneeProfile[] = []
  const size = 500
  for (let start = 0; ; start += size) {
    const { data, error } = await supabase.from('profiles')
      .select('id, full_name, email, avatar_url, role, is_active')
      .eq('is_active', true).order('full_name').order('id').range(start, start + size - 1)
    if (error) throw error
    users.push(...(data as AssigneeProfile[] ?? []))
    if (!data || data.length < size) return users
  }
}

export function useAssignableUsers(enabled: boolean) {
  return useQuery({ queryKey: ['assignable-users'], queryFn: fetchAssignableUsers, enabled, staleTime: 0 })
}
