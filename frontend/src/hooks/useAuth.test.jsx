import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useAuth } from './useAuth'

const jsonResponse = (status, body) => ({ ok: status < 300, status, json: () => Promise.resolve(body) })
const GUEST = { user: null, guest: { remaining: 3, limit: 5 }, google_client_id: 'client-id' }
const USER = { user: { id: '1', name: 'Shiva Shankar', email: 's@example.com', picture: '' }, guest: null, google_client_id: 'client-id' }

beforeEach(() => {
  globalThis.fetch = vi.fn((url) => Promise.resolve(jsonResponse(200, url.endsWith('/auth/google') ? USER : GUEST)))
})

test('loads the guest session', async () => {
  const { result } = renderHook(() => useAuth())
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.guest).toEqual({ remaining: 3, limit: 5 })
  expect(result.current.user).toBeNull()
  expect(result.current.googleClientId).toBe('client-id')
})

test('signs in and out', async () => {
  const { result } = renderHook(() => useAuth())
  await waitFor(() => expect(result.current.loading).toBe(false))

  await act(async () => {
    expect(await result.current.signIn('token')).toBe(true)
  })
  expect(result.current.user.name).toBe('Shiva Shankar')

  await act(async () => {
    await result.current.signOut()
  })
  expect(result.current.user).toBeNull()
})

test('reports a failed sign-in', async () => {
  fetch.mockImplementation((url) =>
    Promise.resolve(
      url.endsWith('/auth/google')
        ? jsonResponse(401, { detail: { error_message: 'Error: Google sign-in failed.', error_type: 'InvalidGoogleTokenError' } })
        : jsonResponse(200, GUEST),
    ),
  )
  const { result } = renderHook(() => useAuth())
  await waitFor(() => expect(result.current.loading).toBe(false))

  await act(async () => {
    expect(await result.current.signIn('bad')).toBe(false)
  })
  expect(result.current.error.message).toBe('Google sign-in failed.')
})

test('updates the guest counter', async () => {
  const { result } = renderHook(() => useAuth())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.setGuestRemaining(1))
  expect(result.current.guest.remaining).toBe(1)
})
