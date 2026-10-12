import { useLive } from '../../state/live'
import { heldNow, recentNotes } from './bus'

/**
 * A deliberate tap of the sustain pedal: pressed and released within 0.6 s, with no keys down and nothing played
 * just before or during it. Pedalling while you play never counts, so screens can use a tap as "Continue".
 */

const listeners = new Set<() => void>()
let downAt: number | null = null
let wasDown = false

useLive.subscribe((s) => {
  if (s.sustain === wasDown) return
  wasDown = s.sustain
  const now = performance.now()
  if (s.sustain) {
    downAt = heldNow().length === 0 && recentNotes(1200).length === 0 ? now : null
    return
  }
  const t0 = downAt
  downAt = null
  if (t0 === null || now - t0 > 600 || heldNow().length > 0 || recentNotes(now - t0 + 50).length > 0) return
  listeners.forEach((l) => l())
})

export function onPedalTap(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
