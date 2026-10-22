import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskWithAssignees } from '@/types'
import type { TaskImagePreview } from './attachmentsApi'
import { SortableTaskCard } from './SortableTaskCard'

const sortable = vi.hoisted(() => ({
  onKeyDown: vi.fn(),
  onPointerDown: vi.fn(),
  setActivatorNodeRef: vi.fn(),
  setNodeRef: vi.fn(),
}))

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0, 'aria-describedby': 'drag-instructions' },
    listeners: { onKeyDown: sortable.onKeyDown, onPointerDown: sortable.onPointerDown },
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    setNodeRef: sortable.setNodeRef,
    transform: null,
    isDragging: false,
  }),
}))

const task: TaskWithAssignees = {
  board_id: 'offline',
  id: 'task-1', title: 'Revisar propuesta', description: 'Preparar la siguiente entrega',
  status: 'por_hacer', priority: 'alta', special_notes: null, created_by: null,
  position: 0, created_at: '2026-10-16', updated_at: '2026-10-16', assignees: [],
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('TaskCard: apertura y movimiento independientes', () => {
  it('abre con Enter y Espacio desde el título sin activar los listeners de drag', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<SortableTaskCard task={task} onClick={onClick} />)

    const open = screen.getByRole('button', { name: 'Abrir tarea: Revisar propuesta' })
    expect(open.tagName).toBe('BUTTON')
    await user.tab()
    expect(document.activeElement).toBe(open)
    await user.keyboard('{Enter} ')

    expect(onClick).toHaveBeenCalledTimes(2)
    expect(sortable.onKeyDown).not.toHaveBeenCalled()
    expect(sortable.onPointerDown).not.toHaveBeenCalled()
  })

  it('mueve en las cuatro direcciones con ratón y teclado sin abrir ni iniciar drag', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const moves = [vi.fn(), vi.fn(), vi.fn(), vi.fn()]
    render(<SortableTaskCard task={task} onClick={onClick}
      onMoveUp={moves[0]} onMoveDown={moves[1]} onMoveLeft={moves[2]} onMoveRight={moves[3]}
      canMoveUp canMoveDown canMoveLeft canMoveRight />)

    const names = ['Subir dentro de la lista', 'Bajar dentro de la lista',
      'Mover a la lista anterior', 'Mover a la lista siguiente']
    for (const [index, name] of names.entries()) {
      const control = screen.getByRole('button', { name })
      await user.click(control)
      await user.keyboard('{Enter} ')
      expect(moves[index]).toHaveBeenCalledTimes(3)
    }

    expect(onClick).not.toHaveBeenCalled()
    expect(sortable.onKeyDown).not.toHaveBeenCalled()
    expect(sortable.onPointerDown).not.toHaveBeenCalled()
  })

  it('expone un asa nativa independiente con los atributos, listeners y ref de dnd-kit', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<SortableTaskCard task={task} onClick={onClick} />)

    const handle = screen.getByRole('button', { name: 'Arrastrar tarea: Revisar propuesta' })
    expect(handle.tagName).toBe('BUTTON')
    expect(handle.getAttribute('aria-describedby')).toBe('drag-instructions')
    expect(sortable.setActivatorNodeRef).toHaveBeenCalledWith(handle)
    await user.click(handle)
    await user.keyboard(' ')

    expect(sortable.onPointerDown).toHaveBeenCalledTimes(1)
    expect(sortable.onKeyDown).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('respeta flags y callbacks al exponer las acciones de movimiento', () => {
    render(<SortableTaskCard task={task} onMoveUp={vi.fn()} canMoveUp={false}
      onMoveDown={vi.fn()} canMoveDown canMoveLeft onMoveRight={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Subir dentro de la lista' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Bajar dentro de la lista' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mover a la lista anterior' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mover a la lista siguiente' })).toBeNull()
  })

  it('muestra prioridad textual y contadores disponibles, incluido cero', () => {
    const { rerender } = render(<SortableTaskCard task={{ ...task, comment_count: 0, attachment_count: 2 }} />)
    expect(screen.getByText('Prioridad alta')).toBeTruthy()
    expect(screen.getByText('0 comentarios')).toBeTruthy()
    expect(screen.getByText('2 adjuntos')).toBeTruthy()

    rerender(<SortableTaskCard task={task} />)
    expect(screen.queryByText(/\d+ comentarios/)).toBeNull()
    expect(screen.queryByText(/\d+ adjuntos/)).toBeNull()
  })

  it('muestra la descripción completa conservando saltos de línea', () => {
    const description = 'Primera línea\n\nSegunda línea con contexto adicional'
    render(<SortableTaskCard task={{ ...task, description }} />)

    const renderedDescription = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === description)
    expect(renderedDescription).toHaveClass('whitespace-pre-wrap')
    expect(renderedDescription).not.toHaveClass('line-clamp-2')
  })

  it('abre la imagen ampliada desde una miniatura sin abrir el detalle de la tarea', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const image: TaskImagePreview = {
      id: 'image-1', fileName: 'boceto.png', signedUrl: 'https://example.test/boceto.png',
    }
    render(<SortableTaskCard task={task} images={[image]} onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Ampliar imagen: boceto.png' }))
    const dialog = screen.getByRole('dialog', { name: 'boceto.png' })
    expect(dialog).toBeVisible()
    expect(screen.getByRole('img', { name: 'boceto.png' })).toHaveAttribute('src', image.signedUrl)
    expect(onClick).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
