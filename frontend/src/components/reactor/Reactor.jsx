import { useEffect, useRef, useState } from 'react'
import { ASSISTANT_NAME } from '../../constants'
import MahakalEmblem from './MahakalEmblem'
import './Reactor.css'

const SIZE = 400
const CENTER = SIZE / 2
const BARS = 96
const TICKS = Array.from({ length: 120 }, (_, i) => {
  const angle = (i / 120) * Math.PI * 2
  const inner = i % 10 === 0 ? 178 : i % 5 === 0 ? 184 : 188
  return [inner, 196].flatMap((r) => [CENTER + Math.cos(angle) * r, CENTER + Math.sin(angle) * r])
})
const RING_TEXT = `${ASSISTANT_NAME} • MODULAR AGENTIC HUB • AUTOMATION • KNOWLEDGE • ADAPTIVE LOGIC • HAR HAR MAHADEV • `

const polar = (angle, radius) => [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius]

function barLevel(i, status, freq, live, time) {
  if (live) {
    const mirrored = i < BARS / 2 ? i : BARS - 1 - i
    return freq[Math.floor((mirrored / (BARS / 2)) * 140)] / 255
  }
  if (status === 'thinking') return 0.25 + 0.25 * Math.sin(time * 6 + i * 0.5)
  return 0.08 + 0.06 * Math.sin(time * 1.5 + i * 0.35)
}

function drawFrame(ctx, { status, freq, wave, live, time, rgb }) {
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.lineWidth = 2.2
  for (let i = 0; i < BARS; i++) {
    const level = barLevel(i, status, freq, live, time)
    const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2
    ctx.strokeStyle = `rgba(${rgb},${0.35 + level * 0.65})`
    ctx.beginPath()
    ctx.moveTo(...polar(angle, 118))
    ctx.lineTo(...polar(angle, 124 + level * 46))
    ctx.stroke()
  }

  ctx.beginPath()
  for (let i = 0; i <= 128; i++) {
    const offset = live ? (wave[(i * 2) % 256] - 128) / 128 : Math.sin(time * 2 + i * 0.4) * 0.05
    const [x, y] = polar((i / 128) * Math.PI * 2, 108 + offset * 14)
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.strokeStyle = `rgba(${rgb},0.55)`
  ctx.lineWidth = 1.2
  ctx.stroke()
}

// The animated core. `analyserRef` holds a Web Audio AnalyserNode
// (mic input while listening, reply playback while speaking).
export default function Reactor({ status, analyserRef, onActivate }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [portrait, setPortrait] = useState('pending')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext?.('2d')
    if (!ctx) return undefined

    const freq = new Uint8Array(256)
    const wave = new Uint8Array(256)
    let frame = 0
    let level = 0

    const draw = (t) => {
      const pixels = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1))
      if (canvas.width !== pixels) canvas.width = canvas.height = pixels
      const scale = pixels / SIZE
      ctx.setTransform(scale, 0, 0, scale, 0, 0)

      const analyser = analyserRef.current
      const live = Boolean(analyser) && (status === 'listening' || status === 'speaking')
      let rms = 0
      if (live) {
        analyser.getByteFrequencyData(freq)
        analyser.getByteTimeDomainData(wave)
        rms = Math.sqrt(wave.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / wave.length)
      }
      level += (Math.min(rms * 3, 1) - level) * 0.25
      wrapRef.current?.style.setProperty('--level', level.toFixed(3))

      const rgb = getComputedStyle(canvas).getPropertyValue('--accent-rgb').trim() || '0,229,255'
      drawFrame(ctx, { status, freq, wave, live, time: t / 1000, rgb })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [status, analyserRef])

  const listening = status === 'listening'

  return (
    <div className={`reactor ${status} ${portrait === 'ok' ? 'has-portrait' : ''}`} ref={wrapRef}>
      <svg className="rings" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <defs>
          <path id="ringTextPath" d="M200,200 m-152,0 a152,152 0 1,1 304,0 a152,152 0 1,1 -304,0" />
        </defs>
        <g className="ring spin-slow">
          {TICKS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i % 10 === 0 ? 'tick major' : 'tick'} />
          ))}
        </g>
        <circle className="ring spin-rev dash-a" cx={CENTER} cy={CENTER} r="170" />
        <g className="ring spin-fast">
          <circle className="arc arc-1" cx={CENTER} cy={CENTER} r="162" />
          <circle className="arc arc-2" cx={CENTER} cy={CENTER} r="162" />
        </g>
        <g className="ring spin-rev-slow">
          <text className="ring-text">
            <textPath href="#ringTextPath">{RING_TEXT}</textPath>
          </text>
        </g>
        <circle className="ring spin-med dash-b" cx={CENTER} cy={CENTER} r="138" />
        <g className="ring spin-rev">
          {[0, 90, 180, 270].map((deg) => (
            <path key={deg} className="bracket" transform={`rotate(${deg} 200 200)`} d="M186 16 L200 6 L214 16" />
          ))}
        </g>
      </svg>

      <canvas ref={canvasRef} className="viz" aria-hidden="true" />

      <button
        type="button"
        className="core"
        onClick={onActivate}
        aria-label={listening ? 'Stop listening' : 'Start talking'}
        aria-pressed={listening}
      >
        <span className="core-glow" />
        {portrait !== 'none' && (
          <img
            className={`portrait ${portrait}`}
            src="/mahakal.png"
            alt=""
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
