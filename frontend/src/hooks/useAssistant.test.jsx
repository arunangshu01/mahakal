import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useAssistant } from './useAssistant'

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
})

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

test('sends a text message and shows the reply', async () => {
  fetch.mockResolvedValue(jsonResponse(200, { reply: 'Har Har Mahadev', audio_b64: '' }))
  const { result } = renderHook(() => useAssistant())

  let accepted
  act(() => {
    accepted = result.current.sendText('  Hello  ')
  })
  expect(accepted).toBe(true)
  expect(result.current.status).toBe('thinking')

  await waitFor(() => expect(result.current.status).toBe('idle'))
  expect(result.current.messages.map(({ text, from }) => ({ text, from }))).toEqual([
    { text: 'Hello', from: 'user' },
    { text: 'Har Har Mahadev', from: 'ai' },
  ])
})

test('ignores blank messages', () => {
  const { result } = renderHook(() => useAssistant())
  let accepted
  act(() => {
    accepted = result.current.sendText('   ')
  })
  expect(accepted).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
})

test('shows backend errors as an assistant message', async () => {
  fetch.mockResolvedValue(jsonResponse(502, { detail: { error_message: 'Error: Providers down.', error_type: 'X' } }))
  const { result } = renderHook(() => useAssistant())

  act(() => {
    result.current.sendText('Hello')
  })
  await waitFor(() => expect(result.current.status).toBe('idle'))
  expect(result.current.messages.at(-1)).toMatchObject({ text: 'Providers down.', from: 'ai' })
})

test('explains when the microphone is not available', async () => {
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined })
  const { result } = renderHook(() => useAssistant())

  await act(async () => {
    result.current.toggleListening()
  })
  expect(result.current.status).toBe('idle')
  expect(result.current.messages.at(-1).text).toMatch(/microphone access over HTTPS/i)
  vi.unstubAllGlobals()
})

test('explains when microphone permission is denied', async () => {
  vi.stubGlobal('MediaRecorder', class {})
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
  })
  const { result } = renderHook(() => useAssistant())

  await act(async () => {
    result.current.toggleListening()
  })
  expect(result.current.messages.at(-1).text).toMatch(/blocked/i)
  vi.unstubAllGlobals()
})
