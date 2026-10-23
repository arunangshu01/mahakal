export const API_BASE = '/mahakal/api/v1'

const UNREACHABLE = 'Cannot reach M.A.H.A.K.A.L. — is the backend running?'

export class ApiError extends Error {
  constructor(message, status, type = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.type = type
  }
}

export const isSignInRequired = (error) => error?.type === 'GuestLimitReachedError'

export const userTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function errorMessage(body, status) {
  const detail = body?.detail
  if (detail?.error_message) return detail.error_message.replace(/^Error:\s*/, '')
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return `Request failed: ${status}`
}

async function errorFrom(res) {
  const body = await res.json().catch(() => null)
  return new ApiError(errorMessage(body, res.status), res.status, body?.detail?.error_type ?? null)
}

async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new ApiError(UNREACHABLE, 0)
  }
  if (!res.ok) throw await errorFrom(res)
  return res.json().catch(() => null)
}

const postJson = (path, data) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const getHealth = () => request('/health')

export const getSession = () => request('/auth/me')

export const signInWithGoogle = (credential) => postJson('/auth/google', { credential })

export const signOut = () => request('/auth/logout', { method: 'POST' })

export const deleteAccount = () => request('/auth/account', { method: 'DELETE' })

export const sendMessage = (text) => postJson('/chat', { text, timezone: userTimezone() })

export function sendRecording(blob) {
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('file', blob, `speech.${extension}`)
  form.append('timezone', userTimezone())
  return request('/listen', { method: 'POST', body: form })
}

/**
 * Stream a reply. Calls `onEvent` for each server-sent event ({type: 'tool' | 'delta' | 'done'})
 * and resolves with the final `done` event.
 *
 * Firebase Hosting buffers responses, so the backend hands out a short-lived token and a URL
 * that points straight at Cloud Run in production (same origin locally).
 */
export async function streamMessage(text, onEvent = () => {}) {
  const { token, stream_url: streamUrl } = await request('/chat/stream-token', { method: 'POST' })
  let res
  try {
    res = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, timezone: userTimezone() }),
    })
  } catch {
    throw new ApiError(UNREACHABLE, 0)
  }
  if (!res.ok) throw await errorFrom(res)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const frames = buffer.split('\n\n')
    buffer = frames.pop()
    for (const frame of frames) {
      const data = frame.split('\n').find((line) => line.startsWith('data: '))
      if (!data) continue
      const event = JSON.parse(data.slice(6))
      if (event.type === 'error') {
        throw new ApiError(errorMessage({ detail: event }, 500), 500, event.error_type)
      }
      onEvent(event)
      if (event.type === 'done') return event
    }
    if (done) throw new ApiError('The reply was cut off. Please try again.', 0)
  }
}

export const getConversation = () => request('/conversation')

export const resetConversation = () => request('/reset', { method: 'POST' })

export const getMemories = () => request('/memories')

export const deleteMemory = (index) => request(`/memories/${index}`, { method: 'DELETE' })

export const clearMemories = () => request('/memories', { method: 'DELETE' })
