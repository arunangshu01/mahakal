import { useEffect, useRef } from 'react'

// Orb scales with audio level. `analyser` is a Web Audio AnalyserNode
// (mic input while listening, playback output while speaking).
export default function Orb({ state, analyserRef, onClick }) {
  const orbRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const data = new Uint8Array(256)
    const loop = () => {
      let scale = 1
      const analyser = analyserRef.current
      if (analyser && (state === 'listening' || state === 'speaking')) {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        scale = 1 + Math.min(rms * 3, 0.4)
      }
      if (orbRef.current) orbRef.current.style.transform = `scale(${scale})`
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafRef.current)
  }, [state, analyserRef])

  const icon = { idle: '🎙', listening: '⏺', thinking: '⏳', speaking: '🔊' }[state]

  return (
    <div className="orb-wrap">
      <button
        ref={orbRef}
        className={`orb ${state}`}
        onClick={onClick}
        title={state === 'listening' ? 'Click to stop' : 'Click to talk'}
      >
        {icon}
      </button>
    </div>
  )
}
