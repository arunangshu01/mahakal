import { useState } from 'react'
import Background from './components/Background'
import BootSequence from './components/BootSequence'
import ChatLog from './components/ChatLog'
import CommandBar from './components/CommandBar'
import Diagnostics from './components/hud/Diagnostics'
import Modules from './components/hud/Modules'
import TopBar from './components/hud/TopBar'
import Reactor from './components/reactor/Reactor'
import { STATUS_TEXT } from './constants'
import { useAssistant } from './hooks/useAssistant'
import { useHealth } from './hooks/useHealth'
import './styles/layout.css'

export default function App({ skipBoot = false }) {
  const [booted, setBooted] = useState(skipBoot)
  const [hudOpen, setHudOpen] = useState(false)
  const { messages, status, analyserRef, sendText, toggleListening } = useAssistant()
  const providers = useHealth()

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
          <TopBar status={status} hudOpen={hudOpen} onToggleHud={() => setHudOpen((open) => !open)} />

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
              <CommandBar onSend={sendText} disabled={status === 'thinking'} />
            </div>
          </main>
        </>
      )}
    </div>
  )
}
