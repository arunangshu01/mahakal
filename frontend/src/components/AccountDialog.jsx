import { useEffect, useState } from 'react'
import { clearMemories, deleteMemory, getMemories, resetConversation } from '../api'
import { ASSISTANT_NAME } from '../constants'
import './SignInDialog.css'
import './AccountDialog.css'

export default function AccountDialog({ user, onClose, onSignOut, onDeleteAccount, onConversationCleared }) {
  const [memories, setMemories] = useState(null)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMemories()
      .then((res) => setMemories(res.memories))
      .catch((e) => setError(e))
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin-backdrop" onClick={onClose}>
      <div
        className="signin-dialog account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="signin-eyebrow">OPERATOR PROFILE</p>
        <h2 id="account-title">{user.name}</h2>
        <p className="account-email">{user.email}</p>

        <section className="account-section" aria-labelledby="memory-title">
          <h3 id="memory-title">Memory core</h3>
          <p className="account-hint">What {ASSISTANT_NAME} remembers about you. Ask it to remember or forget things.</p>
          {memories === null && !error && <p className="account-hint">Loading…</p>}
          {memories?.length === 0 && <p className="account-hint">Nothing remembered yet.</p>}
          {memories?.length > 0 && (
            <ul className="memory-list">
              {memories.map((memory, index) => (
                <li key={`${index}-${memory}`}>
                  <span>{memory}</span>
                  <button
                    type="button"
                    aria-label={`Forget: ${memory}`}
                    disabled={busy}
                    onClick={() => run(async () => setMemories((await deleteMemory(index)).memories))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {memories?.length > 0 && (
            <button
              type="button"
              className="signin-secondary"
              disabled={busy}
              onClick={() => run(async () => setMemories((await clearMemories()).memories))}
            >
              Forget everything
            </button>
          )}
        </section>

        <section className="account-section">
          <h3>Conversation</h3>
          <button
            type="button"
            className="signin-secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await resetConversation()
                onConversationCleared()
              })
            }
          >
            Clear conversation
          </button>
        </section>

        {error && (
          <p className="signin-error" role="alert">
            {error.message}
          </p>
        )}

        <div className="account-actions">
          <button type="button" className="signin-secondary" disabled={busy} onClick={() => run(onSignOut)}>
            Sign out
          </button>
          {!confirmingDelete ? (
            <button type="button" className="signin-secondary danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
              Delete account
            </button>
          ) : (
            <div className="account-confirm" role="group" aria-label="Confirm account deletion">
              <p>This permanently deletes your profile, conversation and memories.</p>
              <button type="button" className="signin-secondary danger" disabled={busy} onClick={() => run(onDeleteAccount)}>
                Yes, delete everything
              </button>
              <button type="button" className="signin-secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>

        <button type="button" className="account-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  )
}
