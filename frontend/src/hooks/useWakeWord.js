import { useEffect, useRef, useState } from 'react'

// Matches "Hey Mahakal", "OK Mahakaal", "Maha Kal", and how recognisers often hear it ("Maha call").
const WAKE_PHRASE = /\b(?:(?:hey|hi|ok|okay)\s+)?maha\s*-?\s*(?:kaal|kal|kall|call|cal|col)\b/i
const RESTART_DELAY_MS = 300

export const isWakePhrase = (text) => WAKE_PHRASE.test(text)

const getRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition

// Listens for the wake phrase with the browser's speech recognition while `enabled` and not `paused`.
// Calls `onWake()` when it hears it. Note: browsers send this audio to their own speech service.
export function useWakeWord({ enabled, paused, onWake, onBlocked }) {
  const supported = Boolean(getRecognition())
  const [listening, setListening] = useState(false)
  const callbacksRef = useRef({ onWake, onBlocked })

  useEffect(() => {
    callbacksRef.current = { onWake, onBlocked }
  }, [onWake, onBlocked])

  useEffect(() => {
    if (!supported || !enabled || paused) return undefined
    const Recognition = getRecognition()
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-IN'
    let stopped = false
    let restartTimer = 0

    const start = () => {
      try {
        recognition.start()
        setListening(true)
      } catch {
        // Already started; nothing to do.
      }
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (isWakePhrase(event.results[i][0].transcript)) {
          stopped = true
          recognition.abort()
          callbacksRef.current.onWake?.()
          return
        }
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopped = true
        callbacksRef.current.onBlocked?.()
      }
    }
    // Recognition stops after silence; keep it going while the wake word is enabled.
    recognition.onend = () => {
      setListening(false)
      if (!stopped) restartTimer = setTimeout(start, RESTART_DELAY_MS)
    }

    start()
    return () => {
      stopped = true
      clearTimeout(restartTimer)
      recognition.abort()
      setListening(false)
    }
  }, [supported, enabled, paused])

  return { supported, listening }
}
