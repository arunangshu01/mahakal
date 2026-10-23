import { useState } from 'react'
import './CommandBar.css'

export default function CommandBar({ onSend, disabled }) {
  const [text, setText] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (onSend(text)) setText('')
  }

  return (
    <form className="command-bar" onSubmit={submit}>
      <span className="prompt" aria-hidden="true">
        &gt;
      </span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Issue a command…"
        aria-label="Message"
        enterKeyHint="send"
        autoComplete="off"
        maxLength={2000}
      />
      <button type="submit" disabled={disabled || !text.trim()}>
        Transmit
      </button>
    </form>
  )
}
