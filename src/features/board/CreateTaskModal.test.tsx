import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateTaskModal } from './CreateTaskModal'

const base = { isOpen: true, onClose: vi.fn(), onSubmit: vi.fn(), isLoading: false }

afterEach(() => { document.body.style.overflow = '' })

describe('Crear tarea: diálogo', () => {
  it('envía varios responsables seleccionados y conserva la selección al fallar', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const users = [
      { id: 'a', full_name: 'Ana', email: 'ana@example.test', avatar_url: null, role: 'usuario' as const, is_active: true },
      { id: 'b', full_name: 'Bruno', email: 'bruno@example.test', avatar_url: null, role: 'invitado' as const, is_active: true },
    ]
    const { rerender } = render(<CreateTaskModal {...base} onSubmit={onSubmit} assigneeOptions={{ users }} />)
    await user.type(screen.getByLabelText(/título/i), 'Compartida')
    await user.selectOptions(screen.getByLabelText('Asignar usuario'), 'all')
    await user.click(screen.getByRole('button', { name: 'Crear Tarea' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: ['a', 'b'] }))
    rerender(<CreateTaskModal {...base} onSubmit={onSubmit} assigneeOptions={{ users }} errorMessage="No se pudo crear" />)
    expect(screen.getByRole('button', { name: 'Desasignar a Ana' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desasignar a Bruno' })).toBeInTheDocument()
    rerender(<CreateTaskModal {...base} onSubmit={onSubmit} assigneeOptions={{ users }} isLoading />)
    expect(screen.getByLabelText('Asignar usuario')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Desasignar a Bruno' })).toBeDisabled()
  })
  it('solo monta el diálogo al abrir, lo nombra y enfoca el primer campo', () => {
    const { rerender } = render(<CreateTaskModal {...base} isOpen={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<CreateTaskModal {...base} />)
    const dialog = screen.getByRole('dialog', { name: 'Nueva tarea' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Nueva tarea' })).toHaveAttribute('id', dialog.getAttribute('aria-labelledby'))
    expect(screen.getByLabelText(/título/i)).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Cerrar diálogo' })).toBeEnabled()
  })

  it('bloquea el scroll y restaura el foco y overflow originales al cerrar con Escape', async () => {
    const user = userEvent.setup()
    document.body.style.overflow = 'scroll'
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Abrir</button><CreateTaskModal {...base} isOpen={open} onClose={() => setOpen(false)} /></>
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('contiene Tab y Shift+Tab y permite recorrer campos interiores', async () => {
    const user = userEvent.setup()
    render(<CreateTaskModal {...base} />)
    await user.type(screen.getByLabelText(/título/i), 'Tarea')
    await user.tab()
    expect(screen.getByLabelText('Descripción')).toHaveFocus()
    screen.getByRole('button', { name: /crear tarea/i }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar diálogo' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /crear tarea/i })).toHaveFocus()
  })

  it('solo cierra al pulsar el fondo directamente, o mediante los botones de cierre', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CreateTaskModal {...base} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Nueva tarea' })
    await user.click(screen.getByRole('heading', { name: 'Nueva tarea' }))
    await user.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    await user.click(dialog.parentElement!)
    await user.click(screen.getByRole('button', { name: 'Cerrar diálogo' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('conserva foco y bloqueo de scroll al cambiar onClose y usa el callback nuevo', async () => {
    const user = userEvent.setup()
    const original = vi.fn()
    const latest = vi.fn()
    const { rerender } = render(<CreateTaskModal {...base} onClose={original} />)
    screen.getByLabelText('Descripción').focus()
    rerender(<CreateTaskModal {...base} onClose={latest} />)
    expect(screen.getByLabelText('Descripción')).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(original).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledOnce()
  })

  it('bloquea todos los cierres, campos y nuevos envíos durante pending', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    const { rerender } = render(<CreateTaskModal {...base} onClose={onClose} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/título/i), 'Pendiente')
    rerender(<CreateTaskModal {...base} onClose={onClose} onSubmit={onSubmit} isLoading />)
    const dialog = screen.getByRole('dialog')
    for (const control of screen.getAllByRole('textbox').concat(screen.getAllByRole('combobox'), screen.getAllByRole('button'))) {
      expect(control).toBeDisabled()
    }
    await user.tab()
    expect(dialog).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog).toHaveFocus()
    await user.keyboard('{Escape}')
    await user.click(dialog.parentElement!)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar diálogo' }))
    fireEvent.submit(screen.getByLabelText(/título/i).closest('form')!)
    expect(onClose).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    rerender(<CreateTaskModal {...base} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('envía el formulario desde el pie asociado y anuncia errores sin perder el borrador', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { rerender } = render(<CreateTaskModal {...base} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/título/i), '  Nueva tarea  ')
    await user.type(screen.getByLabelText('Descripción'), '  Detalles  ')
    const submit = screen.getByRole('button', { name: /crear tarea/i }) as HTMLButtonElement
    expect(submit.form).toBe(screen.getByLabelText(/título/i).closest('form'))
    expect(submit.closest('form')).toBeNull()
    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ title: 'Nueva tarea', description: 'Detalles', status: 'backlog', priority: 'normal', files: [], assigneeIds: [] })
    rerender(<CreateTaskModal {...base} errorMessage="No se pudo crear" />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo crear')
    expect(screen.getByLabelText(/título/i)).toHaveValue('  Nueva tarea  ')
  })

  it('rechaza títulos vacíos incluso con submit directo', () => {
    const onSubmit = vi.fn()
    render(<CreateTaskModal {...base} onSubmit={onSubmit} />)
    const input = screen.getByLabelText(/título/i)
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('permite adjuntar varios archivos, rechaza los mayores a 5 MB y permite quitar los seleccionados', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { container } = render(<CreateTaskModal {...base} onSubmit={onSubmit} />)
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const first = new File(['contenido'], 'brief.pdf', { type: 'application/pdf' })
    const second = new File(['contenido'], 'referencia.png', { type: 'image/png' })
    const oversized = new File(['contenido'], 'grande.zip', { type: 'application/zip' })
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 })

    await user.upload(fileInput, [first, second, oversized])
    expect(fileInput).toHaveAttribute('multiple')
    expect(screen.getByRole('alert')).toHaveTextContent('grande.zip')
    expect(screen.getByRole('list', { name: 'Archivos seleccionados para adjuntar' })).toHaveTextContent('brief.pdf')
    expect(screen.getByRole('list', { name: 'Archivos seleccionados para adjuntar' })).toHaveTextContent('referencia.png')
    expect(screen.getByRole('list', { name: 'Archivos seleccionados para adjuntar' })).not.toHaveTextContent('grande.zip')

    await user.click(screen.getByRole('button', { name: 'Quitar brief.pdf' }))
    await user.type(screen.getByLabelText(/título/i), 'Con archivos')
    await user.click(screen.getByRole('button', { name: 'Crear Tarea' }))

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      title: 'Con archivos', description: undefined, status: 'backlog', priority: 'normal', files: [second], assigneeIds: [],
    })
  })

  it('tolera desmontar el origen del foco antes de cerrar', () => {
    const origin = document.createElement('button')
    document.body.append(origin)
    origin.focus()
    const { unmount } = render(<CreateTaskModal {...base} />)
    origin.remove()
    expect(() => unmount()).not.toThrow()
    expect(document.body.style.overflow).toBe('')
  })
})
