import { cleanup, render, screen, within } from '@testing-library/react'
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

  it('abre Comentarios desde el icono y no pinta badge cuando el conteo es cero', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onCommentClick = vi.fn()
    const { rerender } = render(<SortableTaskCard task={{ ...task, comment_count: 0, attachment_count: 2 }} onClick={onClick} onCommentClick={onCommentClick} />)
    expect(screen.getByText('Prioridad alta')).toBeTruthy()
    const commentButton = screen.getByRole('button', { name: 'Ver comentarios de Revisar propuesta (0 comentarios)' })
    expect(commentButton).toHaveAttribute('title', '0 comentarios')
    expect(screen.queryByText('0', { selector: 'span[aria-hidden="true"]' })).not.toBeInTheDocument()
    expect(screen.getByText('2 adjuntos')).toBeTruthy()

    await user.click(commentButton)
    expect(onCommentClick).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()

    rerender(<SortableTaskCard task={task} onClick={onClick} onCommentClick={onCommentClick} />)
    expect(screen.getByRole('button', { name: `Ver comentarios de ${task.title}` })).toHaveAttribute('title', 'Ver comentarios')
    expect(screen.queryByText(/\d+/, { selector: 'span[aria-hidden="true"]' })).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ adjuntos/)).toBeNull()
  })

  it('coloca el globo a la derecha de los avatares y muestra el badge si hay comentarios', () => {
    const assignee = { id: 'person-1', full_name: 'Ana López', email: 'ana@example.test', avatar_url: null, role: 'usuario' as const, is_active: true }
    render(<SortableTaskCard task={{ ...task, assignees: [assignee], comment_count: 12 }} onCommentClick={vi.fn()} />)

    const assigneeAvatar = screen.getByTitle('Ana López')
    const commentIndicator = screen.getByRole('button', { name: 'Ver comentarios de Revisar propuesta (12 comentarios)' })
    expect(assigneeAvatar.parentElement?.parentElement).toBe(commentIndicator.parentElement)
    expect(commentIndicator).toHaveAttribute('title', '12 comentarios')
    expect(screen.getByText('12', { selector: 'span[aria-hidden="true"]' })).toBeTruthy()
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
    const dialog = screen.getByRole('dialog', { name: task.title, description: 'boceto.png' })
    expect(dialog).toBeVisible()
    expect(within(dialog).getByRole('heading', { level: 2, name: task.title })).toBeVisible()
    expect(within(dialog).getByText('boceto.png')).toBeVisible()
    expect(screen.getByRole('img', { name: 'boceto.png' })).toHaveAttribute('src', image.signedUrl)
    expect(screen.getByRole('heading', { name: 'Descripción de la actividad' })).toBeVisible()
    expect(within(dialog).getByText(task.description!)).toBeVisible()
    expect(screen.queryByRole('button', { name: /imagen anterior/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /imagen siguiente/i })).not.toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navega entre las imágenes de la misma tarea y bloquea el avance en los extremos', async () => {
    const user = userEvent.setup()
    const images: TaskImagePreview[] = [
      { id: 'image-1', fileName: 'primera.png', signedUrl: 'https://example.test/primera.png' },
      { id: 'image-2', fileName: 'segunda.png', signedUrl: 'https://example.test/segunda.png' },
    ]
    render(<SortableTaskCard task={{ ...task, description: 'Descripción de esta actividad' }} images={images} />)

    await user.click(screen.getByRole('button', { name: 'Ampliar imagen: primera.png' }))
    const firstDialog = screen.getByRole('dialog', { name: task.title, description: 'primera.png' })
    expect(firstDialog).toBeVisible()
    expect(screen.getByRole('button', { name: `Imagen anterior de ${task.title}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `Imagen siguiente de ${task.title}` })).toBeEnabled()
    expect(within(firstDialog).getByText('Descripción de esta actividad')).toBeVisible()

    await user.click(screen.getByRole('button', { name: `Imagen siguiente de ${task.title}` }))
    expect(screen.getByRole('dialog', { name: task.title, description: 'segunda.png' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'segunda.png' })).toHaveAttribute('src', images[1].signedUrl)
    expect(screen.getByRole('button', { name: `Imagen anterior de ${task.title}` })).toBeEnabled()
    expect(screen.getByRole('button', { name: `Imagen siguiente de ${task.title}` })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: `Imagen anterior de ${task.title}` }))
    expect(screen.getByRole('dialog', { name: task.title, description: 'primera.png' })).toBeVisible()
  })
})
