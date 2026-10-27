import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileAvatar } from './ProfileAvatar'

describe('ProfileAvatar', () => {
  it('muestra la imagen en un círculo y conserva el nombre accesible', () => {
    const { container } = render(<ProfileAvatar src="https://example.test/avatar.png" name="Ana López" />)

    expect(screen.getByRole('img', { name: 'Foto de Ana López' })).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/avatar.png')
  })

  it('usa el icono genérico si no hay foto o si la imagen falla', () => {
    const { container, rerender } = render(<ProfileAvatar src={null} name="Ana López" />)
    expect(screen.getByRole('img', { name: 'Foto de Ana López' }).querySelector('svg')).toBeInTheDocument()

    rerender(<ProfileAvatar src="https://example.test/rota.png" name="Ana López" />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByRole('img', { name: 'Foto de Ana López' }).querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('puede conservar las iniciales como fallback en los avatares compactos', () => {
    render(<ProfileAvatar src={null} name="Bruno" fallback="initials" size="sm" />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
