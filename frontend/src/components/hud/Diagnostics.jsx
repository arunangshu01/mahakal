import { useEffect, useState } from 'react'
import PanelTitle from './PanelTitle'
import './hud.css'

const METRICS = ['NEURAL CORE', 'VOICE MATRIX', 'KNOWLEDGE GRID', 'LINK STABILITY', 'SHAKTI RESERVE']
const SPARK_POINTS = 40

const clamp = (value) => Math.max(20, Math.min(100, value))

function Sparkline({ active }) {
  const [points, setPoints] = useState(() => Array(SPARK_POINTS).fill(50))

  useEffect(() => {
    const id = setInterval(
      () => setPoints((p) => [...p.slice(1), 50 + (Math.random() - 0.5) * (active ? 80 : 25)]),
      active ? 90 : 250,
    )
    return () => clearInterval(id)
  }, [active])

  return (
    <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.map((y, i) => `${(i / (SPARK_POINTS - 1)) * 200},${y * 0.6}`).join(' ')} />
    </svg>
  )
}

export default function Diagnostics({ status }) {
  const active = status !== 'idle'
  const [values, setValues] = useState(() => METRICS.map(() => 60))

  useEffect(() => {
    const jitter = active ? 30 : 12
    const id = setInterval(
      () => setValues((v) => v.map((x) => clamp(x + (Math.random() - 0.45) * jitter))),
      active ? 400 : 1400,
    )
    return () => clearInterval(id)
  }, [active])

  return (
    <section className="panel panel-left" aria-label="System diagnostics">
      <PanelTitle>System Diagnostics</PanelTitle>
      {METRICS.map((metric, i) => (
        <div className="metric" key={metric}>
          <div className="metric-head">
            <span>{metric}</span>
            <span>{Math.round(values[i])}%</span>
          </div>
          <div className="bar">
            <span style={{ width: `${values[i]}%` }} />
          </div>
        </div>
      ))}

      <PanelTitle>Signal</PanelTitle>
      <Sparkline active={active} />

      <PanelTitle>Core Integrity</PanelTitle>
      <div className="integrity">
        <span>INDESTRUCTIBLE</span>
        <span className="infinity">∞</span>
      </div>
    </section>
  )
}
