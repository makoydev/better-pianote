import type { Hands } from './results'
import type { Step } from './timeline'

/** Practice mode's run through the steps: progress, slips, and whether it can count as a best. */

const EPS = 1e-6

export interface Run {
  idx: number
  /** Notes of the current step played so far. */
  sat: Set<number>
  /** Notes played right, and slips (wrong notes and skipped steps). */
  notes: number
  mistakes: number
  combo: number
  best: number
  loops: number
  done: boolean
  hands: Hands
  /** Played from the first step without jumping ahead or changing hands, so it can count as a best. */
  whole: boolean
  /** Practice time before the stretch in progress (time spent in Listen doesn't count). */
  ms: number
}

export const newRun = (hands: Hands): Run => ({
  idx: 0,
  sat: new Set(),
  notes: 0,
  mistakes: 0,
  combo: 0,
  best: 0,
  loops: 0,
  done: false,
  hands,
  whole: true,
  ms: 0,
})

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
 * counting as a best if it starts part-way, jumps ahead or changes hands; going back over steps is fine.
 */
export function carryOn(r: Run, i: number, hands: Hands): Run {
  const begun = r.notes > 0 || r.mistakes > 0
  return { ...r, idx: i, sat: new Set(), hands, whole: begun && r.whole && hands === r.hands && i <= r.idx }
}
