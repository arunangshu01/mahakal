import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import Reactor from './Reactor'

const renderReactor = (props) => render(<Reactor status="idle" analyserRef={{ current: null }} onActivate={() => {}} {...props} />)

test('the core is a button that starts and stops listening', async () => {
  const onActivate = vi.fn()
  const { rerender } = renderReactor({ onActivate })

  const core = screen.getByRole('button', { name: 'Start talking' })
  await userEvent.click(core)
  expect(onActivate).toHaveBeenCalledTimes(1)

  rerender(<Reactor status="listening" analyserRef={{ current: null }} onActivate={onActivate} />)
  expect(screen.getByRole('button', { name: 'Stop listening' })).toHaveAttribute('aria-pressed', 'true')
})

test('shows the emblem until a portrait image loads', () => {
  const { container } = renderReactor()
  const reactor = container.querySelector('.reactor')
  const portrait = container.querySelector('img.portrait')

  expect(screen.getByLabelText('Mahakal emblem')).toBeInTheDocument()
  expect(reactor).not.toHaveClass('has-portrait')

  fireEvent.load(portrait)
  expect(reactor).toHaveClass('has-portrait')
})

test('drops the portrait when /mahakal.png is missing', () => {
  const { container } = renderReactor()
  fireEvent.error(container.querySelector('img.portrait'))
  expect(container.querySelector('img.portrait')).toBeNull()
})
