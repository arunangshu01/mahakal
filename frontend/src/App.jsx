import { useCallback, useEffect, useState } from 'react'
import { getConversation } from './api'
import AccountDialog from './components/AccountDialog'
import Background from './components/Background'
import BootSequence from './components/BootSequence'
import ChatLog from './components/ChatLog'
import CommandBar from './components/CommandBar'
import SignInDialog from './components/SignInDialog'
import AccountBadge from './components/hud/AccountBadge'
import Diagnostics from './components/hud/Diagnostics'
import Modules from './components/hud/Modules'
import TopBar from './components/hud/TopBar'
import Reactor from './components/reactor/Reactor'
import { STATUS_TEXT } from './constants'
import { useAssistant } from './hooks/useAssistant'
import { useAuth } from './hooks/useAuth'
import { useHealth } from './hooks/useHealth'
import { useWakeWord } from './hooks/useWakeWord'
import './styles/layout.css'

const WAKE_WORD_KEY = 'mahakal.wakeWord'

// Storage can be unavailable (e.g. Safari private mode); the wake word just won't be remembered.
const loadWakePreference = () => {
  try {
    return window.localStorage.getItem(WAKE_WORD_KEY) === 'on'
  } catch {
    return false
  }
}
const saveWakePreference = (enabled) => {
  try {
    window.localStorage.setItem(WAKE_WORD_KEY, enabled ? 'on' : 'off')
  } catch {
    // Not remembered; fine.
  }
}
const WAKE_WORD_NOTICE =
  'Wake word on. Say "Hey Mahakal" to start talking. Your browser listens through its own speech service while this is on.'

export default function App({ skipBoot = false }) {
  const [booted, setBooted] = useState(skipBoot)
  const [hudOpen, setHudOpen] = useState(false)
  // null (closed) | 'manual' (user clicked Sign in) | 'limit' (guest messages used up)
  const [signInReason, setSignInReason] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [wakeEnabled, setWakeEnabled] = useState(loadWakePreference)

  const auth = useAuth()
  const providers = useHealth()
  const { messages, status, analyserRef, sendText, toggleListening, showHistory, clearMessages, notify } = useAssistant({
    onGuestRemaining: auth.setGuestRemaining,
    onSignInRequired: useCallback(() => setSignInReason('limit'), []),
  })

  const wake = useWakeWord({
    enabled: wakeEnabled,
    paused: status !== 'idle' || Boolean(signInReason) || accountOpen,
    onWake: toggleListening,
    onBlocked: useCallback(() => {
      setWakeEnabled(false)
      notify('Microphone access was blocked, so the wake word was turned off.')
    }, [notify]),
  })

  const toggleWakeWord = () => {
    const next = !wakeEnabled
    setWakeEnabled(next)
    saveWakePreference(next)
    if (next) notify(WAKE_WORD_NOTICE)
  }

  // Show the visitor's recent conversation when they arrive, sign in or sign out.
  const visitor = auth.loading ? null : (auth.user?.id ?? 'guest')
  useEffect(() => {
    if (!visitor) return
    getConversation()
      .then((res) => showHistory(res.messages))
      .catch(() => {})
  }, [visitor, showHistory])

  const closeSignIn = useCallback(() => setSignInReason(null), [])
  const closeAccount = useCallback(() => setAccountOpen(false), [])
  const handleCredential = useCallback(
    async (credential) => {
      if (await auth.signIn(credential)) setSignInReason(null)
    },
    [auth],
  )

  return (
    <div className="app" data-status={status}>
      <Background />
      <div className="corners" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      {!booted ? (
        <BootSequence onDone={() => setBooted(true)} />
      ) : (
        <>
          <TopBar status={status} hudOpen={hudOpen} onToggleHud={() => setHudOpen((open) => !open)}>
            <AccountBadge
              user={auth.user}
              guest={auth.guest}
              onSignIn={() => setSignInReason('manual')}
              onOpenAccount={() => setAccountOpen(true)}
            />
          </TopBar>

          <div id="hud-panels" className={`hud-panels ${hudOpen ? 'open' : ''}`}>
            <Diagnostics status={status} />
            <Modules status={status} providers={providers} />
          </div>
          {hudOpen && <div className="hud-backdrop" onClick={() => setHudOpen(false)} aria-hidden="true" />}

          <main className="main">
            <div className="stage">
              <Reactor status={status} analyserRef={analyserRef} onActivate={toggleListening} />
              <p className="status" key={status} role="status">
                <span className="status-bracket">[</span>
                {STATUS_TEXT[status]}
                <span className="status-bracket">]</span>
              </p>
            </div>
            <div className="conversation">
              <ChatLog messages={messages} />
              <CommandBar
                onSend={sendText}
                disabled={status === 'thinking'}
                wakeWord={
                  wake.supported ? { enabled: wakeEnabled, listening: wake.listening, onToggle: toggleWakeWord } : null
                }
              />
            </div>
          </main>

          {signInReason && (
            <SignInDialog
              clientId={auth.googleClientId}
              reason={signInReason}
              guestRemaining={auth.guest?.remaining ?? 0}
              error={auth.error}
              onCredential={handleCredential}
              onClose={closeSignIn}
            />
          )}

          {accountOpen && auth.user && (
            <AccountDialog
              user={auth.user}
              onClose={closeAccount}
              onConversationCleared={clearMessages}
              onSignOut={async () => {
                await auth.signOut()
                setAccountOpen(false)
              }}
              onDeleteAccount={async () => {
                await auth.deleteAccount()
                clearMessages()
                setAccountOpen(false)
                notify('Your account and all of its data have been deleted.')
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
