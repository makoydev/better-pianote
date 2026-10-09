import confetti from 'canvas-confetti'

/** App-wide celebration events (XP pop-ups, confetti). */

type XpListener = (n: number) => void
const xpListeners = new Set<XpListener>()

export function onXp(fn: XpListener) {
  xpListeners.add(fn)
  return () => {
    xpListeners.delete(fn)
  }
}

export function emitXp(n: number) {
  xpListeners.forEach((fn) => fn(n))
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const PALETTE = ['#ffc857', '#ff7b6b', '#9b8cff', '#3ee6c8', '#5cc8ff', '#ff9ad5']

/** A small burst of confetti from an element (or the screen centre). */
export function burst(from?: Element | null, opts: { count?: number; spread?: number } = {}) {
  if (reduced()) return
  let x = 0.5
  let y = 0.5
  if (from) {
    const r = from.getBoundingClientRect()
    x = (r.left + r.width / 2) / window.innerWidth
    y = (r.top + r.height / 2) / window.innerHeight
  }
  void confetti({
    particleCount: opts.count ?? 40,
    spread: opts.spread ?? 70,
    startVelocity: 32,
    origin: { x, y },
    colors: PALETTE,
    scalar: 0.9,
    ticks: 140,
    disableForReducedMotion: true,
  })
}

/** Big celebration for finishing a lesson. */
export function celebrate() {
  if (reduced()) return
  const end = Date.now() + 900
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: PALETTE })
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: PALETTE })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
