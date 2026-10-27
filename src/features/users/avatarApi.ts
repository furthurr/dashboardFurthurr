import { supabase } from '@/lib/supabase'

export const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function getAvatarFileError(file: File): string | null {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type as typeof AVATAR_ACCEPTED_TYPES[number])) {
    return 'La foto debe estar en formato JPG, PNG o WebP.'
  }
  if (file.size > MAX_AVATAR_FILE_SIZE) return 'La foto no puede superar los 2 MB.'
  return null
}

export async function uploadProfileAvatar(profileId: string, file: File): Promise<string> {
  const validationError = getAvatarFileError(file)
  if (validationError) throw new Error(validationError)

  const path = `${profileId}/avatar`
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '0',
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  const { data, error } = await supabase.from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', profileId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('No se pudo guardar la foto de perfil. Comprueba tus permisos e inténtalo de nuevo.')
  return publicUrl
}
