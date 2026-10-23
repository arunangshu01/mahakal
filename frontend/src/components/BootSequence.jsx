import { useEffect, useRef, useState } from 'react'
import { BOOT_LINES } from '../constants'
import './BootSequence.css'

export default function BootSequence({ onDone, lineDelay = 260 }) {
  const [shown, setShown] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const doneRef = useRef(onDone)

  useEffect(() => {
    if (shown < BOOT_LINES.length) {
      const id = setTimeout(() => setShown(shown + 1), lineDelay)
      return () => clearTimeout(id)
    }
    const fade = setTimeout(() => setLeaving(true), lineDelay * 1.7)
    const finish = setTimeout(() => doneRef.current(), lineDelay * 4)
    return () => {
      clearTimeout(fade)
      clearTimeout(finish)
    }
  }, [shown, lineDelay])

  return (
    <div
      className={`boot ${leaving ? 'leaving' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Skip boot sequence"
      onClick={() => doneRef.current()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && doneRef.current()}
    >
      <div className="boot-ring" />
      <div className="boot-lines" aria-live="polite">
        {BOOT_LINES.slice(0, shown).map((line) => (
          <div key={line}>&gt; {line}</div>
        ))}
        <span className="cursor">█</span>
      </div>
      <div className="boot-bar">
        <span style={{ width: `${(shown / BOOT_LINES.length) * 100}%` }} />
      </div>
      <p className="boot-hint">TAP TO SKIP</p>
    </div>
  )
}
