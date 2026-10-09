import { useEffect, useRef } from 'react'
import { noteColor } from '../../lib/colors'
import { onNote } from '../../lib/input/bus'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
}

/**
 * Glowing particles that float up from keys as you play. `keyX` maps a MIDI note to its centre
 * (as a fraction 0–1 of the width), or null when the note is off this keyboard.
 */
export function Sparks({ keyX, height = 140 }: { keyX: (midi: number) => number | null; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const keyXRef = useRef(keyX)
  useEffect(() => {
    keyXRef.current = keyX
  }, [keyX])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const particles: Particle[] = []
    let raf = 0
    let last = performance.now()

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = el.clientWidth
      const h = el.clientHeight
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += dt
        if (p.life >= p.max) {
          particles.splice(i, 1)
          continue
        }
        p.vy -= 30 * dt
        p.vx *= 0.985
        p.x += p.vx * dt
        p.y += p.vy * dt
        const k = 1 - p.life / p.max
        const r = p.size * (0.6 + 0.4 * k)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3)
        g.addColorStop(0, p.color)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = k
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = particles.length ? requestAnimationFrame(frame) : 0
    }

    const off = onNote((e) => {
      if (e.type !== 'on') return
      const fx = keyXRef.current(e.midi)
      if (fx === null) return
      const w = el.clientWidth
      const h = el.clientHeight
      const color = noteColor(e.midi)
      const n = 10 + Math.round(e.velocity * 10)
      for (let i = 0; i < n; i++) {
        particles.push({
          x: fx * w + (Math.random() - 0.5) * 14,
          y: h - 2,
          vx: (Math.random() - 0.5) * 70,
          vy: -(70 + Math.random() * 150) * (0.6 + e.velocity * 0.6),
          life: 0,
          max: 0.6 + Math.random() * 0.7,
          size: 1.5 + Math.random() * 2.5,
          color,
        })
      }
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    return () => {
      off()
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvas}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-full w-full"
      style={{ height }}
    />
  )
}
