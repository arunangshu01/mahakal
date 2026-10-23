import { useState } from 'react'
import './CommandBar.css'

// `wakeWord` (optional): { enabled, listening, onToggle } for the "Hey Mahakal" toggle.
export default function CommandBar({ onSend, disabled, wakeWord }) {
  const [text, setText] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (onSend(text)) setText('')
  }

  return (
    <form className="command-bar" onSubmit={submit}>
      {wakeWord ? (
        <button
          type="button"
          className={`wake-toggle ${wakeWord.enabled ? 'on' : ''} ${wakeWord.listening ? 'listening' : ''}`}
          onClick={wakeWord.onToggle}
          aria-pressed={wakeWord.enabled}
          aria-label="Wake word: say Hey Mahakal"
          title={wakeWord.enabled ? 'Listening for "Hey Mahakal" — click to turn off' : 'Turn on "Hey Mahakal"'}
        >
          <span aria-hidden="true">◉</span> WAKE
        </button>
      ) : (
        <span className="prompt" aria-hidden="true">
          &gt;
        </span>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={wakeWord?.enabled ? 'Say "Hey Mahakal" or type…' : 'Issue a command…'}
        aria-label="Message"
        enterKeyHint="send"
        autoComplete="off"
        maxLength={2000}
      />
      <button type="submit" className="transmit" disabled={disabled || !text.trim()}>
        Transmit
      </button>
    </form>
  )
}
