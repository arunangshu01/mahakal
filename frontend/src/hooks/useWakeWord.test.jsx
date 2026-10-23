import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { isWakePhrase, useWakeWord } from './useWakeWord'

let instances

class FakeRecognition {
  constructor() {
    this.started = 0
    this.aborted = false
    instances.push(this)
  }
  start() {
    this.started += 1
  }
  abort() {
    this.aborted = true
  }
  hear(transcript) {
    this.onresult({ resultIndex: 0, results: [[{ transcript }]] })
  }
}

beforeEach(() => {
  instances = []
  vi.stubGlobal('SpeechRecognition', FakeRecognition)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test.each([
  ['Hey Mahakal', true],
  ['ok mahakaal what is the time', true],
  ['hey maha kal', true],
  ['Maha call', true],
  ['hello there', false],
  ['the mahabharata', false],
])('isWakePhrase(%j) is %s', (text, expected) => {
  expect(isWakePhrase(text)).toBe(expected)
})

test('calls onWake when it hears the phrase', () => {
  const onWake = vi.fn()
  const { result } = renderHook(() => useWakeWord({ enabled: true, paused: false, onWake }))

  expect(result.current).toEqual({ supported: true, listening: true })
  act(() => instances[0].hear('hello'))
  expect(onWake).not.toHaveBeenCalled()

  act(() => instances[0].hear('hey mahakal'))
  expect(onWake).toHaveBeenCalledTimes(1)
  expect(instances[0].aborted).toBe(true)
})

test('restarts after the browser stops listening', () => {
  vi.useFakeTimers()
  renderHook(() => useWakeWord({ enabled: true, paused: false, onWake: () => {} }))
  act(() => instances[0].onend())
  act(() => vi.advanceTimersByTime(500))
  expect(instances[0].started).toBe(2)
})

test('does not listen while disabled or paused, and stops when paused', () => {
  const { rerender } = renderHook((props) => useWakeWord({ onWake: () => {}, ...props }), {
    initialProps: { enabled: false, paused: false },
  })
  expect(instances).toHaveLength(0)

  rerender({ enabled: true, paused: false })
  expect(instances).toHaveLength(1)

  rerender({ enabled: true, paused: true })
  expect(instances[0].aborted).toBe(true)
})

test('reports a blocked microphone', () => {
  const onBlocked = vi.fn()
  renderHook(() => useWakeWord({ enabled: true, paused: false, onWake: () => {}, onBlocked }))
  act(() => instances[0].onerror({ error: 'not-allowed' }))
  expect(onBlocked).toHaveBeenCalled()
})

test('is unsupported without speech recognition', () => {
  vi.unstubAllGlobals()
  const { result } = renderHook(() => useWakeWord({ enabled: true, paused: false, onWake: () => {} }))
  expect(result.current.supported).toBe(false)
})
