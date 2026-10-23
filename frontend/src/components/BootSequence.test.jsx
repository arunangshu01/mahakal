import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { BOOT_LINES } from '../constants'
import BootSequence from './BootSequence'

afterEach(() => {
  vi.useRealTimers()
})

// Each timer is scheduled after the previous render, so advance one tick at a time.
const tick = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

test('prints every boot line and then finishes', () => {
  vi.useFakeTimers()
  const onDone = vi.fn()
  render(<BootSequence onDone={onDone} lineDelay={10} />)

  BOOT_LINES.forEach(() => tick(10))
  expect(screen.getByText(/ALL SYSTEMS ONLINE/)).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()

  tick(100)
  expect(onDone).toHaveBeenCalled()
})

test('can be skipped by tapping or with the keyboard', () => {
  const onDone = vi.fn()
  render(<BootSequence onDone={onDone} />)
  const overlay = screen.getByRole('button', { name: 'Skip boot sequence' })

  fireEvent.click(overlay)
  fireEvent.keyDown(overlay, { key: 'Escape' })
  expect(onDone).toHaveBeenCalledTimes(2)
})
