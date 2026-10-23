import { useEffect, useRef, useState } from 'react'
import MahakalEmblem from './MahakalEmblem'

const BARS = 96
const TICKS = Array.from({ length: 120 }, (_, i) => {
  const a = (i / 120) * Math.PI * 2
  const r1 = i % 10 === 0 ? 178 : i % 5 === 0 ? 184 : 188
  return [200 + Math.cos(a) * r1, 200 + Math.sin(a) * r1, 200 + Math.cos(a) * 196, 200 + Math.sin(a) * 196]
})
const RING_TEXT =
  'M.A.H.A.K.A.L. • MODULAR AGENTIC HUB • AUTOMATION • KNOWLEDGE • ADAPTIVE LOGIC • HAR HAR MAHADEV • '

// Reactor core. `analyserRef` holds a Web Audio AnalyserNode
// (mic input while listening, playback output while speaking).
export default function Orb({ state, analyserRef, onClick }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [portrait, setPortrait] = useState('pending')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const freq = new Uint8Array(256)
    const wave = new Uint8Array(256)
    let raf = 0
    let level = 0

    const draw = (t) => {
      const dpr = window.devicePixelRatio || 1
      const size = canvas.clientWidth * dpr
      if (canvas.width !== size) canvas.width = canvas.height = size
      const s = size / 400
      ctx.setTransform(s, 0, 0, s, 0, 0)
      ctx.clearRect(0, 0, 400, 400)

      const analyser = analyserRef.current
      const live = analyser && (state === 'listening' || state === 'speaking')
      let rms = 0
      if (live) {
        analyser.getByteFrequencyData(freq)
        analyser.getByteTimeDomainData(wave)
        for (let i = 0; i < wave.length; i++) rms += ((wave[i] - 128) / 128) ** 2
        rms = Math.sqrt(rms / wave.length)
      }
      level += (Math.min(rms * 3, 1) - level) * 0.25
      wrapRef.current?.style.setProperty('--level', level.toFixed(3))

      const rgb = getComputedStyle(canvas).getPropertyValue('--accent-rgb').trim() || '0,229,255'
      const time = t / 1000

      for (let i = 0; i < BARS; i++) {
        const half = i < BARS / 2 ? i : BARS - 1 - i
        const v = live
          ? freq[Math.floor((half / (BARS / 2)) * 140)] / 255
          : state === 'thinking'
            ? 0.25 + 0.25 * Math.sin(time * 6 + i * 0.5)
            : 0.08 + 0.06 * Math.sin(time * 1.5 + i * 0.35)
        const a = (i / BARS) * Math.PI * 2 - Math.PI / 2
        const r0 = 118
        const r1 = r0 + 6 + v * 46
        ctx.strokeStyle = `rgba(${rgb},${0.35 + v * 0.65})`
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.moveTo(200 + Math.cos(a) * r0, 200 + Math.sin(a) * r0)
        ctx.lineTo(200 + Math.cos(a) * r1, 200 + Math.sin(a) * r1)
        ctx.stroke()
      }

      ctx.beginPath()
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2
        const w = live ? (wave[i * 2 % 256] - 128) / 128 : Math.sin(time * 2 + i * 0.4) * 0.05
        const r = 108 + w * 14
        const x = 200 + Math.cos(a) * r
        const y = 200 + Math.sin(a) * r
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.strokeStyle = `rgba(${rgb},0.55)`
      ctx.lineWidth = 1.2
      ctx.stroke()

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [state, analyserRef])

  return (
    <div className={`reactor ${state} ${portrait === 'ok' ? 'has-portrait' : ''}`} ref={wrapRef}>
      <svg className="rings" viewBox="0 0 400 400" aria-hidden="true">
        <defs>
          <path id="ringTextPath" d="M200,200 m-152,0 a152,152 0 1,1 304,0 a152,152 0 1,1 -304,0" />
        </defs>
        <g className="ring spin-slow">
          {TICKS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i % 10 === 0 ? 'tick major' : 'tick'} />
          ))}
        </g>
        <circle className="ring spin-rev dash-a" cx="200" cy="200" r="170" />
        <g className="ring spin-fast">
          <circle className="arc arc-1" cx="200" cy="200" r="162" />
          <circle className="arc arc-2" cx="200" cy="200" r="162" />
        </g>
        <g className="ring spin-rev-slow">
          <text className="ring-text">
            <textPath href="#ringTextPath">{RING_TEXT}</textPath>
          </text>
        </g>
        <circle className="ring spin-med dash-b" cx="200" cy="200" r="138" />
        <g className="ring spin-rev">
          {[0, 90, 180, 270].map((d) => (
            <path key={d} className="bracket" transform={`rotate(${d} 200 200)`} d="M186 16 L200 6 L214 16" />
          ))}
        </g>
      </svg>

      <canvas ref={canvasRef} className="viz" />

      <button
        className="core"
        onClick={onClick}
        title={state === 'listening' ? 'Click to stop' : 'Click to talk'}
        aria-label={state === 'listening' ? 'Stop listening' : 'Start talking'}
      >
        <span className="core-glow" />
        {portrait !== 'none' && (
          <img
            className={`portrait ${portrait}`}
            src="/mahakal.png"
            alt="Mahakal"
            onLoad={() => setPortrait('ok')}
            onError={() => setPortrait('none')}
          />
        )}
        <MahakalEmblem />
        <span className="scan" />
      </button>
    </div>
  )
}
