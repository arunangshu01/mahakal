import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import CommandBar from './CommandBar'

test('sends the message on Enter and clears the field', async () => {
  const onSend = vi.fn(() => true)
  render(<CommandBar onSend={onSend} />)

  const input = screen.getByRole('textbox', { name: 'Message' })
  await userEvent.type(input, 'What is the time?{Enter}')

  expect(onSend).toHaveBeenCalledWith('What is the time?')
  expect(input).toHaveValue('')
})

test('keeps the text when the message was not accepted', async () => {
  render(<CommandBar onSend={() => false} />)
  const input = screen.getByRole('textbox', { name: 'Message' })
  await userEvent.type(input, 'hello{Enter}')
  expect(input).toHaveValue('hello')
})

test('disables Transmit for empty input or while busy', async () => {
  const { rerender } = render(<CommandBar onSend={() => true} />)
  const button = screen.getByRole('button', { name: 'Transmit' })
  expect(button).toBeDisabled()

  await userEvent.type(screen.getByRole('textbox'), 'hi')
  expect(button).toBeEnabled()

  rerender(<CommandBar onSend={() => true} disabled />)
  expect(button).toBeDisabled()
})
