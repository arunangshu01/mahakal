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
      ]}
    />,
  )
  expect(screen.getByRole('log')).toBeInTheDocument()
  expect(screen.getByText('YOU')).toBeInTheDocument()
  expect(screen.getByText('M.A.H.A.K.A.L.')).toBeInTheDocument()
  expect(screen.getByText('Hello')).toBeInTheDocument()
  expect(screen.getByLabelText('Namaste')).toBeInTheDocument()
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
