import { useEffect, useRef } from 'react'

export default function Background() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let pts = []
    let raf = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const n = Math.min(110, Math.floor((canvas.width * canvas.height) / 14000))
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.4,
      }))
    }

    const draw = () => {
      const { width: w, height: h } = canvas
      const rgb = getComputedStyle(canvas).getPropertyValue('--accent-rgb').trim() || '0,229,255'
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        p.x = (p.x + p.vx + w) % w
        p.y = (p.y + p.vy + h) % h
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 130) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / 130) * 0.18})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
        ctx.fillStyle = `rgba(${rgb},0.7)`
        ctx.beginPath()
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas ref={ref} className="bg-canvas" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-sweep" aria-hidden="true" />
    </>
  )
}
