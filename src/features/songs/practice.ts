import type { Hands } from './results'
import type { Step } from './timeline'

/** Practice mode's run through the steps: progress, slips, and whether it can count as a best. */

const EPS = 1e-6

/** Played notes and slips, and whether they were played in order from the start (of the song, or the loop). */
interface Tally {
  /** Notes played right, and slips (wrong notes and skipped steps). */
  notes: number
  mistakes: number
  /** Played from the first step without jumping ahead or changing hands. */
  whole: boolean
}

export interface Run extends Tally {
  idx: number
  /** Notes of the current step played so far. */
  sat: Set<number>
  combo: number
  best: number
  loops: number
  done: boolean
  hands: Hands
  /** This time round the loop (when looping): a clean pass earns a little XP. */
  pass: Tally
  /** Practice time before the stretch in progress (time spent in Listen doesn't count). */
  ms: number
}

const fresh = (): Tally => ({ notes: 0, mistakes: 0, whole: true })

export const newRun = (hands: Hands): Run => ({
  ...fresh(),
  idx: 0,
  sat: new Set(),
  combo: 0,
  best: 0,
  loops: 0,
  done: false,
  hands,
  pass: fresh(),
  ms: 0,
})

/** A note played right, or a slip: counted for the run and for this time round the loop. */
export function tally(r: Run, kind: 'note' | 'slip') {
  const key = kind === 'note' ? 'notes' : 'mistakes'
  r[key]++
  r.pass[key]++
}

/** Steps inside the looped bars (all of them when not looping). */
export const stepsInBars = (steps: Step[], bars: [number, number] | null) =>
  bars ? steps.filter((s) => s.bar >= bars[0] && s.bar <= bars[1]) : steps

/** The first step at or after moment t; past the last one, the last step (or the first, when looping). */
export function stepAt(steps: Step[], t: number, looping: boolean): number {
  const i = steps.findIndex((s) => s.start >= t - EPS)
  return i >= 0 ? i : looping ? 0 : Math.max(0, steps.length - 1)
}

/**
 * Carry a run on from step i (after switching modes or hands; i > 0, the first step is a fresh run). It stops
 * counting as a best (and the loop pass as clean) if it starts part-way, jumps ahead or changes hands; going back
 * over steps is fine.
 */
export function carryOn(r: Run, i: number, hands: Hands): Run {
  const keeps = (t: Tally) => (t.notes > 0 || t.mistakes > 0) && t.whole && hands === r.hands && i <= r.idx
  return { ...r, idx: i, sat: new Set(), hands, whole: keeps(r), pass: { ...r.pass, whole: keeps(r.pass) } }
}

/** Looping a section never finishes, so each clean pass earns a little XP, up to a cap per visit to the song. */
export const LOOP_XP = 2
export const LOOP_XP_MAX = 20

/** Round the loop once more: XP for the pass just played (clean = all of it, with no slips), and a fresh pass. */
export function endPass(r: Run, earned: number): number {
  const clean = r.pass.whole && r.pass.notes > 0 && r.pass.mistakes === 0
  r.loops++
  r.idx = 0
  r.pass = fresh()
  return clean ? Math.max(0, Math.min(LOOP_XP, LOOP_XP_MAX - earned)) : 0
}
