import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import SignInDialog from './SignInDialog'

let googleCallback
beforeEach(() => {
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn(({ callback }) => {
          googleCallback = callback
        }),
        renderButton: vi.fn((el) => {
          el.innerHTML = '<button>Sign in with Google</button>'
        }),
      },
    },
  }
})
afterEach(() => {
  delete window.google
})

const renderDialog = (props) =>
  render(
    <SignInDialog clientId="client-id" reason="manual" guestRemaining={3} onCredential={() => {}} onClose={() => {}} {...props} />,
  )

test('renders the Google button with our client ID and forwards the credential', async () => {
  const onCredential = vi.fn()
  renderDialog({ onCredential })

  await waitFor(() => expect(window.google.accounts.id.renderButton).toHaveBeenCalled())
  expect(window.google.accounts.id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-id' }))
  expect(screen.getByRole('dialog', { name: /Authenticate with M\.A\.H\.A\.K\.A\.L\./ })).toBeInTheDocument()

  googleCallback({ credential: 'id-token' })
  expect(onCredential).toHaveBeenCalledWith('id-token')
})

test('explains the guest limit and offers to continue only when messages remain', async () => {
  const { rerender } = renderDialog({ reason: 'limit', guestRemaining: 0 })
  expect(screen.getByText(/used all your guest messages/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()

  rerender(<SignInDialog clientId="client-id" reason="manual" guestRemaining={3} onCredential={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: 'Continue as guest (3 left)' })).toBeInTheDocument()
})

test('closes with the button, the backdrop or Escape', async () => {
  const onClose = vi.fn()
  const { container } = renderDialog({ onClose })

  await userEvent.click(screen.getByRole('button', { name: /Continue as guest/ }))
  fireEvent.click(container.querySelector('.signin-backdrop'))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(3)
})

test('shows sign-in errors and links to the policies', () => {
  renderDialog({ error: new Error('Google sign-in failed.') })
  expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in failed.')
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy.html')
  expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms.html')
})
