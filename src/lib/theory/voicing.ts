import { type Chord, chordPcs } from './chord'
import { mod, pcOf } from './note'

/** Close-position voicing (each tone stacked just above the last), lowest note at or above `floor`. */
export function closeVoicing(pcs: number[], inversion: number, floor: number): number[] {
  const order = [...pcs.slice(inversion), ...pcs.slice(0, inversion)]
  let cur = floor + mod(order[0] - floor, 12)
  const out = [cur]
  for (let i = 1; i < order.length; i++) {
    cur += mod(order[i] - cur, 12) || 12
    out.push(cur)
  }
  return out
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function movement(from: number[], to: number[]): number {
  if (from.length === to.length) {
    const a = [...from].sort((x, y) => x - y)
    const b = [...to].sort((x, y) => x - y)
    return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)
  }
  return to.reduce((s, v) => s + Math.min(...from.map((p) => Math.abs(p - v))), 0)
}

/**
 * Pick the inversion of `chord` that moves least from the previous voicing,
 * so progressions sound smooth and stay under one hand position.
 */
export function voiceLead(
  prev: number[] | null,
  chord: Chord,
  opts: { center?: number; low?: number; high?: number } = {},
): number[] {
  const { center = 64, low = 55, high = 79 } = opts
  // Keep right-hand voicings to 3–4 notes: drop the 9th (it's colour, not structure).
  const pcs = chordPcs(chord).slice(0, 4)
  let best: number[] = []
  let bestScore = Infinity
  for (let inv = 0; inv < pcs.length; inv++) {
    for (let floor = low; floor < low + 12; floor++) {
      const v = closeVoicing(pcs, inv, floor)
      if (v[0] !== floor || v[v.length - 1] > high) continue
      const score = prev
        ? movement(prev, v) + 0.15 * Math.abs(mean(v) - center)
        : Math.abs(mean(v) - center) + inv * 1.5
      if (score < bestScore) {
        bestScore = score
        best = v
      }
    }
  }
  return best
}

/** The bass note for a chord (its slash note if it has one) inside [low, low + 11]. */
export function bassFor(chord: Chord, low = 43): number {
  const pc = pcOf(chord.bass ?? chord.root)
  return low + mod(pc - low, 12)
}

/** Voice-led right-hand chords for a whole progression. */
export function voiceProgression(chords: Chord[], opts?: { center?: number; low?: number; high?: number }): number[][] {
  const out: number[][] = []
  let prev: number[] | null = null
  for (const c of chords) {
    const v = voiceLead(prev, c, opts)
    out.push(v)
    prev = v
  }
  return out
}
