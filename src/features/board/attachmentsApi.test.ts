import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAttachments, fetchTaskImagePreviews } from './attachmentsApi'

const mocks = vi.hoisted(() => {
  const query = { select: vi.fn(), in: vi.fn(), eq: vi.fn(), order: vi.fn() }
  const storageBucket = { createSignedUrls: vi.fn(), createSignedUrl: vi.fn() }
  return {
    query,
    storageBucket,
    supabase: {
      from: vi.fn(),
      storage: { from: vi.fn() },
    },
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: mocks.supabase }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.supabase.from.mockReturnValue(mocks.query)
  mocks.query.select.mockReturnValue(mocks.query)
  mocks.query.in.mockReturnValue(mocks.query)
  mocks.query.eq.mockReturnValue(mocks.query)
  mocks.query.order.mockResolvedValue({
    data: [
      {
        id: 'image-1', task_id: 'task-1', file_name: 'imagen uno.png',
        file_url: 'https://project.example/storage/v1/object/public/task-attachments/imagen%20uno.png',
        mime_type: 'image/png',
      },
      {
        id: 'file-1', task_id: 'task-1', file_name: 'documento.pdf',
        file_url: 'https://project.example/storage/v1/object/public/task-attachments/documento.pdf',
        mime_type: 'application/pdf',
      },
      {
        id: 'image-2', task_id: 'task-2', file_name: 'foto.jpg',
        file_url: 'https://project.example/storage/v1/object/public/task-attachments/foto.jpg',
        mime_type: 'image/jpeg',
      },
      {
        id: 'image-3', task_id: 'task-2', file_name: 'ruta-no-valida.png',
        file_url: 'https://project.example/otro-bucket/ruta-no-valida.png',
        mime_type: 'image/png',
      },
    ],
    error: null,
  })
  mocks.supabase.storage.from.mockReturnValue(mocks.storageBucket)
  mocks.storageBucket.createSignedUrls.mockResolvedValue({
    data: [
      { path: 'imagen uno.png', signedUrl: 'https://signed.example/imagen-uno' },
      { path: 'foto.jpg', signedUrl: 'https://signed.example/foto' },
    ],
    error: null,
  })
})

describe('fetchTaskImagePreviews', () => {
  it('firma también documentos privados sin reemplazar su ruta persistida', async () => {
    const fileUrl = 'https://project.example/storage/v1/object/public/task-attachments/task-1/documento.pdf'
    mocks.query.order.mockResolvedValue({ data: [{ id: 'doc', file_url: fileUrl }], error: null })
    mocks.storageBucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/doc' }, error: null })
    expect(await fetchAttachments('task-1')).toEqual([{ id: 'doc', file_url: fileUrl, signed_url: 'https://signed.example/doc' }])
    expect(mocks.query.eq).toHaveBeenCalledWith('task_id', 'task-1')
    expect(mocks.storageBucket.createSignedUrl).toHaveBeenCalledWith('task-1/documento.pdf', 60)
  })
  it('propaga la denegación de Storage en vez de usar una URL pública como alternativa', async () => {
    mocks.query.order.mockResolvedValue({ data: [{ id: 'doc', file_url: 'https://project.example/task-attachments/legacy.pdf' }], error: null })
    mocks.storageBucket.createSignedUrl.mockResolvedValue({ data: null, error: new Error('Sin acceso') })
    await expect(fetchAttachments('task-1')).rejects.toThrow('Sin acceso')
  })
  it('carga solo adjuntos de imagen, firma sus rutas y los agrupa por tarea', async () => {
    const result = await fetchTaskImagePreviews(['task-1', 'task-2'])

    expect(mocks.supabase.from).toHaveBeenCalledWith('task_attachments')
    expect(mocks.query.select).toHaveBeenCalledWith('id, task_id, file_name, file_url, mime_type')
    expect(mocks.query.in).toHaveBeenCalledWith('task_id', ['task-1', 'task-2'])
    expect(mocks.storageBucket.createSignedUrls).toHaveBeenCalledWith(['imagen uno.png', 'foto.jpg'], 60)
    expect(result).toEqual({
      'task-1': [{ id: 'image-1', fileName: 'imagen uno.png', signedUrl: 'https://signed.example/imagen-uno' }],
      'task-2': [{ id: 'image-2', fileName: 'foto.jpg', signedUrl: 'https://signed.example/foto' }],
    })
  })

  it('no realiza consultas si no hay tareas', async () => {
    await expect(fetchTaskImagePreviews([])).resolves.toEqual({})
    expect(mocks.supabase.from).not.toHaveBeenCalled()
    expect(mocks.storageBucket.createSignedUrls).not.toHaveBeenCalled()
  })
})
