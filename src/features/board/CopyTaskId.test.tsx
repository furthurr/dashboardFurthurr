import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyTaskId } from './CopyTaskId'

const taskId = '123e4567-e89b-42d3-a456-426614174000'
const props = { taskId, taskTitle: 'Revisar propuesta' }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Copiar ID de tarea', () => {
  it('copia solo el UUID completo con teclado y retira la confirmación tras cuatro segundos', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<CopyTaskId {...props} />)
    expect(screen.queryByText(taskId)).not.toBeInTheDocument()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(write).toHaveBeenCalledExactlyOnceWith(taskId)
    expect(screen.getByRole('status')).toHaveTextContent('ID de tarea copiado')
    vi.useFakeTimers()
    // Repetir con temporizadores simulados para comprobar el ciclo completo.
    fireEvent.click(screen.getByRole('button', { name: 'Copiar ID de Revisar propuesta' }))
    await act(async () => {})
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra el ID seleccionable y permite reintentar cuando el navegador bloquea la copia', async () => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('NotAllowedError')).mockResolvedValue()
    render(<CopyTaskId {...props} />)
    const button = screen.getByRole('button', { name: 'Copiar ID de Revisar propuesta' })
    await user.click(button)
    expect(screen.getByRole('alert')).toHaveTextContent('cópialo manualmente')
    expect(screen.getByText(taskId)).toHaveClass('select-text')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(button)
    expect(write).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('ID de tarea copiado')
  })

  it('ofrece copia manual también si la API del portapapeles no está disponible', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard)
    render(<CopyTaskId {...props} showId />)
    expect(screen.getByText(taskId)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Copiar ID de Revisar propuesta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo copiar el ID')
    expect(screen.getByText(taskId)).toBeVisible()
  })

  it('bloquea copias simultáneas mientras espera el portapapeles', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<CopyTaskId {...props} />)
    const button = screen.getByRole('button', { name: 'Copiar ID de Revisar propuesta' })
    await user.click(button)
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleName('Copiar ID de Revisar propuesta')
    expect(button.textContent).toBe('')
    await user.click(button)
    expect(write).toHaveBeenCalledOnce()
    await act(async () => finish())
    expect(button).toBeEnabled()
    expect(screen.getByRole('status')).toBeVisible()
  })
})
