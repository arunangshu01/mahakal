import { ASSISTANT_NAME, TAGLINE } from '../../constants'
import { useClock } from '../../hooks/useClock'
import './hud.css'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad = (n) => String(n).padStart(2, '0')

export default function TopBar({ status, hudOpen, onToggleHud }) {
  const now = useClock()

  return (
    <header className="topbar">
      <div className="brand">
        <h1 className="glitch" data-text={ASSISTANT_NAME}>
          {ASSISTANT_NAME}
        </h1>
        <p className="tagline">{TAGLINE}</p>
      </div>

      <div className="sys">
        <span className="dot" />
        <span className="sys-label">SYS {status === 'idle' ? 'ONLINE' : status.toUpperCase()}</span>
        <time className="clock" dateTime={now.toISOString()}>
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </time>
        <span className="date">
          {pad(now.getDate())} {MONTHS[now.getMonth()]} {now.getFullYear()}
        </span>
        <button
          className="hud-toggle"
          onClick={onToggleHud}
          aria-expanded={hudOpen}
          aria-controls="hud-panels"
        >
          {hudOpen ? 'CLOSE' : 'HUD'}
        </button>
      </div>
    </header>
  )
}
