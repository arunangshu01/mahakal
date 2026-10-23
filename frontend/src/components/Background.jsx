import { useEffect, useRef } from 'react'

const LINK_DISTANCE = 130

function createParticles(width, height) {
  // Fewer particles on small screens keeps phones cool and smooth.
  const count = Math.min(width < 640 ? 45 : 110, Math.floor((width * height) / 14000))
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.6 + 0.4,
  }))
}

export default function Background() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext?.('2d')
    if (!ctx) return undefined

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let particles = []
    let frame = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particles = createParticles(canvas.width, canvas.height)
    }

    const draw = () => {
      const { width, height } = canvas
      const rgb = getComputedStyle(canvas).getPropertyValue('--accent-rgb').trim() || '0,229,255'
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.x = (p.x + p.vx + width) % width
        p.y = (p.y + p.vy + height) % height
      }
      particles.forEach((a, i) => {
        for (const b of particles.slice(i + 1)) {
          const distance = Math.hypot(a.x - b.x, a.y - b.y)
          if (distance < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - distance / LINK_DISTANCE) * 0.18})`
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
      })

      if (!reducedMotion) frame = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
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
