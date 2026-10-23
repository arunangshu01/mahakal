import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { jsonResponse } from '../test/responses'
import AccountDialog from './AccountDialog'

const USER = { id: '1', name: 'Shiva Shankar', email: 'shiva@example.com', picture: '' }
let memories

beforeEach(() => {
  memories = ['Lives in Ujjain', 'Prefers Hindi']
  globalThis.fetch = vi.fn((url, options = {}) => {
    const method = options.method ?? 'GET'
    if (url.endsWith('/memories') && method === 'GET') return Promise.resolve(jsonResponse({ memories }))
    if (url.endsWith('/memories/0')) return Promise.resolve(jsonResponse({ memories: memories.slice(1) }))
    if (url.endsWith('/memories') && method === 'DELETE') return Promise.resolve(jsonResponse({ memories: [] }))
    if (url.endsWith('/reset')) return Promise.resolve(jsonResponse({ message: 'cleared' }))
    throw new Error(`Unexpected ${method} ${url}`)
  })
})

const renderDialog = (props = {}) =>
  render(
    <AccountDialog
      user={USER}
      onClose={() => {}}
      onSignOut={() => {}}
      onDeleteAccount={() => {}}
      onConversationCleared={() => {}}
      {...props}
    />,
  )

test('shows the profile and remembered facts', async () => {
  renderDialog()
  expect(screen.getByRole('heading', { name: 'Shiva Shankar' })).toBeInTheDocument()
  expect(screen.getByText('shiva@example.com')).toBeInTheDocument()
  expect(await screen.findByText('Lives in Ujjain')).toBeInTheDocument()
})

test('forgets one memory or all of them', async () => {
  renderDialog()
  await userEvent.click(await screen.findByRole('button', { name: 'Forget: Lives in Ujjain' }))
  expect(screen.queryByText('Lives in Ujjain')).toBeNull()

  await userEvent.click(screen.getByRole('button', { name: 'Forget everything' }))
  expect(await screen.findByText('Nothing remembered yet.')).toBeInTheDocument()
})

test('clears the conversation', async () => {
  const onConversationCleared = vi.fn()
  renderDialog({ onConversationCleared })
  await userEvent.click(screen.getByRole('button', { name: 'Clear conversation' }))
  expect(onConversationCleared).toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith('/mahakal/api/v1/reset', { method: 'POST' })
})

test('deleting the account needs a confirmation', async () => {
  const onDeleteAccount = vi.fn()
  renderDialog({ onDeleteAccount })

  await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
  expect(screen.getByText(/permanently deletes/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onDeleteAccount).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Delete account' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }))
  expect(onDeleteAccount).toHaveBeenCalled()
})

test('signs out and closes', async () => {
  const onSignOut = vi.fn()
  const onClose = vi.fn()
  renderDialog({ onSignOut, onClose })
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onSignOut).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})
