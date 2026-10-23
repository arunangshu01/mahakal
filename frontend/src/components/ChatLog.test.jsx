import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ChatLog from './ChatLog'
import Typewriter from './Typewriter'

afterEach(() => {
  vi.useRealTimers()
})

test('labels messages from the user and from M.A.H.A.K.A.L.', () => {
  render(
    <ChatLog
      messages={[
        { id: 1, text: 'Hello', from: 'user' },
        { id: 2, text: 'Namaste', from: 'ai' },
        { id: 3, text: 'Spoken reply', from: 'ai', typewriter: true },
      ]}
    />,
  )
  expect(screen.getByRole('log')).toBeInTheDocument()
  expect(screen.getByText('YOU')).toBeInTheDocument()
  expect(screen.getAllByText('M.A.H.A.K.A.L.')).toHaveLength(2)
  expect(screen.getByText('Hello')).toBeInTheDocument()
  expect(screen.getByText('Namaste')).toBeInTheDocument()
  expect(screen.getByLabelText('Spoken reply')).toBeInTheDocument()
})

test('shows a streaming reply with its tool activity and a caret', () => {
  const { container, rerender } = render(
    <ChatLog messages={[{ id: 1, text: 'It is', from: 'ai', streaming: true, tool: 'Checking the weather' }]} />,
  )
  expect(screen.getByText(/Checking the weather/)).toBeInTheDocument()
  expect(container.querySelector('.msg')).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('.caret')).not.toBeNull()

  rerender(<ChatLog messages={[{ id: 1, text: 'It is sunny.', from: 'ai', streaming: false }]} />)
  expect(screen.getByText('It is sunny.')).toBeInTheDocument()
  expect(container.querySelector('.caret')).toBeNull()
})

test('Typewriter reveals the text over time', () => {
  vi.useFakeTimers()
  const { container } = render(<Typewriter text="Om Namah Shivaya" speed={10} step={4} />)
  expect(container).not.toHaveTextContent('Om Namah Shivaya')

  for (let i = 0; i < 5; i++) {
    act(() => {
      vi.advanceTimersByTime(10)
    })
  }
  expect(container).toHaveTextContent('Om Namah Shivaya')
  expect(container.querySelector('.caret')).toBeNull()
})
