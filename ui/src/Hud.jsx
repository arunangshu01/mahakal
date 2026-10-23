import { useEffect, useMemo, useRef, useState } from 'react'

const pad = (n) => String(n).padStart(2, '0')
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function TopBar({ state }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="topbar">
      <div className="brand">
        <h1 className="glitch" data-text="M.A.H.A.K.A.L.">M.A.H.A.K.A.L.</h1>
        <p className="tagline">Modular Agentic Hub for Automation, Knowledge &amp; Adaptive Logic</p>
      </div>
      <div className="sys">
        <span className={`dot ${state}`} />
        <span className="sys-label">SYS {state === 'idle' ? 'ONLINE' : state.toUpperCase()}</span>
        <span className="clock">
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </span>
        <span className="date">
          {pad(now.getDate())} {MONTHS[now.getMonth()]} {now.getFullYear()}
        </span>
      </div>
    </header>
  )
}

const METRICS = ['NEURAL CORE', 'VOICE MATRIX', 'KNOWLEDGE GRID', 'LINK STABILITY', 'SHAKTI RESERVE']

export function Diagnostics({ state }) {
  const active = state !== 'idle'
  const [vals, setVals] = useState(() => METRICS.map(() => 60))
  useEffect(() => {
    const tick = () =>
      setVals((v) => v.map((x) => Math.max(20, Math.min(100, x + (Math.random() - 0.45) * (active ? 30 : 12)))))
    const id = setInterval(tick, active ? 400 : 1400)
    return () => clearInterval(id)
  }, [active])

  return (
    <aside className="panel left">
      <PanelTitle>System Diagnostics</PanelTitle>
      {METRICS.map((m, i) => (
        <div className="metric" key={m}>
          <div className="metric-head">
            <span>{m}</span>
            <span>{Math.round(vals[i])}%</span>
          </div>
          <div className="bar">
            <span style={{ width: `${vals[i]}%` }} />
          </div>
        </div>
      ))}
      <PanelTitle>Signal</PanelTitle>
      <Sparkline active={active} />
      <PanelTitle>Core Integrity</PanelTitle>
      <div className="integrity">
        <span>INDESTRUCTIBLE</span>
        <span className="blink">∞</span>
      </div>
    </aside>
  )
}

function Sparkline({ active }) {
  const [pts, setPts] = useState(() => Array.from({ length: 40 }, () => 50))
  useEffect(() => {
    const id = setInterval(
      () => setPts((p) => [...p.slice(1), 50 + (Math.random() - 0.5) * (active ? 80 : 25)]),
      active ? 90 : 250,
    )
    return () => clearInterval(id)
  }, [active])
  return (
    <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none">
      <polyline points={pts.map((y, i) => `${(i / 39) * 200},${y * 0.6}`).join(' ')} />
    </svg>
  )
}

const MODULES = [
  ['BRAIN', 'GROQ · LLAMA 3.3', 'PRIMARY'],
  ['BACKUP', 'GEMINI', 'STANDBY'],
  ['EARS', 'WHISPER', 'ARMED'],
  ['VOICE', 'EDGE TTS', 'ARMED'],
]

export function Modules({ state }) {
  const hex = useMemo(
    () =>
      Array.from({ length: 30 }, () =>
        Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')).join(' '),
      ),
    [],
  )
  return (
    <aside className="panel right">
      <PanelTitle>Modules</PanelTitle>
      {MODULES.map(([k, name, status]) => (
        <div className="module" key={k}>
          <span className="module-key">{k}</span>
          <span className="module-name">{name}</span>
          <span className={`module-status ${status.toLowerCase()}`}>{status}</span>
        </div>
      ))}
      <PanelTitle>Data Stream</PanelTitle>
      <div className={`hexstream ${state !== 'idle' ? 'fast' : ''}`}>
        <div>
          {[...hex, ...hex].map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
      <PanelTitle>Mantra</PanelTitle>
      <div className="mantra">ॐ नमः शिवाय</div>
    </aside>
  )
}

function PanelTitle({ children }) {
  return (
    <div className="panel-title">
      <span>{children}</span>
    </div>
  )
}

const BOOT_LINES = [
  'INITIALIZING M.A.H.A.K.A.L. KERNEL',
  'LOADING NEURAL CORE ............ OK',
  'CALIBRATING VOICE MATRIX ....... OK',
  'SYNCING KNOWLEDGE GRID ......... OK',
  'OPENING THE THIRD EYE .......... OK',
  'ALL SYSTEMS ONLINE',
]

export function Boot({ onDone }) {
  const [n, setN] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(onDone)

  useEffect(() => {
    if (n < BOOT_LINES.length) {
      const id = setTimeout(() => setN(n + 1), 260)
      return () => clearTimeout(id)
    }
    const a = setTimeout(() => setLeaving(true), 450)
    const b = setTimeout(() => done.current(), 1100)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [n])

  return (
    <div className={`boot ${leaving ? 'leaving' : ''}`} onClick={() => done.current()}>
      <div className="boot-ring" />
      <div className="boot-lines">
        {BOOT_LINES.slice(0, n).map((l) => (
          <div key={l}>&gt; {l}</div>
        ))}
        <span className="cursor">█</span>
      </div>
      <div className="boot-bar">
        <span style={{ width: `${(n / BOOT_LINES.length) * 100}%` }} />
      </div>
    </div>
  )
}

export function Typewriter({ text }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (n >= text.length) return
    const id = setTimeout(() => {
      setN((x) => Math.min(text.length, x + 2))
      ref.current?.scrollIntoView({ block: 'nearest' })
    }, 16)
    return () => clearTimeout(id)
  }, [n, text])
  return (
    <span ref={ref}>
      {text.slice(0, n)}
      {n < text.length && <span className="caret">▌</span>}
    </span>
  )
}
