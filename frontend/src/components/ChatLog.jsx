import { useEffect, useRef } from 'react'
import { ASSISTANT_NAME } from '../constants'
import Typewriter from './Typewriter'
import './ChatLog.css'

export default function ChatLog({ messages }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="log" ref={ref} role="log" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.from}`}>
          <span className="msg-tag">{m.from === 'ai' ? ASSISTANT_NAME : 'YOU'}</span>
          {m.from === 'ai' ? <Typewriter text={m.text} /> : m.text}
        </div>
      ))}
    </div>
  )
}
