import { useEffect, useRef, useState } from 'react'

export default function Typewriter({ text, speed = 16, step = 2 }) {
  const [length, setLength] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (length >= text.length) return
    const id = setTimeout(() => {
      setLength((n) => Math.min(text.length, n + step))
      ref.current?.scrollIntoView?.({ block: 'nearest' })
    }, speed)
    return () => clearTimeout(id)
  }, [length, text, speed, step])

  const typing = length < text.length
  return (
    <span ref={ref} aria-label={text}>
      <span aria-hidden="true">
        {text.slice(0, length)}
        {typing && <span className="caret">▌</span>}
      </span>
    </span>
  )
}
