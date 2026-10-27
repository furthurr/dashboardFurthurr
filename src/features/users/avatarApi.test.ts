import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAvatarFileError, MAX_AVATAR_FILE_SIZE, uploadProfileAvatar } from './avatarApi'

const mocks = vi.hoisted(() => {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() }
  const bucket = { upload: vi.fn(), getPublicUrl: vi.fn() }
  return {
    query,
    bucket,
    supabase: { from: vi.fn(), storage: { from: vi.fn() } },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: mocks.supabase }))

function createImage(type = 'image/png', size = 128) {
  return new File([new Uint8Array(size)], 'avatar.png', { type })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.supabase.from.mockReturnValue(mocks.query)
  mocks.query.update.mockReturnValue(mocks.query)
  mocks.query.eq.mockReturnValue(mocks.query)
  mocks.query.select.mockReturnValue(mocks.query)
  mocks.query.maybeSingle.mockResolvedValue({ data: { id: 'profile-1' }, error: null })
  mocks.supabase.storage.from.mockReturnValue(mocks.bucket)
  mocks.bucket.upload.mockResolvedValue({ error: null })
  mocks.bucket.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.test/storage/v1/object/public/avatars/profile-1/avatar' } })
})

describe('avatarApi', () => {
  it('acepta formatos raster permitidos hasta el límite de 2 MB', () => {
    expect(getAvatarFileError(createImage('image/jpeg', MAX_AVATAR_FILE_SIZE))).toBeNull()
    expect(getAvatarFileError(createImage('image/webp'))).toBeNull()
  })

  it('rechaza tipos desconocidos y archivos mayores de 2 MB', () => {
    expect(getAvatarFileError(createImage('image/svg+xml'))).toMatch(/JPG, PNG o WebP/)
    expect(getAvatarFileError(createImage('image/png', MAX_AVATAR_FILE_SIZE + 1))).toMatch(/2 MB/)
  })

  it('sube al path propio, guarda solo avatar_url y devuelve la URL pública', async () => {
    const url = await uploadProfileAvatar('profile-1', createImage())

    expect(mocks.supabase.storage.from).toHaveBeenCalledWith('avatars')
    expect(mocks.bucket.upload).toHaveBeenCalledWith('profile-1/avatar', expect.any(File), {
      cacheControl: '0', contentType: 'image/png', upsert: true,
    })
    expect(mocks.supabase.from).toHaveBeenCalledWith('profiles')
    expect(mocks.query.update).toHaveBeenCalledWith({ avatar_url: url })
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'profile-1')
    expect(url).toContain('/avatars/profile-1/avatar')
  })

  it('rechaza un archivo inválido sin tocar Storage ni perfiles', async () => {
    await expect(uploadProfileAvatar('profile-1', createImage('text/plain'))).rejects.toThrow(/JPG, PNG o WebP/)
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled()
    expect(mocks.supabase.from).not.toHaveBeenCalled()
  })

  it('propaga errores de Storage y detecta una actualización denegada por RLS', async () => {
    mocks.bucket.upload.mockResolvedValueOnce({ error: new Error('Carga rechazada') })
    await expect(uploadProfileAvatar('profile-1', createImage())).rejects.toThrow('Carga rechazada')
    expect(mocks.supabase.from).not.toHaveBeenCalled()

    mocks.query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(uploadProfileAvatar('profile-1', createImage())).rejects.toThrow(/permisos/)
  })
})
