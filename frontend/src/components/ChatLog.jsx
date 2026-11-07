import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ASSISTANT_NAME } from '../constants'
import Typewriter from './Typewriter'
import './ChatLog.css'

function ChatIcon({ name }) {
  const paths = {
    copy: 'M9 9h12v12H9zM15 5V3H3v12h2',
    check: 'm5 12 4 4L19 6',
    down: 'M12 4v16m-6-6 6 6 6-6',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}

function CopyButton({ text, label }) {
  const [result, setResult] = useState('')
  useEffect(() => {
    if (!result) return
    const timeout = setTimeout(() => setResult(''), 2000)
    return () => clearTimeout(timeout)
  }, [result])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setResult('Copied')
    } catch {
      setResult('Copy unavailable')
    }
  }
  return (
    <button type="button" className="chat-copy" aria-label={label} title={result || label} onClick={copy}>
      <ChatIcon name={result === 'Copied' ? 'check' : 'copy'} />
      <span className="copy-feedback" aria-live="polite">{result}</span>
    </button>
  )
}

function CodeBlock({ children }) {
  const language = /language-([\w+-]+)/.exec(children?.props?.className || '')?.[1] || 'code'
  const text = String(children?.props?.children ?? '')
  return (
    <div className="code-block">
      <div className="code-heading"><span>{language}</span><CopyButton text={text} label="Copy code" /></div>
      <pre>{children}</pre>
    </div>
  )
}

const markdownComponents = {
  pre: CodeBlock,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
}

function MessageText({ message }) {
  if (message.typewriter) return <Typewriter text={message.text} />
  const body = message.from === 'ai'
    ? <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.text}</Markdown>
    : message.text
  return (
    <>
      {message.streaming && (message.tool || !message.text) && (
        <div className="msg-tool"><span className="thinking-dot" aria-hidden="true" />{message.tool || 'Thinking'}</div>
      )}
      {body}
      {message.streaming && message.text && <span className="stream-cursor caret" aria-hidden="true" />}
    </>
  )
}

export default function ChatLog({ messages }) {
  const ref = useRef(null)
  const followRef = useRef(true)
  const [following, setFollowing] = useState(true)

  useEffect(() => {
    if (followRef.current) ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'auto' })
  }, [messages])

  const onScroll = () => {
    const log = ref.current
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48
    followRef.current = nearBottom
    setFollowing(nearBottom)
  }
  const jumpToLatest = () => {
    followRef.current = true
    setFollowing(true)
    ref.current?.scrollTo?.({ top: ref.current.scrollHeight, behavior: 'auto' })
  }

  return (
    <div className="chat-thread">
      <div className="log" ref={ref} role="log" aria-label="Conversation" aria-live="polite" onScroll={onScroll}>
        {messages.map((message) => (
          <article key={message.id} className={`msg ${message.from}${message.notice ? ' notice' : ''}`} aria-busy={message.streaming || undefined}>
            <span className="msg-tag">{message.from === 'ai' ? ASSISTANT_NAME : 'YOU'}</span>
            <div className="msg-body"><MessageText message={message} /></div>
            {message.from === 'ai' && !message.streaming && !message.typewriter && !message.notice && message.text && (
              <div className="msg-actions"><CopyButton text={message.text} label="Copy response" /></div>
            )}
          </article>
        ))}
      </div>
      {!following && messages.length > 0 && (
        <button type="button" className="jump-latest" aria-label="Jump to latest reply" title="Jump to latest reply" onClick={jumpToLatest}>
          <ChatIcon name="down" />
        </button>
      )}
    </div>
  )
}
