import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App'

const jsonResponse = (body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) })

beforeEach(() => {
  globalThis.fetch = vi.fn((url) =>
    Promise.resolve(
      url.endsWith('/health')
        ? jsonResponse({ status: 'OK', code: 200, providers: { groq: true, gemini: false } })
        : jsonResponse({ reply: 'I am M.A.H.A.K.A.L.', audio_b64: '' }),
    ),
  )
})

test('starts with the boot sequence', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: 'Skip boot sequence' })).toBeInTheDocument()
  expect(screen.queryByRole('main')).toBeNull()
})

test('chatting by text shows both sides of the conversation', async () => {
  render(<App skipBoot />)
  expect(screen.getByRole('status')).toHaveTextContent('STANDING BY')

  await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Who are you?{Enter}')

  expect(screen.getByText('Who are you?')).toBeInTheDocument()
  expect(await screen.findByLabelText('I am M.A.H.A.K.A.L.')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/v1/chat', expect.objectContaining({ method: 'POST' }))
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
