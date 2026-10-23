import { useCallback, useEffect, useRef, useState } from 'react'
import { isSignInRequired, sendMessage, sendRecording } from '../api'

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

  const addMessage = useCallback((text, from) => {
    setMessages((m) => [...m, { id: ++nextId, text, from }])
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

  const handleReply = useCallback(
    async (request, userText) => {
      if (userText) addMessage(userText, 'user')
      setStatus('thinking')
      try {
        const res = await request()
        if (res.transcript) addMessage(res.transcript, 'user')
        addMessage(res.reply, 'ai')
        if (res.guest_remaining != null) callbacksRef.current.onGuestRemaining?.(res.guest_remaining)
        playReply(res.audio_b64)
      } catch (error) {
        addMessage(error.message, 'ai')
        setStatus('idle')
        if (isSignInRequired(error)) {
          callbacksRef.current.onGuestRemaining?.(0)
          callbacksRef.current.onSignInRequired?.()
        }
      }
    },
    [addMessage, playReply],
  )

  const sendText = useCallback(
    (text) => {
      const message = text.trim()
      if (!message || status === 'thinking') return false
      handleReply(() => sendMessage(message), message)
      return true
    },
    [handleReply, status],
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
      handleReply(() => sendRecording(blob))
    }
    recorderRef.current = recorder
    recorder.start()
    setStatus('listening')
  }

  const toggleListening = () => {
    if (status === 'listening') recorderRef.current?.stop()
    else if (status === 'idle') startListening()
  }

  return { messages, status, analyserRef, sendText, toggleListening }
}
