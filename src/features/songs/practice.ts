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
  /** The bar you chose to start from (Start from this bar, Continue), so the results can say "from bar 12". */
  fromBar?: number
  /** Slips (wrong notes and skips) in each bar, by bar index: the results show where they were. */
  barSlips: Record<number, number>
  /** Accuracy (0–1) of the latest passes round the loop played all the way round, oldest first. */
  passes: number[]
  /** Clean passes round the loop in a row (the goal is CLEAN_GOAL). */
  cleanInARow: number
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
  barSlips: {},
  passes: [],
  cleanInARow: 0,
})

/** A note played right, or a slip (in bar `bar`): counted for the run and for this time round the loop. */
export function tally(r: Run, kind: 'note' | 'slip', bar?: number) {
  const key = kind === 'note' ? 'notes' : 'mistakes'
  r[key]++
  r.pass[key]++
  if (kind === 'slip' && bar !== undefined) r.barSlips[bar] = (r.barSlips[bar] ?? 0) + 1
}

/** Steps inside the looped bars (all of them when not looping). */
export const stepsInBars = (steps: Step[], bars: [number, number] | null) =>
  bars ? steps.filter((s) => s.bar >= bars[0] && s.bar <= bars[1]) : steps

/** The first step at or after moment t; past the last one, the last step (or the first, when looping). */
export function stepAt(steps: Step[], t: number, looping: boolean): number {
  const i = steps.findIndex((s) => s.start >= t - EPS)
  return i >= 0 ? i : looping ? 0 : Math.max(0, steps.length - 1)
}

/** A fresh run from step i (starting part-way, it can't count as a best), maybe from a bar you chose. */
export function runFrom(hands: Hands, i: number, fromBar?: number): Run {
  const r = newRun(hands)
  r.idx = i
  r.whole = r.pass.whole = i === 0
  if (fromBar !== undefined && i > 0) r.fromBar = fromBar
  return r
}

/** The first step in bar `bar` or after it (the last step when there's none). */
export function firstStepIn(steps: Step[], bar: number): number {
  const i = steps.findIndex((s) => s.bar >= bar)
  return i >= 0 ? i : Math.max(0, steps.length - 1)
}

/** "Loop around here": the bar you're in with one either side (the way in and the way out). */
export const aroundBar = (bar: number, bars: number): [number, number] => [Math.max(0, bar - 1), Math.min(bars - 1, bar + 1)]

/**
 * Where practice carries on from step i after switching modes or hands:
 * - on the same step nothing changes (notes of a chord you'd already played stay played);
 * - with nothing played yet, after finishing, or back at the top of the song, a fresh run from there;
 * - anywhere else the run carries on, but no longer counts as a best (it skipped ahead, or would count notes it
 *   plays again twice) and the loop pass isn't clean, except that the loop's first step starts a new pass.
 */
export function carryOn(r: Run, i: number, hands: Hands, looping: boolean): Run {
  if (i === r.idx && hands === r.hands && !r.done) return r
  if (r.done || (!r.notes && !r.mistakes) || (i === 0 && !looping)) return runFrom(hands, i)
  const pass = looping && i === 0 ? fresh() : { ...r.pass, whole: false }
  return { ...r, idx: i, sat: new Set(), hands, whole: false, pass }
}

/** Looping a section never finishes, so each clean pass earns a little XP, up to a cap per visit to the song. */
export const LOOP_XP = 2
export const LOOP_XP_MAX = 20
/** Passes whose accuracy is shown while looping, and clean passes in a row to aim for. */
export const PASSES_SHOWN = 5
export const CLEAN_GOAL = 3

/**
 * Round the loop once more: note how the pass went (only a pass played all the way round counts, not one you
 * joined part-way), and the XP for it (clean = all of it, with no slips). A fresh pass starts.
 */
export function endPass(r: Run, earned: number): number {
  const p = r.pass
  const clean = p.whole && p.notes > 0 && p.mistakes === 0
  if (p.whole && p.notes + p.mistakes > 0) {
    r.passes = [...r.passes, p.notes / (p.notes + p.mistakes)].slice(-PASSES_SHOWN)
    r.cleanInARow = clean ? r.cleanInARow + 1 : 0
  }
  r.loops++
  r.idx = 0
  r.pass = fresh()
  return clean ? Math.max(0, Math.min(LOOP_XP, LOOP_XP_MAX - earned)) : 0
}

/**
 * The bars to practise after a run: the stretch of up to `maxLen` bars with the most slips in it, starting and
 * ending on a bar with slips (the shorter, then the earlier, on a tie). Null when there were none.
 */
export function worstStretch(slips: Record<number, number>, maxLen = 4): [number, number] | null {
  const bars = Object.keys(slips)
    .map(Number)
    .filter((b) => slips[b] > 0)
    .sort((a, b) => a - b)
  let best: { from: number; to: number; total: number } | null = null
  for (let i = 0; i < bars.length; i++) {
    let total = 0
    for (let j = i; j < bars.length && bars[j] - bars[i] < maxLen; j++) {
      total += slips[bars[j]]
      const shorter = best !== null && bars[j] - bars[i] < best.to - best.from
      if (!best || total > best.total || (total === best.total && shorter)) best = { from: bars[i], to: bars[j], total }
    }
  }
  return best && [best.from, best.to]
}
