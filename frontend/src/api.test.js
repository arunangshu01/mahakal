import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  API_BASE,
  ApiError,
  getHealth,
  getSession,
  isSignInRequired,
  resetConversation,
  sendMessage,
  sendRecording,
  signInWithGoogle,
  signOut,
} from './api'

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
})

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

describe('requests', () => {
  test('getHealth hits /health', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { status: 'OK' }))
    await expect(getHealth()).resolves.toEqual({ status: 'OK' })
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/health`, undefined)
  })

  test('sendMessage posts JSON to /chat', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { reply: 'Namaste', audio_b64: '' }))
    await expect(sendMessage('Hello')).resolves.toEqual({ reply: 'Namaste', audio_b64: '' })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(`${API_BASE}/chat`)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ text: 'Hello' })
  })

  test.each([
    ['audio/webm;codecs=opus', 'speech.webm'],
    ['audio/mp4', 'speech.mp4'],
    ['audio/ogg', 'speech.ogg'],
  ])('sendRecording uploads a %s blob as %s', async (type, filename) => {
    fetch.mockResolvedValue(jsonResponse(200, {}))
    await sendRecording(new Blob(['audio'], { type }))
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(`${API_BASE}/listen`)
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file').name).toBe(filename)
  })

  test('resetConversation posts to /reset', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { message: 'cleared' }))
    await resetConversation()
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/reset`, { method: 'POST' })
  })
})

describe('auth', () => {
  test('getSession reads /auth/me', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { user: null, guest: { remaining: 5, limit: 5 } }))
    await expect(getSession()).resolves.toMatchObject({ guest: { remaining: 5 } })
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/auth/me`, undefined)
  })

  test('signInWithGoogle posts the Google credential', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { user: { name: 'Shiva' } }))
    await signInWithGoogle('id-token')
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(`${API_BASE}/auth/google`)
    expect(JSON.parse(options.body)).toEqual({ credential: 'id-token' })
  })

  test('signOut posts to /auth/logout', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { user: null }))
    await signOut()
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/auth/logout`, { method: 'POST' })
  })

  test('guest limit errors are recognised', async () => {
    fetch.mockResolvedValue(
      jsonResponse(401, { detail: { error_message: 'Error: Sign in.', error_type: 'GuestLimitReachedError' } }),
    )
    const error = await sendMessage('hi').catch((e) => e)
    expect(error.type).toBe('GuestLimitReachedError')
    expect(isSignInRequired(error)).toBe(true)
    expect(isSignInRequired(new ApiError('x', 500, 'Other'))).toBe(false)
  })
})

describe('errors', () => {
  test('surfaces the backend error_message without the "Error:" prefix', async () => {
    fetch.mockResolvedValue(
      jsonResponse(503, { detail: { error_message: 'Error: Not configured.', error_type: 'NoProviderConfiguredError' } }),
    )
    await expect(sendMessage('hi')).rejects.toMatchObject({ message: 'Not configured.', status: 503 })
  })

  test('joins FastAPI validation messages', async () => {
    fetch.mockResolvedValue(jsonResponse(422, { detail: [{ msg: 'Field required' }, { msg: 'Too long' }] }))
    await expect(sendMessage('hi')).rejects.toThrow('Field required, Too long')
  })

  test('falls back to a generic message when the body is not JSON', async () => {
    fetch.mockResolvedValue({ ok: false, status: 504, json: () => Promise.reject(new Error('html')) })
    await expect(getHealth()).rejects.toMatchObject({ message: 'Request failed: 504', status: 504 })
  })

  test('explains when the backend cannot be reached', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await sendMessage('hi').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/backend running/i)
  })
})
