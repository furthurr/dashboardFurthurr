import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskDetailModal } from './TaskDetailModal'
import type { TaskWithAssignees } from '@/types'

const task: TaskWithAssignees = {
  board_id: 'offline',
  id: 'task-1', title: 'Revisar diseño', description: 'Descripción original',
  status: 'backlog', priority: 'normal', special_notes: null, created_by: 'user-1',
  position: 0, created_at: '2026-10-16', updated_at: '2026-10-16', assignees: [],
}

describe('Traslado de tareas entre tableros', () => {
  const boards = [{ id: 'general', name: 'General', is_active: true, pending_count: 0, created_at: '2026-10-21' }]
  it('exige destino y confirmación, espera el traslado y cierra al completarlo', async () => {
    const user = userEvent.setup()
    const move = vi.fn().mockResolvedValue(undefined)
    const close = vi.fn()
    render(<TaskDetailModal task={task} comments={[]} attachments={[]} isOpen onClose={close} boards={boards} onMoveToBoard={move} />)
    expect(screen.getByRole('button', { name: 'Trasladar tarea' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Tablero de destino'), 'general')
    await user.click(screen.getByRole('button', { name: 'Trasladar tarea' }))
    expect(move).not.toHaveBeenCalled()
    expect(screen.getByText(/Los cambios sin guardar se descartarán/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirmar traslado' }))
    expect(move).toHaveBeenCalledExactlyOnceWith('general')
    expect(close).toHaveBeenCalledOnce()
  })
  it('conserva el detalle y el destino si el servidor rechaza el traslado', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    render(<TaskDetailModal task={task} comments={[]} attachments={[]} isOpen onClose={close} boards={boards} onMoveToBoard={vi.fn().mockRejectedValue(new Error('denegado'))} />)
    await user.selectOptions(screen.getByLabelText('Tablero de destino'), 'general')
    await user.click(screen.getByRole('button', { name: 'Trasladar tarea' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar traslado' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo trasladar la tarea')
    expect(screen.getByLabelText('Tablero de destino')).toHaveValue('general')
    expect(close).not.toHaveBeenCalled()
  })
  it('no ofrece destinos si no hay otros tableros accesibles', () => {
    render(<TaskDetailModal task={task} comments={[]} attachments={[]} isOpen onClose={vi.fn()} boards={[]} onMoveToBoard={vi.fn()} />)
    expect(screen.getByText('No tienes otros tableros disponibles.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Trasladar tarea' })).not.toBeInTheDocument()
  })
})
const base = { task, comments: [], attachments: [], isOpen: true, onClose: vi.fn() }

function createImagePasteEvent(file: File) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      files: [],
    },
  })
  return event
}

describe('Detalle de tarea', () => {
  it('precarga responsables, permite desasignarlos todos sin callback de guardado y mantiene el detalle abierto', async () => {
    const user = userEvent.setup()
    const person = { id: 'a', full_name: 'Ana', email: 'ana@example.test', avatar_url: null, role: 'usuario' as const, is_active: true }
    const onSaveAssignees = vi.fn().mockResolvedValue([])
    const onClose = vi.fn()
    render(<TaskDetailModal {...base} task={{ ...task, assignees: [person] }} onClose={onClose} onSaveAssignees={onSaveAssignees} assigneeOptions={{ users: [person] }} />)
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desasignar a Ana' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desasignar a Ana' }))
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciones' }))
    expect(onSaveAssignees).toHaveBeenCalledExactlyOnceWith([])
    expect(await screen.findByRole('status')).toHaveTextContent('Asignaciones guardadas.')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Guardar asignaciones' })).toBeDisabled()
  })
  it('no guarda otros campos ni descarta la selección ante un fallo de asignaciones', async () => {
    const user = userEvent.setup()
    const person = { id: 'a', full_name: 'Ana', email: 'ana@example.test', avatar_url: null, role: 'usuario' as const, is_active: true }
    const onSave = vi.fn()
    const onSaveAssignees = vi.fn().mockRejectedValueOnce(new Error('Información privada')).mockResolvedValueOnce([])
    render(<TaskDetailModal {...base} onSave={onSave} onSaveAssignees={onSaveAssignees} assigneeOptions={{ users: [person] }} />)
    await user.type(screen.getByLabelText('Título'), ' borrador')
    await user.selectOptions(screen.getByLabelText('Asignar usuario'), 'all')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar las asignaciones')
    expect(screen.queryByText('Información privada')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desasignar a Ana' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue(`${task.title} borrador`)
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciones' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
    expect(onSave).not.toHaveBeenCalled()
  })
  it('bloquea doble envío y cierres mientras guarda asignaciones', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const person = { id: 'a', full_name: 'Ana', email: 'ana@example.test', avatar_url: null, role: 'usuario' as const, is_active: true }
    const onSaveAssignees = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    const onClose = vi.fn()
    render(<TaskDetailModal {...base} onClose={onClose} onSaveAssignees={onSaveAssignees} assigneeOptions={{ users: [person] }} />)
    await user.selectOptions(screen.getByLabelText('Asignar usuario'), 'a')
    await user.dblClick(screen.getByRole('button', { name: 'Guardar asignaciones' }))
    expect(onSaveAssignees).toHaveBeenCalledExactlyOnceWith(['a'])
    expect(screen.getByRole('button', { name: 'Desasignar a Ana' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => resolve())
    expect(screen.getByRole('button', { name: 'Guardar asignaciones' })).toBeDisabled()
  })
  it.each(['', '   '])('deshabilita guardar con título en blanco (%j)', async (title) => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TaskDetailModal {...base} onSave={onSave} />)
    await user.clear(screen.getByLabelText('Título'))
    if (title) await user.type(screen.getByLabelText('Título'), title)
    const save = screen.getByRole('button', { name: /guardar cambios/i })
    expect(save).toBeDisabled()
    await user.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('conserva el formulario abierto y el borrador si falla el guardado', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TaskDetailModal {...base} onClose={onClose} onSave={vi.fn().mockRejectedValue(new Error('Sin conexión'))} />)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Borrador nuevo')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo guardar/i)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Título')).toHaveValue('Borrador nuevo')
  })

  it('espera el éxito y bloquea doble envío antes de cerrar', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    let resolve!: () => void
    const onSave = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    render(<TaskDetailModal {...base} onClose={onClose} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
    resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('reinicia valores y pestaña al reabrir la misma tarea', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(<TaskDetailModal {...base} onSave={onSave} onClose={onClose} />)
    expect(screen.getByLabelText('Título')).toBeEnabled()
    await user.type(screen.getByLabelText('Título'), ' descartado')
    expect(screen.getByLabelText('Título')).toHaveValue(`${task.title} descartado`)
    await user.click(screen.getByRole('tab', { name: /comentarios/i }))
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
    rerender(<TaskDetailModal {...base} onSave={onSave} onClose={onClose} isOpen={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<TaskDetailModal {...base} onSave={onSave} onClose={onClose} />)
    expect(screen.getByLabelText('Título')).toHaveValue(task.title)
    expect(screen.getByRole('tab', { name: 'Detalles' })).toHaveAttribute('aria-selected', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('pide confirmación para eliminar, conserva la tarea ante fallo y cierra tras reintentar con éxito', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    let resolve!: () => void
    const onDelete = vi.fn()
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockImplementationOnce(() => new Promise<void>((done) => { resolve = done }))
    render(<TaskDetailModal {...base} onClose={onClose} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }))
    const confirmation = screen.getByRole('group', { name: 'Confirmar eliminación' })
    expect(confirmation).toHaveTextContent('¿Eliminar esta tarea?')
    expect(onDelete).not.toHaveBeenCalled()
    await user.click(within(confirmation).getByRole('button', { name: 'Cancelar eliminación' }))
    expect(screen.queryByRole('group', { name: 'Confirmar eliminación' })).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo eliminar/i)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByLabelText('Título')).toHaveValue(task.title)
    expect(screen.getByRole('group', { name: 'Confirmar eliminación' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(screen.getByRole('button', { name: 'Eliminando…' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { resolve() })
    expect(onDelete).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('group', { name: 'Confirmar eliminación' })).not.toBeInTheDocument()
  })

  it('ofrece diálogo nombrado, pestañas con flechas y cierre exterior sin cerrar al pulsar dentro', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TaskDetailModal {...base} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: /detalle de tarea/i })
    await user.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    screen.getByRole('tab', { name: 'Detalles' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /comentarios/i })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toBeVisible()
    await user.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('conserva comentario ante fallo y comunica error sin vaciarlo', async () => {
    const user = userEvent.setup()
    render(<TaskDetailModal {...base} onAddComment={vi.fn().mockRejectedValue(new Error('Fallo'))} />)
    await user.click(screen.getByRole('tab', { name: /comentarios/i }))
    await user.type(screen.getByPlaceholderText(/escribe un comentario/i), 'Mi actualización')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo enviar/i)
    expect(screen.getByPlaceholderText(/escribe un comentario/i)).toHaveValue('Mi actualización')
  })

  it('bloquea el doble envío de comentario pendiente y solo lo vacía tras éxito', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onAddComment = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    render(<TaskDetailModal {...base} onAddComment={onAddComment} />)
    await user.click(screen.getByRole('tab', { name: /comentarios/i }))
    const input = screen.getByRole('textbox', { name: 'Nuevo comentario' })
    await user.type(input, 'Mi actualización')
    await user.dblClick(screen.getByRole('button', { name: 'Enviar' }))
    const sending = screen.getByRole('button', { name: 'Enviando…' })
    expect(sending).toBeDisabled()
    expect(input).toBeDisabled()
    expect(input).toHaveValue('Mi actualización')
    await user.click(sending)
    expect(onAddComment).toHaveBeenCalledExactlyOnceWith('Mi actualización')

    await act(async () => { resolve() })
    expect(input).toHaveValue('')
    expect(input).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Comentario enviado.')
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    expect(onAddComment).toHaveBeenCalledOnce()
  })

  it('permite abrir el selector con teclado, rechaza archivos superiores a 5 MB y sube automáticamente los válidos', async () => {
    const user = userEvent.setup()
    let resolveUpload!: () => void
    const onUploadAttachment = vi.fn(() => new Promise<void>((resolve) => { resolveUpload = resolve }))
    const { container } = render(<TaskDetailModal {...base} onUploadAttachment={onUploadAttachment} />)
    await user.click(screen.getByRole('tab', { name: /adjuntos/i }))
    await user.tab()
    const selectFile = screen.getByRole('button', { name: 'Seleccionar archivo' })
    expect(selectFile).toHaveFocus()
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const openPicker = vi.spyOn(input, 'click')
    await user.click(selectFile)
    expect(openPicker).toHaveBeenCalledOnce()
    expect(input).toBeEnabled()
    const oversized = new File(['contenido'], 'grande.pdf', { type: 'application/pdf' })
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 })
    await user.upload(input, oversized)
    expect(screen.getByRole('alert')).toHaveTextContent('El archivo debe ser de 5 MB o menos.')
    expect(input).toHaveValue('')
    expect((input as HTMLInputElement).files).toHaveLength(0)
    expect(onUploadAttachment).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Subir adjunto' })).not.toBeInTheDocument()

    const valid = new File(['contenido'], 'valido.pdf', { type: 'application/pdf' })
    Object.defineProperty(valid, 'size', { value: 5 * 1024 * 1024 })
    await user.upload(input, valid)
    expect((input as HTMLInputElement).files?.[0]).toBe(valid)
    expect(screen.getByText('Subiendo valido.pdf…')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeDisabled()
    expect(onUploadAttachment).toHaveBeenCalledExactlyOnceWith(valid)
    await act(async () => { resolveUpload() })
    expect(input.files).toHaveLength(0)
    expect(screen.getByText('Ningún archivo seleccionado')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Archivo adjuntado.')
  })

  it('sube automáticamente la imagen pegada mientras está abierta la pestaña Adjuntos y valida los 5 MB', async () => {
    const user = userEvent.setup()
    let resolveUpload!: () => void
    const onUploadAttachment = vi.fn(() => new Promise<void>((resolve) => { resolveUpload = resolve }))
    render(<TaskDetailModal {...base} onUploadAttachment={onUploadAttachment} />)
    const dialog = screen.getByRole('dialog')
    const image = new File(['contenido'], 'captura.png', { type: 'image/png' })
    const inactivePaste = createImagePasteEvent(image)

    fireEvent(dialog, inactivePaste)
    expect(inactivePaste.defaultPrevented).toBe(false)
    expect(onUploadAttachment).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: /adjuntos/i }))
    const oversized = new File(['contenido'], 'grande.png', { type: 'image/png' })
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 })
    const oversizedPaste = createImagePasteEvent(oversized)
    fireEvent(dialog, oversizedPaste)
    expect(oversizedPaste.defaultPrevented).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent('El archivo debe ser de 5 MB o menos.')
    expect(onUploadAttachment).not.toHaveBeenCalled()

    const paste = createImagePasteEvent(image)
    fireEvent(dialog, paste)
    expect(paste.defaultPrevented).toBe(true)
    expect(onUploadAttachment).toHaveBeenCalledExactlyOnceWith(image)
    expect(screen.getByText('Subiendo captura.png…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeDisabled()

    await act(async () => { resolveUpload() })
    expect(screen.getByRole('status')).toHaveTextContent('Archivo adjuntado.')
    expect(screen.getByText('Ningún archivo seleccionado')).toBeInTheDocument()
  })

  it('si la subida falla conserva el nombre y permite reintentar seleccionando de nuevo el archivo', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onUploadAttachment = vi.fn()
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockImplementationOnce(() => new Promise<void>((done) => { resolve = done }))
    const { container } = render(<TaskDetailModal {...base} onUploadAttachment={onUploadAttachment} />)
    await user.click(screen.getByRole('tab', { name: /adjuntos/i }))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['contenido'], 'informe.pdf', { type: 'application/pdf' })
    await user.upload(input, file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo subir el archivo/i)
    expect(screen.getByText('informe.pdf')).toBeInTheDocument()
    expect(input.files).toHaveLength(0)
    expect(input).toHaveValue('')
    expect(input).toBeEnabled()
    expect(onUploadAttachment).toHaveBeenNthCalledWith(1, file)

    await user.upload(input, file)
    expect(onUploadAttachment).toHaveBeenNthCalledWith(2, file)
    expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeDisabled()
    expect(screen.getByText('Subiendo informe.pdf…')).toBeInTheDocument()
    expect(input).toBeDisabled()
    expect(input.files?.[0]).toBe(file)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => { resolve() })
    expect(input.files).toHaveLength(0)
    expect(input).toHaveValue('')
    expect(input).toBeEnabled()
    expect(screen.getByText('Ningún archivo seleccionado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subir adjunto' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Archivo adjuntado.')
    expect(onUploadAttachment).toHaveBeenCalledTimes(2)
  })

  it.each([
    { tab: /comentarios/i, loading: 'commentsLoading', error: 'commentsError', pending: 'Cargando comentarios…', failure: 'No se pudieron cargar los comentarios.', empty: 'Aún no hay comentarios' },
    { tab: /adjuntos/i, loading: 'attachmentsLoading', error: 'attachmentsError', pending: 'Cargando adjuntos…', failure: 'No se pudieron cargar los adjuntos.', empty: 'Aún no hay archivos adjuntos' },
  ] as const)('muestra carga y error de la query $loading sin presentarlos como una lista vacía', async ({ tab, loading, error, pending, failure, empty }) => {
    const user = userEvent.setup()
    const { rerender } = render(<TaskDetailModal {...base} {...{ [loading]: true }} />)
    await user.click(screen.getByRole('tab', { name: tab }))
    const panel = within(screen.getByRole('tabpanel'))
    expect(panel.getByRole('status')).toHaveTextContent(pending)
    expect(panel.queryByText(empty)).not.toBeInTheDocument()
    expect(panel.queryByRole('alert')).not.toBeInTheDocument()

    rerender(<TaskDetailModal {...base} {...{ [error]: true }} />)
    expect(panel.getByRole('alert')).toHaveTextContent(failure)
    expect(panel.getByRole('alert')).toHaveTextContent('Vuelve a abrir la tarea para reintentar.')
    expect(panel.queryByRole('status')).not.toBeInTheDocument()
    expect(panel.queryByText(empty)).not.toBeInTheDocument()

    rerender(<TaskDetailModal {...base} />)
    expect(panel.queryByRole('alert')).not.toBeInTheDocument()
    expect(panel.getByText(empty)).toBeVisible()
  })
})
