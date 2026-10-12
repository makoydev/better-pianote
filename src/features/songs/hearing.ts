import { mod } from '../../lib/theory'
import type { Step, Timeline, TimedNote } from './timeline'

/**
 * Judging the notes you play in Practice. A keyboard (USB or on screen) must play the written keys, octave and all;
 * the mic is forgiving: it can be an octave out, it hears overtones and notes still ringing, and a chord comes in
 * as a few separate notes.
 */

export type Verdict =
  /** A note of the step, played right. */
  | 'hit'
  /** A note of the step you'd already played (pressed again). */
  | 'again'
  /** The right note in the wrong octave (only when the octave matters): no slip, but it doesn't count either. */
  | 'octave'
  /** Clearly a note of the hand you're not practising (playing along with it isn't a mistake). */
  | 'other-hand'
  | 'wrong'

export interface Judged {
  verdict: Verdict
  /** The step's note it played (for 'hit'). */
  note?: TimedNote
}

/** Each hand's lowest and highest note in each bar (null where it has none). */
export type HandSpans = Record<'rh' | 'lh', ([number, number] | null)[]>

/** Judge one key against the step: `exact` asks for the written octave; `otherHand` says whether a key is clearly the other hand's. */
export function judgeKey(step: Step, done: Set<number>, midi: number, exact: boolean, otherHand?: (midi: number) => boolean): Judged {
  const same = (a: number) => (exact ? a === midi : mod(a - midi, 12) === 0)
  const note = step.notes.find((n) => !done.has(n.id) && same(n.midi))
  if (note) return { verdict: 'hit', note }
  if (step.notes.some((n) => done.has(n.id) && same(n.midi))) return { verdict: 'again' }
  // The other hand's part first: its C3 under your C5 is playing along, not a C in the wrong octave.
  if (otherHand?.(midi)) return { verdict: 'other-hand' }
  if (exact && step.notes.some((n) => mod(n.midi - midi, 12) === 0)) return { verdict: 'octave' }
  return { verdict: 'wrong' }
}

export function handSpans(tl: Timeline): HandSpans {
  const spans: HandSpans = { rh: tl.bars.map(() => null), lh: tl.bars.map(() => null) }
  for (const n of tl.notes) {
    const s = spans[n.hand][n.bar]
    spans[n.hand][n.bar] = s ? [Math.min(s[0], n.midi), Math.max(s[1], n.midi)] : [n.midi, n.midi]
  }
  return spans
}

/** The hand's notes around bar `bar` (that bar and one either side), lowest and highest. */
function near(spans: ([number, number] | null)[], bar: number): [number, number] | null {
  let out: [number, number] | null = null
  for (let b = bar - 1; b <= bar + 1; b++) {
    const s = spans[b]
    if (s) out = out ? [Math.min(out[0], s[0]), Math.max(out[1], s[1])] : [s[0], s[1]]
  }
  return out
}

/**
 * Practising one hand, is this key clearly the other hand's around bar `bar`? It has to be among the other hand's
 * notes there (give or take a tone) and away from yours, so a wrong note of your own hand still counts.
 */
export function otherHandKey(spans: HandSpans, mine: 'rh' | 'lh', bar: number, midi: number): boolean {
  const other = near(spans[mine === 'rh' ? 'lh' : 'rh'], bar)
  if (!other || midi < other[0] - 2 || midi > other[1] + 2) return false
  const own = near(spans[mine], bar)
  return !own || midi < own[0] - 2 || midi > own[1] + 2
}

/**
 * What the mic heard for a chord step: the notes since the step began (`recent`), leaving out ones of the step
 * before that are still ringing (unless the chord has that note too).
 */
export function micChordHeard(recent: number[], target: number[], before: number[]): number[] {
  const want = new Set(target.map((m) => mod(m, 12)))
  const ringing = new Set(before.map((m) => mod(m, 12)))
  return recent.filter((m) => want.has(mod(m, 12)) || !ringing.has(mod(m, 12)))
}
