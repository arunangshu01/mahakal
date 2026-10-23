import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App'

const jsonResponse = (body, status = 200) => ({ ok: status < 300, status, json: () => Promise.resolve(body) })
const SESSION = { user: null, guest: { remaining: 2, limit: 5 }, google_client_id: 'client-id' }
let routes

beforeEach(() => {
  routes = {
    '/health': () => jsonResponse({ status: 'OK', code: 200, providers: { groq: true, gemini: false } }),
    '/auth/me': () => jsonResponse(SESSION),
    '/chat': () => jsonResponse({ reply: 'I am M.A.H.A.K.A.L.', audio_b64: '', guest_remaining: 1 }),
  }
  globalThis.fetch = vi.fn((url) => Promise.resolve(routes[url.replace('/api/v1', '')]()))
})

test('starts with the boot sequence', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: 'Skip boot sequence' })).toBeInTheDocument()
  expect(screen.queryByRole('main')).toBeNull()
})

test('chatting by text shows both sides and updates the guest counter', async () => {
  render(<App skipBoot />)
  expect(screen.getByRole('status')).toHaveTextContent('STANDING BY')
  expect(await screen.findByText('GUEST · 2/5')).toBeInTheDocument()

  await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Who are you?{Enter}')

  expect(screen.getByText('Who are you?')).toBeInTheDocument()
  expect(await screen.findByLabelText('I am M.A.H.A.K.A.L.')).toBeInTheDocument()
  expect(await screen.findByText('GUEST · 1/5')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({ method: 'POST' }))
})

test('opens the sign-in dialog when the guest limit is reached', async () => {
  routes['/chat'] = () =>
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
