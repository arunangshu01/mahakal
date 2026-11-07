import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ChatLog from './ChatLog'
import Typewriter from './Typewriter'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
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

test('shows a thinking indicator before the first streamed token and no copy action until finished', () => {
  const { rerender } = render(<ChatLog messages={[{ id: 1, from: 'ai', text: '', streaming: true }]} />)
  expect(screen.getByText('Thinking')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Copy response' })).toBeNull()
  rerender(<ChatLog messages={[{ id: 1, from: 'ai', text: '## Answer\n\n**Readable** text', streaming: true }]} />)
  expect(screen.getByRole('heading', { name: 'Answer' })).toBeInTheDocument()
  expect(screen.queryByText('Thinking')).toBeNull()
  rerender(<ChatLog messages={[{ id: 1, from: 'ai', text: 'Done', streaming: false }]} />)
  expect(screen.getByRole('button', { name: 'Copy response' })).toBeInTheDocument()
})

test('copies responses and fenced code separately', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const text = 'Example:\n\n```python\nprint("hello")\n```'
  render(<ChatLog messages={[{ id: 1, from: 'ai', text }]} />)
  expect(screen.getByText('python')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('print("hello")\n'))
  fireEvent.click(screen.getByRole('button', { name: 'Copy response' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(text))
})

test('does not pull readers to the bottom while they scroll through earlier replies', () => {
  const { rerender } = render(<ChatLog messages={[{ id: 1, from: 'ai', text: 'First' }]} />)
  const log = screen.getByRole('log')
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  })
  log.scrollTo = vi.fn()
  log.scrollTop = 100
  fireEvent.scroll(log)
  rerender(<ChatLog messages={[{ id: 1, from: 'ai', text: 'First, with more streamed text', streaming: true }]} />)
  expect(log.scrollTo).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Jump to latest reply' }))
  expect(log.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' })
})

test('renders markdown in assistant replies: lists, tables and links', () => {
  render(
    <ChatLog
      messages={[
        {
          id: 1,
          from: 'ai',
          text: 'Steps:\n1. First\n2. Second\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nSee [Groq](https://groq.com).',
        },
      ]}
    />,
  )
  expect(screen.getByRole('list').children).toHaveLength(2)
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Groq' })).toHaveAttribute('href', 'https://groq.com')
})

test('does not render markdown in user messages', () => {
  const { container } = render(
    <ChatLog messages={[{ id: 1, from: 'user', text: 'show me **this**' }]} />,
  )
  expect(container.querySelector('strong')).toBeNull()
  expect(screen.getByText('show me **this**')).toBeInTheDocument()
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
