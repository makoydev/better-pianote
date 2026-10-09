import { useEffect, useRef } from 'react'
import { noteColor } from '../../lib/colors'
import { onNote } from '../../lib/input/bus'

interface Trail {
  midi: number
  start: number
  end: number | null
  color: string
}

/**
 * Glowing bars that grow up from each key while you hold it, then float away when you let go,
 * so your playing leaves a light-show behind it. `geom` gives a key's centre and width (0–1).
 */
export function Trails({ geom, height = 220, speed = 150 }: { geom: (midi: number) => { x: number; w: number } | null; height?: number; speed?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const geomRef = useRef(geom)
  useEffect(() => {
    geomRef.current = geom
  }, [geom])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const trails: Trail[] = []
    let raf = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const frame = () => {
      const now = performance.now() / 1000
      const w = el.clientWidth
      const h = el.clientHeight
      ctx.clearRect(0, 0, w, h)
      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i]
        const g = geomRef.current(t.midi)
        if (!g) {
          trails.splice(i, 1)
          continue
        }
        const bottom = t.end === null ? h : h - (now - t.end) * speed
        const top = t.end === null ? h - (now - t.start) * speed : bottom - (t.end - t.start) * speed
        if (bottom < -20) {
          trails.splice(i, 1)
          continue
        }
        const bw = Math.max(4, g.w * w * 0.72)
        const x = g.x * w - bw / 2
        const y = Math.max(-20, top)
        const grad = ctx.createLinearGradient(0, y, 0, bottom)
        grad.addColorStop(0, `${t.color}00`)
        grad.addColorStop(0.35, `${t.color}aa`)
        grad.addColorStop(1, t.color)
        ctx.shadowColor = t.color
        ctx.shadowBlur = 18
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x, y, bw, Math.max(2, bottom - y), Math.min(8, bw / 2))
        ctx.fill()
      }
      ctx.shadowBlur = 0
      raf = trails.length ? requestAnimationFrame(frame) : 0
    }

    const off = onNote((e) => {
      const now = performance.now() / 1000
      if (e.type === 'on') trails.push({ midi: e.midi, start: now, end: null, color: noteColor(e.midi) })
      else {
        for (let i = trails.length - 1; i >= 0; i--) {
          if (trails[i].midi === e.midi && trails[i].end === null) {
            trails[i].end = now
            break
          }
        }
      }
      if (!raf) raf = requestAnimationFrame(frame)
    })
    return () => {
      off()
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [speed])

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full w-full" style={{ height }} />
}
