import { createElement, type PropsWithChildren } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteAttachment, fetchAttachments, fetchTaskImagePreviews, renameAttachment, useRenameAttachment } from './attachmentsApi'

const mocks = vi.hoisted(() => {
  const query = { select: vi.fn(), in: vi.fn(), eq: vi.fn(), order: vi.fn(), update: vi.fn(), delete: vi.fn(), maybeSingle: vi.fn() }
  const storageBucket = { createSignedUrls: vi.fn(), createSignedUrl: vi.fn(), remove: vi.fn() }
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
  mocks.query.update.mockReturnValue(mocks.query)
  mocks.query.delete.mockReturnValue(mocks.query)
  mocks.query.maybeSingle.mockResolvedValue({ data: { id: 'attachment-1' }, error: null })
  mocks.supabase.storage.from.mockReturnValue(mocks.storageBucket)
  mocks.storageBucket.remove.mockResolvedValue({ data: [], error: null })
  mocks.storageBucket.createSignedUrls.mockResolvedValue({
    data: [
      { path: 'imagen uno.png', signedUrl: 'https://signed.example/imagen-uno' },
      { path: 'foto.jpg', signedUrl: 'https://signed.example/foto' },
    ],
    error: null,
  })
})

afterEach(cleanup)

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client }, children)
  }
}

describe('renameAttachment', () => {
  it('guarda únicamente el nombre visible recortado y verifica que la fila exista', async () => {
    await renameAttachment('attachment-1', '  informe final.pdf  ')

    expect(mocks.supabase.from).toHaveBeenCalledWith('task_attachments')
    expect(mocks.query.update).toHaveBeenCalledWith({ file_name: 'informe final.pdf' })
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'attachment-1')
    expect(mocks.query.select).toHaveBeenCalledWith('id')
    expect(mocks.query.maybeSingle).toHaveBeenCalledOnce()
  })

  it('rechaza nombres vacíos sin enviar una mutación', async () => {
    await expect(renameAttachment('attachment-1', '   ')).rejects.toThrow('no puede estar vacío')
    expect(mocks.supabase.from).not.toHaveBeenCalled()
  })

  it('detecta cuando RLS no devuelve una fila actualizada', async () => {
    mocks.query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(renameAttachment('attachment-1', 'nuevo.pdf')).rejects.toThrow('sin permisos')
  })

  it('invalida la lista de adjuntos y sus miniaturas tras guardar', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    client.setQueryData(['attachments', 'task-1'], [])
    client.setQueryData(['task-image-previews', ['task-1']], {})
    const hook = renderHook(() => useRenameAttachment(), { wrapper: createWrapper(client) })

    await act(async () => {
      await hook.result.current.mutateAsync({ attachmentId: 'attachment-1', fileName: 'renombrado.pdf' })
    })

    expect(client.getQueryState(['attachments', 'task-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['task-image-previews', ['task-1']])?.isInvalidated).toBe(true)
    hook.unmount()
    client.clear()
  })
})

describe('deleteAttachment', () => {
  it('elimina primero el objeto privado y luego su metadata', async () => {
    await deleteAttachment('attachment-1', 'https://project.example/storage/v1/object/public/task-attachments/task-1/report.pdf')

    expect(mocks.storageBucket.remove).toHaveBeenCalledWith(['task-1/report.pdf'])
    expect(mocks.query.delete).toHaveBeenCalledOnce()
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'attachment-1')
    expect(mocks.query.select).toHaveBeenCalledWith('id')
  })

  it('conserva la metadata si Storage rechaza la eliminación', async () => {
    mocks.storageBucket.remove.mockResolvedValueOnce({ data: null, error: new Error('Sin acceso') })
    await expect(deleteAttachment('attachment-1', 'https://project.example/task-attachments/task-1/report.pdf')).rejects.toThrow('Sin acceso')
    expect(mocks.query.delete).not.toHaveBeenCalled()
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
