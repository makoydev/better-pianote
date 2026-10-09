import type { Target } from '../../content/types'
import { midiOf, mod, parseNote } from '../../lib/theory'

/** Checks played notes against a lesson target. Pure, so it's easy to test. */

export interface MatchState {
  done: boolean
  /** Targets already satisfied (set: which ones, sequence: how many). */
  found: number[]
  index: number
}

export const initialMatch = (): MatchState => ({ done: false, found: [], index: 0 })

export function targetMidis(t: Target): number[] {
  return t.notes.map((n) => midiOf(parseNote(n)))
}

const same = (midi: number, target: number, anyOctave: boolean) => (anyOctave ? mod(midi, 12) === mod(target, 12) : midi === target)

export type NoteVerdict = 'good' | 'bad' | 'ignore'

/** Feed one played note (note-on) into a note/set/sequence target. */
export function feedNote(t: Target, s: MatchState, midi: number): { state: MatchState; verdict: NoteVerdict } {
  if (s.done || t.type === 'chord') return { state: s, verdict: 'ignore' }
  const targets = targetMidis(t)
  const any = !!t.anyOctave
  if (t.type === 'note') {
    return targets.some((x) => same(midi, x, any)) ? { state: { ...s, done: true }, verdict: 'good' } : { state: s, verdict: 'bad' }
  }
  if (t.type === 'set') {
    const i = targets.findIndex((x, k) => !s.found.includes(k) && same(midi, x, any))
    if (i >= 0) {
      const found = [...s.found, i]
      return { state: { ...s, found, done: found.length === targets.length }, verdict: 'good' }
    }
    // Playing one you've already found again is fine.
    return targets.some((x) => same(midi, x, any)) ? { state: s, verdict: 'ignore' } : { state: s, verdict: 'bad' }
  }
  // sequence
  if (same(midi, targets[s.index], any)) {
    const index = s.index + 1
    return { state: { ...s, index, done: index === targets.length }, verdict: 'good' }
  }
  return { state: s, verdict: 'bad' }
}

/** Does this collection of notes (held together / selected / rolled) make the target chord? */
export function chordMatches(t: Target, notes: number[]): boolean {
  if (t.type !== 'chord' || notes.length === 0) return false
  const targets = targetMidis(t)
  // Like single notes, chords need the written octave unless the lesson says anyOctave.
  if (!t.anyOctave) {
    const a = [...new Set(notes)].sort((x, y) => x - y)
    const b = [...new Set(targets)].sort((x, y) => x - y)
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  const want = new Set(targets.map((m) => mod(m, 12)))
  const have = new Set(notes.map((m) => mod(m, 12)))
  if (want.size !== have.size || [...want].some((p) => !have.has(p))) return false
  if (t.bass) {
    const low = Math.min(...notes)
    if (mod(low, 12) !== mod(midiOf(parseNote(t.bass)), 12)) return false
  }
  return true
}

/** Is this note part of the target chord at all? (Used to flag wrong keys.) */
export function inChord(t: Target, midi: number): boolean {
  return targetMidis(t).some((x) => same(midi, x, !!t.anyOctave))
}
