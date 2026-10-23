import { useRef, useState } from 'react'
import Orb from './Orb'
import './App.css'

export default function App() {
  const [messages, setMessages] = useState([])
  const [state, setState] = useState('idle') // idle | listening | thinking | speaking
  const [text, setText] = useState('')

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)

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
    <div className="app">
      <header>M A H A K A L</header>
      <Orb state={state} analyserRef={analyserRef} onClick={onOrbClick} />
      <div className="status">
        {state === 'idle' && 'Ready — click to talk'}
        {state === 'listening' && 'Listening — click to stop'}
        {state === 'thinking' && 'Thinking…'}
        {state === 'speaking' && 'Speaking…'}
      </div>
      <div className="log">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.cls}`}>{m.text}</div>
        ))}
      </div>
      <div className="textbar">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          placeholder="Type a message…"
        />
        <button onClick={sendText}>Send</button>
      </div>
    </div>
  )
}
