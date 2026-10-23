import { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ASSISTANT_NAME } from '../constants'
import Typewriter from './Typewriter'
import './ChatLog.css'

function MessageText({ message }) {
  if (message.typewriter) return <Typewriter text={message.text} />
  const body =
    message.from === 'ai' ? (
      <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
    ) : (
      message.text
    )
  if (!message.streaming) return body
  return (
    <>
      {message.tool && <span className="msg-tool">⟳ {message.tool}…</span>}
      {body}
      <span className="caret" aria-hidden="true">
        ▌
      </span>
    </>
  )
}

export default function ChatLog({ messages }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="log" ref={ref} role="log" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.from}`} aria-busy={m.streaming || undefined}>
          <span className="msg-tag">{m.from === 'ai' ? ASSISTANT_NAME : 'YOU'}</span>
          <MessageText message={m} />
        </div>
      ))}
    </div>
  )
}
