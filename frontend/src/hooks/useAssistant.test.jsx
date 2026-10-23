import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useAssistant } from './useAssistant'

import { STREAM_TOKEN, jsonResponse, sseResponse } from '../test/responses'

// The stream endpoint answers with `stream` (a list of SSE events, or an error response).
const mockChat = (stream) => {
  fetch.mockImplementation((url) =>
    Promise.resolve(url.endsWith('/chat/stream-token') ? jsonResponse(STREAM_TOKEN) : Array.isArray(stream) ? sseResponse(stream) : stream),
  )
}

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

const send = (result, text) =>
  act(() => {
    result.current.sendText(text)
  })

test('streams a text reply into one message', async () => {
  mockChat([
    { type: 'delta', text: 'Har Har ' },
    { type: 'delta', text: 'Mahadev' },
    { type: 'done', reply: 'Har Har Mahadev', audio_b64: '', guest_remaining: null },
  ])
  const { result } = renderHook(() => useAssistant())

  let accepted
  act(() => {
    accepted = result.current.sendText('  Hello  ')
  })
  expect(accepted).toBe(true)
  expect(result.current.status).toBe('thinking')
  expect(result.current.messages.at(-1)).toMatchObject({ from: 'ai', text: '', streaming: true })

  await waitFor(() => expect(result.current.status).toBe('idle'))
  expect(result.current.messages.map(({ text, from, streaming }) => ({ text, from, streaming }))).toEqual([
    { text: 'Hello', from: 'user', streaming: undefined },
    { text: 'Har Har Mahadev', from: 'ai', streaming: false },
  ])
})

test('shows which tool is being used while streaming', async () => {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  fetch.mockImplementation(async (url) => {
    if (url.endsWith('/chat/stream-token')) return jsonResponse(STREAM_TOKEN)
    await gate
    return sseResponse([{ type: 'tool', name: 'get_weather', label: 'Checking the weather' }, { type: 'done', reply: 'Sunny.' }])
  })
  const { result } = renderHook(() => useAssistant())
  send(result, 'Weather?')
  await act(async () => release())
  await waitFor(() => expect(result.current.messages.at(-1).text).toBe('Sunny.'))
  expect(result.current.messages.at(-1).tool).toBeNull()
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

test('shows errors in place of the reply', async () => {
  mockChat([{ type: 'error', error_message: 'Error: Providers down.', error_type: 'AllProvidersFailedError' }])
  const { result } = renderHook(() => useAssistant())
  send(result, 'Hello')
  await waitFor(() => expect(result.current.status).toBe('idle'))
  expect(result.current.messages.at(-1)).toMatchObject({ text: 'Providers down.', from: 'ai', streaming: false })
})

test('reports how many guest messages are left', async () => {
  mockChat([{ type: 'done', reply: 'Namaste', audio_b64: '', guest_remaining: 2 }])
  const onGuestRemaining = vi.fn()
  const { result } = renderHook(() => useAssistant({ onGuestRemaining }))
  send(result, 'Hello')
  await waitFor(() => expect(onGuestRemaining).toHaveBeenCalledWith(2))
})

test('asks guests to sign in when their free messages run out', async () => {
  mockChat(jsonResponse({ detail: { error_message: 'Error: Sign in with Google.', error_type: 'GuestLimitReachedError' } }, 401))
  const onSignInRequired = vi.fn()
  const onGuestRemaining = vi.fn()
  const { result } = renderHook(() => useAssistant({ onSignInRequired, onGuestRemaining }))
  send(result, 'Hello')
  await waitFor(() => expect(onSignInRequired).toHaveBeenCalled())
  expect(onGuestRemaining).toHaveBeenCalledWith(0)
  expect(result.current.messages.at(-1).text).toBe('Sign in with Google.')
})

test('shows past history, clears it and adds notices', () => {
  const { result } = renderHook(() => useAssistant())
  act(() =>
    result.current.showHistory([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Namaste' },
    ]),
  )
  expect(result.current.messages.map(({ text, from }) => [from, text])).toEqual([
    ['user', 'hi'],
    ['ai', 'Namaste'],
  ])
  act(() => result.current.clearMessages())
  act(() => {
    result.current.notify('Wake word on.')
  })
  expect(result.current.messages.map((m) => m.text)).toEqual(['Wake word on.'])
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
