import { useCallback, useEffect, useRef, useState } from 'react'
import { isSignInRequired, sendRecording, streamMessage } from '../api'

const MIC_UNAVAILABLE =
  'Voice input needs microphone access over HTTPS (or localhost). You can still type below.'
const MIC_BLOCKED = 'Microphone access was blocked. Allow it in your browser settings, or type below.'

let nextId = 0

// Drives the conversation: status machine (idle → listening → thinking → speaking),
// mic recording, reply playback and the analyser the reactor visualises.
// `onGuestRemaining(n)` reports the guest allowance after each reply;
// `onSignInRequired()` fires when a guest has used all of their free messages.
export function useAssistant({ onGuestRemaining, onSignInRequired } = {}) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle')
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const recorderRef = useRef(null)
  const callbacksRef = useRef({ onGuestRemaining, onSignInRequired })

  useEffect(() => {
    callbacksRef.current = { onGuestRemaining, onSignInRequired }
  }, [onGuestRemaining, onSignInRequired])

  // Message: { id, text, from: 'user' | 'ai', typewriter?, streaming?, tool? }
  const addMessage = useCallback((text, from, extra = {}) => {
    const id = ++nextId
    setMessages((m) => [...m, { id, text, from, ...extra }])
    return id
  }, [])

  const updateMessage = useCallback((id, update) => {
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, ...update(msg) } : msg)))
  }, [])

  // Replaces the chat with past history, keeping any notices (e.g. "account deleted").
  const showHistory = useCallback((history) => {
    const past = history.map(({ role, content }) => ({ id: ++nextId, text: content, from: role === 'user' ? 'user' : 'ai' }))
    setMessages((m) => [...past, ...m.filter((msg) => msg.notice)])
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  const notify = useCallback((text) => addMessage(text, 'ai', { notice: true }), [addMessage])

  const reportGuestRemaining = (remaining) => {
    if (remaining != null) callbacksRef.current.onGuestRemaining?.(remaining)
  }

  const handleFailure = useCallback((error) => {
    setStatus('idle')
    if (isSignInRequired(error)) {
      callbacksRef.current.onGuestRemaining?.(0)
      callbacksRef.current.onSignInRequired?.()
    }
  }, [])

  const audioContext = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new Ctx()
    }
    // Safari and mobile Chrome start the context suspended until a user gesture.
    audioCtxRef.current.resume?.()
    return audioCtxRef.current
  }

  const createAnalyser = (ctx, source) => {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    return analyser
  }

  const playReply = useCallback((audioB64) => {
    if (!audioB64) {
      setStatus('idle')
      return
    }
    const ctx = audioContext()
    const audio = new Audio(`data:audio/mpeg;base64,${audioB64}`)
    const source = ctx.createMediaElementSource(audio)
    const analyser = createAnalyser(ctx, source)
    analyser.connect(ctx.destination)
    analyserRef.current = analyser

    const finish = () => {
      analyserRef.current = null
      source.disconnect()
      setStatus('idle')
    }
    audio.onended = finish
    setStatus('speaking')
    audio.play().catch(finish)
  }, [])

  // Voice: the whole reply arrives at once and is revealed with a typewriter effect.
  const handleVoiceReply = useCallback(
    async (blob) => {
      setStatus('thinking')
      try {
        const res = await sendRecording(blob)
        if (res.transcript) addMessage(res.transcript, 'user')
        addMessage(res.reply, 'ai', { typewriter: true })
        reportGuestRemaining(res.guest_remaining)
        playReply(res.audio_b64)
      } catch (error) {
        addMessage(error.message, 'ai')
        handleFailure(error)
      }
    },
    [addMessage, handleFailure, playReply],
  )

  // Text: the reply streams in as it is generated; tool use (weather, search…) is shown live.
  const sendText = useCallback(
    (text) => {
      const message = text.trim()
      if (!message || status === 'thinking') return false
      addMessage(message, 'user')
      setStatus('thinking')
      const id = addMessage('', 'ai', { streaming: true })
      streamMessage(message, (event) => {
        if (event.type === 'tool') updateMessage(id, () => ({ tool: event.label }))
        if (event.type === 'delta') updateMessage(id, (msg) => ({ text: msg.text + event.text, tool: null }))
      })
        .then((done) => {
          updateMessage(id, () => ({ text: done.reply, streaming: false, tool: null }))
          reportGuestRemaining(done.guest_remaining)
          playReply(done.audio_b64)
        })
        .catch((error) => {
          updateMessage(id, () => ({ text: error.message, streaming: false, tool: null }))
          handleFailure(error)
        })
      return true
    },
    [addMessage, handleFailure, playReply, status, updateMessage],
  )

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      addMessage(MIC_UNAVAILABLE, 'ai')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      addMessage(MIC_BLOCKED, 'ai')
      return
    }

    const ctx = audioContext()
    const source = ctx.createMediaStreamSource(stream)
    analyserRef.current = createAnalyser(ctx, source)

    const recorder = new MediaRecorder(stream)
    const chunks = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      source.disconnect()
      analyserRef.current = null
      // iOS Safari records audio/mp4, everything else webm/ogg.
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      handleVoiceReply(blob)
    }
    recorderRef.current = recorder
    recorder.start()
    setStatus('listening')
  }

  const toggleListening = () => {
    if (status === 'listening') recorderRef.current?.stop()
    else if (status === 'idle') startListening()
  }

  return { messages, status, analyserRef, sendText, toggleListening, showHistory, clearMessages, notify }
}
