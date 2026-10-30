import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { TaskAutomation } from './TaskAutomation'
const api = vi.hoisted(() => ({ getTaskAutomation: vi.fn(), setTaskAutomation: vi.fn() }))
vi.mock('../auth/mcpAutomation', () => api)
beforeEach(() => { vi.resetAllMocks(); api.getTaskAutomation.mockResolvedValue(false); api.setTaskAutomation.mockResolvedValue(undefined) })

it('carga sin asumir autorización y permite habilitar y retirar con estado confirmado por servidor', async () => {
  let resolve!: (value: boolean) => void
  api.getTaskAutomation.mockImplementationOnce(() => new Promise<boolean>(done => { resolve = done }))
  render(<TaskAutomation taskId="task" />)
  const box = screen.getByRole('checkbox')
  expect(box).not.toBeChecked(); expect(box).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  await act(async () => resolve(false))
  await waitFor(() => expect(box).toBeEnabled())
  api.getTaskAutomation.mockResolvedValueOnce(true)
  await userEvent.click(box)
  expect(api.setTaskAutomation).toHaveBeenCalledWith('task', true)
  await waitFor(() => expect(box).toBeChecked())
  await userEvent.click(box)
  expect(api.setTaskAutomation).toHaveBeenLastCalledWith('task', false)
  await waitFor(() => expect(box).not.toBeChecked())
})
it('fallo de lectura bloquea el control y permite reintentar', async () => {
  api.getTaskAutomation.mockRejectedValueOnce(new Error('private'))
  render(<TaskAutomation taskId="task" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se asume autorizado')
  expect(screen.getByRole('checkbox')).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar automatización' }))
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
  expect(api.setTaskAutomation).not.toHaveBeenCalled()
})
it('bloquea doble envío mientras guarda y falla cerrado ante error de escritura', async () => {
  let reject!: (error: Error) => void
  api.setTaskAutomation.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
  render(<TaskAutomation taskId="task" />)
  const box = screen.getByRole('checkbox')
  await waitFor(() => expect(box).toBeEnabled())
  await userEvent.click(box); await userEvent.click(box)
  expect(api.setTaskAutomation).toHaveBeenCalledTimes(1)
  expect(box).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Guardando')
  await act(async () => reject(new Error('private')))
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(box).toBeDisabled(); expect(box).not.toBeChecked()
})
it('no presenta éxito si la escritura responde pero falla la confirmación', async () => {
  render(<TaskAutomation taskId="task" />)
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
  api.getTaskAutomation.mockRejectedValueOnce(new Error())
  await userEvent.click(screen.getByRole('checkbox'))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(screen.getByRole('checkbox')).toBeDisabled()
})
