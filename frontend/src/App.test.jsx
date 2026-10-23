import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { STREAM_TOKEN, jsonResponse, sseResponse } from './test/responses'

const GUEST_SESSION = { user: null, guest: { remaining: 2, limit: 5 }, google_client_id: 'client-id' }
const USER = { id: '1', name: 'Shiva Shankar', email: 'shiva@example.com', picture: '' }
let routes

beforeEach(() => {
  window.localStorage.clear()
  routes = {
    'GET /health': () => jsonResponse({ status: 'OK', code: 200, providers: { groq: true, gemini: false } }),
    'GET /auth/me': () => jsonResponse(GUEST_SESSION),
    'GET /conversation': () => jsonResponse({ messages: [] }),
    'POST /chat/stream-token': () => jsonResponse(STREAM_TOKEN),
    'POST /chat/stream': () =>
      sseResponse([
        { type: 'delta', text: 'I am ' },
        { type: 'delta', text: 'M.A.H.A.K.A.L.' },
        { type: 'done', reply: 'I am M.A.H.A.K.A.L.', audio_b64: '', guest_remaining: 1 },
      ]),
  }
  globalThis.fetch = vi.fn((url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url.replace('/mahakal/api/v1', '')}`
    if (!routes[key]) throw new Error(`Unexpected request: ${key}`)
    return Promise.resolve(routes[key]())
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('starts with the boot sequence', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: 'Skip boot sequence' })).toBeInTheDocument()
  expect(screen.queryByRole('main')).toBeNull()
})

test('streams a text reply and updates the guest counter', async () => {
  render(<App skipBoot />)
  expect(screen.getByRole('status')).toHaveTextContent('STANDING BY')
  expect(await screen.findByText('GUEST · 2/5')).toBeInTheDocument()

  await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Who are you?{Enter}')

  expect(screen.getByText('Who are you?')).toBeInTheDocument()
  expect(await screen.findByText('I am M.A.H.A.K.A.L.')).toBeInTheDocument()
  expect(await screen.findByText('GUEST · 1/5')).toBeInTheDocument()
})

test('shows the previous conversation when you come back', async () => {
  routes['GET /conversation'] = () =>
    jsonResponse({ messages: [{ role: 'user', content: 'Remember me?' }, { role: 'assistant', content: 'Of course.' }] })
  render(<App skipBoot />)
  expect(await screen.findByText('Remember me?')).toBeInTheDocument()
  expect(screen.getByText('Of course.')).toBeInTheDocument()
})

test('opens the sign-in dialog when the guest limit is reached', async () => {
  routes['POST /chat/stream'] = () =>
    jsonResponse({ detail: { error_message: 'Error: Sign in with Google.', error_type: 'GuestLimitReachedError' } }, 401)
  render(<App skipBoot />)

  await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello{Enter}')

  expect(await screen.findByRole('dialog')).toHaveTextContent(/used all your guest messages/i)
  expect(screen.getByText('GUEST · 0/5')).toBeInTheDocument()
})

test('the Sign in button opens the dialog', async () => {
  render(<App skipBoot />)
  await userEvent.click(await screen.findByRole('button', { name: 'SIGN IN' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Continue as guest/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('signed-in users can open their account and delete it', async () => {
  routes['GET /auth/me'] = () => jsonResponse({ user: USER, guest: null, google_client_id: 'client-id' })
  routes['GET /memories'] = () => jsonResponse({ memories: ['Lives in Ujjain'] })
  routes['DELETE /auth/account'] = () => jsonResponse(GUEST_SESSION)
  render(<App skipBoot />)

  await userEvent.click(await screen.findByRole('button', { name: 'Account: Shiva Shankar' }))
  expect(await screen.findByText('Lives in Ujjain')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }))

  expect(await screen.findByText(/account and all of its data have been deleted/i)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('GUEST · 2/5')).toBeInTheDocument()
})

test('the wake word toggle is offered where speech recognition exists', async () => {
  const instances = []
  vi.stubGlobal(
    'SpeechRecognition',
    class {
      constructor() {
        instances.push(this)
      }
      start() {}
      abort() {}
    },
  )
  render(<App skipBoot />)

  const toggle = screen.getByRole('button', { name: /Wake word/ })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(toggle)

  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(window.localStorage.getItem('mahakal.wakeWord')).toBe('on')
  expect(screen.getByText(/Wake word on/)).toBeInTheDocument()
  await waitFor(() => expect(instances.length).toBeGreaterThan(0))
})

test('no wake word toggle without speech recognition', () => {
  render(<App skipBoot />)
  expect(screen.queryByRole('button', { name: /Wake word/ })).toBeNull()
})

test('the HUD toggle opens and closes the side panels', async () => {
  const { container } = render(<App skipBoot />)
  const panels = container.querySelector('#hud-panels')

  await userEvent.click(screen.getByRole('button', { name: 'HUD' }))
  expect(panels).toHaveClass('open')

  await userEvent.click(screen.getByRole('button', { name: 'CLOSE' }))
  expect(panels).not.toHaveClass('open')
})

test('shows provider status from the health check', async () => {
  render(<App skipBoot />)
  expect(await screen.findAllByText('ONLINE')).not.toHaveLength(0)
  expect(screen.getByText('OFFLINE')).toBeInTheDocument()
})
