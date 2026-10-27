import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CommentWithAuthor } from '@/types'
import { CommentsList } from './CommentsList'

const comment = {
  id: 'comment-1', task_id: 'task-1', author_id: 'person-1', body: 'Actualización de estado',
  created_at: '2026-10-26T12:00:00.000Z', updated_at: '2026-10-26T12:00:00.000Z',
  author: {
    id: 'person-1', full_name: 'Ana López', email: 'ana@example.test',
    avatar_url: 'https://example.test/ana.png', nickname: null, role: 'usuario' as const,
    is_active: true, created_at: '', updated_at: '',
  },
} satisfies CommentWithAuthor

describe('CommentsList', () => {
  it('muestra la foto del autor en su avatar circular', () => {
    const { container } = render(<CommentsList comments={[comment]} />)

    expect(screen.getByRole('img', { name: 'Foto de Ana López' })).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', comment.author.avatar_url)
  })
})
