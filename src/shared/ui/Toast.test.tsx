import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Toast } from './Toast'
import { useToast } from './useToast'

function Example() {
  const { notice, setNotice, dismissNotice } = useToast()
  return <>
    <button onClick={() => setNotice('Tarea movida correctamente.')}>Notificar</button>
    <Toast notice={notice} onClose={dismissNotice} />
  </>
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const advance = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds))

it('cierra a los cuatro segundos y reinicia el plazo al repetir un mensaje', () => {
  render(<Example />)
  fireEvent.click(screen.getByText('Notificar'))
  advance(3000)
  fireEvent.click(screen.getByText('Notificar'))
  advance(3000)
  expect(screen.getByRole('status')).toHaveTextContent('Tarea movida correctamente.')
  advance(1000)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.queryByRole('button', { name: 'Cerrar notificación' })).not.toBeInTheDocument()
})

it('pausa el cierre durante la lectura con puntero o foco y admite cierre manual', () => {
  render(<Example />)
  fireEvent.click(screen.getByText('Notificar'))
  const message = screen.getByText('Tarea movida correctamente.')
  fireEvent.mouseEnter(message)
  advance(5000)
  expect(message).toBeInTheDocument()
  fireEvent.mouseLeave(message)
  const close = screen.getByRole('button', { name: 'Cerrar notificación' })
  fireEvent.focus(close)
  advance(5000)
  expect(message).toBeInTheDocument()
  fireEvent.blur(close)
  advance(4000)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  fireEvent.click(screen.getByText('Notificar'))
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})
