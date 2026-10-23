import { useEffect, useRef, useState } from 'react'
import Background from './Background'
import { Boot, Diagnostics, Modules, TopBar, Typewriter } from './Hud'
import Orb from './Orb'
import './App.css'

const STATUS = {
  idle: 'STANDING BY — TAP THE CORE TO SPEAK',
  listening: 'LISTENING — TAP TO TRANSMIT',
  thinking: 'PROCESSING',
  speaking: 'RESPONDING',
}

export default function App() {
  const [booted, setBooted] = useState(false)
  const [messages, setMessages] = useState([])
  const [state, setState] = useState('idle') // idle | listening | thinking | speaking
  const [text, setText] = useState('')

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const logRef = useRef(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const addMsg = (text, cls) =>
    setMessages((m) => [...m, { text, cls, id: crypto.randomUUID() }])

  const getCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }

  const stopListening = () => recorderRef.current?.stop()

  const playAudio = (b64) => {
    const ctx = getCtx()
    const audio = new Audio('data:audio/mpeg;base64,' + b64)
    const src = ctx.createMediaElementSource(audio)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    analyser.connect(ctx.destination)
    analyserRef.current = analyser
    setState('speaking')
    audio.onended = () => {
      analyserRef.current = null
      src.disconnect()
      setState('idle')
    }
    audio.play()
  }

  const startListening = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    const ctx = getCtx()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    analyserRef.current = analyser

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      src.disconnect()
      analyserRef.current = null
      setState('thinking')
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('file', blob, 'speech.webm')
      try {
        const res = await fetch('/api/listen', { method: 'POST', body: fd }).then((r) => r.json())
        if (res.transcript) addMsg(res.transcript, 'user')
        addMsg(res.reply, 'ai')
        if (res.audio_b64) playAudio(res.audio_b64)
        else setState('idle')
      } catch {
        addMsg('Connection error — is the backend running?', 'ai')
        setState('idle')
      }
    }
    recorder.start()
    setState('listening')
  }

  const onOrbClick = () => {
    if (state === 'listening') stopListening()
    else if (state === 'idle') startListening()
  }

  const sendText = async () => {
    const t = text.trim()
    if (!t || state === 'thinking') return
    setText('')
    addMsg(t, 'user')
    setState('thinking')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      }).then((r) => r.json())
      addMsg(res.reply, 'ai')
      if (res.audio_b64) playAudio(res.audio_b64)
      else setState('idle')
    } catch {
      addMsg('Connection error — is the backend running?', 'ai')
      setState('idle')
    }
  }

  return (
    <div className="app" data-state={state}>
      <Background />
      <div className="corners" aria-hidden="true">
        <i /><i /><i /><i />
      </div>

      {!booted ? (
        <Boot onDone={() => setBooted(true)} />
      ) : (
        <>
          <TopBar state={state} />
          <Diagnostics state={state} />

          <main className="main">
            <Orb state={state} analyserRef={analyserRef} onClick={onOrbClick} />
            <div className="status" key={state}>
              <span className="status-bracket">[</span>
              {STATUS[state]}
              <span className="status-bracket">]</span>
            </div>
            <div className="log" ref={logRef}>
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.cls}`}>
                  <span className="msg-tag">{m.cls === 'ai' ? 'M.A.H.A.K.A.L.' : 'YOU'}</span>
                  {m.cls === 'ai' ? <Typewriter text={m.text} /> : m.text}
                </div>
              ))}
            </div>
            <div className="textbar">
              <span className="prompt">&gt;</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendText()}
                placeholder="Issue a command…"
              />
              <button onClick={sendText}>Transmit</button>
            </div>
          </main>

          <Modules state={state} />
        </>
      )}
    </div>
  )
}
