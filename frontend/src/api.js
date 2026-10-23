export const API_BASE = '/api/v1'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

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
  if (!res.ok) throw new ApiError(errorMessage(body, res.status), res.status)
  return body
}

export const getHealth = () => request('/health')

export const sendMessage = (text) =>
  request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

export function sendRecording(blob) {
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('file', blob, `speech.${extension}`)
  return request('/listen', { method: 'POST', body: form })
}

export const resetConversation = () => request('/reset', { method: 'POST' })
