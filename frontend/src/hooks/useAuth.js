import { useCallback, useEffect, useState } from 'react'
import { deleteAccount as deleteAccountRequest, getSession, signInWithGoogle, signOut as signOutRequest } from '../api'

// The current visitor: a signed-in Google user, or a guest with a few free messages.
export function useAuth() {
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((s) => !cancelled && setSession(s))
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (credential) => {
    setError(null)
    try {
      setSession(await signInWithGoogle(credential))
      return true
    } catch (e) {
      setError(e)
      return false
    }
  }, [])

  const signOut = useCallback(async () => {
    setSession(await signOutRequest())
  }, [])

  // Permanently deletes the signed-in user's data; the visitor becomes a guest again.
  const deleteAccount = useCallback(async () => {
    setSession(await deleteAccountRequest())
  }, [])

  const setGuestRemaining = useCallback((remaining) => {
    setSession((s) => (s?.guest ? { ...s, guest: { ...s.guest, remaining } } : s))
  }, [])

  return {
    loading: session === null && error === null,
    user: session?.user ?? null,
    guest: session?.guest ?? null,
    googleClientId: session?.google_client_id ?? '',
    error,
    signIn,
    signOut,
    deleteAccount,
    setGuestRemaining,
  }
}
