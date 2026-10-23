export const API_BASE = '/api/v1'

export class ApiError extends Error {
  constructor(message, status, type = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.type = type
  }
}

export const isSignInRequired = (error) => error?.type === 'GuestLimitReachedError'

function errorMessage(body, status) {
  const detail = body?.detail
  if (detail?.error_message) return detail.error_message.replace(/^Error:\s*/, '')
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return `Request failed: ${status}`
}

async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new ApiError('Cannot reach M.A.H.A.K.A.L. — is the backend running?', 0)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(errorMessage(body, res.status), res.status, body?.detail?.error_type ?? null)
  return body
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

export const sendMessage = (text) => postJson('/chat', { text })

export function sendRecording(blob) {
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('file', blob, `speech.${extension}`)
  return request('/listen', { method: 'POST', body: form })
}

export const resetConversation = () => request('/reset', { method: 'POST' })
