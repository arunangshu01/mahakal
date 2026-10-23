// Fake fetch responses for tests.

export const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
})

// A streamed server-sent-events response, delivered in small chunks like a real network.
export function sseResponse(events, { chunkSize = 7 } = {}) {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () => {
          if (offset >= bytes.length) return Promise.resolve({ value: undefined, done: true })
          const value = bytes.slice(offset, offset + chunkSize)
          offset += chunkSize
          return Promise.resolve({ value, done: false })
        },
      }),
    },
  }
}

export const STREAM_TOKEN = { token: 'stream-token', stream_url: '/mahakal/api/v1/chat/stream', expires_in: 120 }
