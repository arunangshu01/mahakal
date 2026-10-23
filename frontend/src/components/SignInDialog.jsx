import { useEffect } from 'react'
import { ASSISTANT_NAME } from '../constants'
import { useGoogleButton } from '../hooks/useGoogleButton'
import './SignInDialog.css'

export default function SignInDialog({ clientId, reason, guestRemaining, error, onCredential, onClose }) {
  const { containerRef, failed } = useGoogleButton(clientId, onCredential)
  const canContinueAsGuest = guestRemaining > 0

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="signin-backdrop" onClick={onClose}>
      <div
        className="signin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="signin-eyebrow">IDENTITY VERIFICATION</p>
        <h2 id="signin-title">Authenticate with {ASSISTANT_NAME}</h2>
        <p className="signin-text">
          {reason === 'limit'
            ? 'You have used all your guest messages. Sign in with Google to keep talking — your conversation comes with you.'
            : 'Sign in with Google to keep your conversation history and talk without limits.'}
        </p>

        <div className="signin-button" ref={containerRef} />
        {!clientId && <p className="signin-error">Google sign-in is not configured yet.</p>}
        {failed && <p className="signin-error">Could not load Google sign-in. Check your connection and try again.</p>}
        {error && <p className="signin-error" role="alert">{error.message}</p>}

        <div className="signin-actions">
          <button type="button" className="signin-secondary" onClick={onClose}>
            {canContinueAsGuest ? `Continue as guest (${guestRemaining} left)` : 'Not now'}
          </button>
        </div>

        <p className="signin-legal">
          By signing in you agree to the <a href="/terms.html">Terms</a> and <a href="/privacy.html">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
