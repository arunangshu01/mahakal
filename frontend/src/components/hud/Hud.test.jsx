import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AccountBadge from './AccountBadge'
import Diagnostics from './Diagnostics'
import Modules from './Modules'
import TopBar from './TopBar'

const moduleState = (name) => within(screen.getByText(name).closest('li')).getByText(/ONLINE|OFFLINE|CHECKING/)

test('TopBar shows the name, status and a HUD toggle', async () => {
  const onToggleHud = vi.fn()
  render(<TopBar status="listening" hudOpen={false} onToggleHud={onToggleHud} />)

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('M.A.H.A.K.A.L.')
  expect(screen.getByText('SYS LISTENING')).toBeInTheDocument()

  const toggle = screen.getByRole('button', { name: 'HUD' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(toggle)
  expect(onToggleHud).toHaveBeenCalled()
})

test('Modules reflects which providers the backend has configured', () => {
  const { rerender } = render(<Modules status="idle" providers={null} />)
  expect(moduleState('GROQ · GPT-OSS')).toHaveTextContent('CHECKING')

  rerender(<Modules status="idle" providers={{ groq: false, gemini: true }} />)
  expect(moduleState('GROQ · GPT-OSS')).toHaveTextContent('OFFLINE')
  expect(moduleState('GEMINI')).toHaveTextContent('ONLINE')
  expect(moduleState('WHISPER')).toHaveTextContent('ONLINE')
})

test('AccountBadge shows guest messages left and a sign-in button', async () => {
  const onSignIn = vi.fn()
  render(<AccountBadge user={null} guest={{ remaining: 2, limit: 5 }} onSignIn={onSignIn} onOpenAccount={() => {}} />)
  expect(screen.getByText('GUEST · 2/5')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'SIGN IN' }))
  expect(onSignIn).toHaveBeenCalled()
})

test('AccountBadge shows the signed-in user and opens the account panel', async () => {
  const onOpenAccount = vi.fn()
  const user = { id: '1', name: 'Shiva Shankar', email: 's@example.com', picture: '' }
  render(<AccountBadge user={user} guest={null} onSignIn={() => {}} onOpenAccount={onOpenAccount} />)
  expect(screen.getByText('SHIVA')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Account: Shiva Shankar' }))
  expect(onOpenAccount).toHaveBeenCalled()
})

test('Diagnostics renders every metric', () => {
  render(<Diagnostics status="idle" />)
  for (const metric of ['NEURAL CORE', 'VOICE MATRIX', 'KNOWLEDGE GRID', 'LINK STABILITY', 'SHAKTI RESERVE']) {
    expect(screen.getByText(metric)).toBeInTheDocument()
  }
  expect(screen.getByText('INDESTRUCTIBLE')).toBeInTheDocument()
})
