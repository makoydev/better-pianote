import type { Duration, StaffId } from '../../components/staff/layout'
import type { ScoreEvent, ScoreInput } from '../../components/staff/score'
import { type Note, type ScaleType, midiOf, scaleFingering, scaleNotes } from '../../lib/theory'

/** Scale Explorer runs: one or two octaves, either hand or both, with fingering and the music to read (pure). */

export type Hands = 'rh' | 'lh' | 'both'
export type Octaves = 1 | 2
export interface Fingering {
  rh: number[]
  lh: number[]
}

/**
 * Standard fingering over two octaves, from the one-octave pattern. The left hand repeats its pattern, its top
 * finger playing the middle tonic (C: 5 4 3 2 1 3 2 1 4 3 2 1 3 2 1). So does the right hand on scales that start on
 * a finger other than the thumb (B♭: 2 1 2 3 1 2 3 4 1 2 3 1 2 3 4). A right hand that starts on the thumb takes the
 * thumb again on the middle tonic and keeps its top finger for the end (C: 1 2 3 1 2 3 4 1 2 3 1 2 3 4 5).
 */
export function twoOctaves(f: Fingering): Fingering {
  const rh = f.rh[0] === 1 ? [...f.rh.slice(0, 7), ...f.rh] : [...f.rh, ...f.rh.slice(1)]
  return { rh, lh: [...f.lh, ...f.lh.slice(1)] }
}

/** Standard fingering for the run, or null when there isn't a trusted one (the theory library's list). */
export function runFingering(tonic: Note, type: ScaleType, octaves: Octaves): Fingering | null {
  const one = scaleFingering(tonic, type)
  if (!one || one.rh.length !== 8) return null
  return octaves === 2 ? twoOctaves(one) : one
}

const G = 4

/**
 * The octave each hand starts in. One octave: the right hand from octave 4, the left from octave 3, an octave apart.
 * Two octaves are placed to keep ledger lines down: the left hand alone from octave 2, the right hand alone from
 * octave 3 for G, A and B (else 4), and hands together an octave apart from octaves 3 and 2 (C from 4 and 3).
 */
export function startOctaves(tonic: Note, hands: Hands, octaves: Octaves): { rh: number; lh: number } {
  if (octaves === 1) return { rh: 4, lh: 3 }
  if (hands === 'lh') return { rh: 4, lh: 2 }
  if (hands === 'rh') return { rh: tonic.letter >= G ? 3 : 4, lh: 2 }
  return tonic.letter === 0 ? { rh: 4, lh: 3 } : { rh: 3, lh: 2 }
}

export interface HandNote {
  note: Note
  midi: number
  finger?: number
}

export interface Step {
  /** Position in the scale going up (0 = the bottom tonic). */
  pos: number
  rh?: HandNote
  lh?: HandNote
}

export interface ScaleRun {
  /** The scale going up, per playing hand. */
  rh: Note[]
  lh: Note[]
  fingering: Fingering | null
  /** Every note to play, in order (up, and back down if chosen). */
  steps: Step[]
}

/** A run of the scale from `tonic` (its letter and accidental; the octaves are chosen here). */
export function scaleRun(tonic: Note, type: ScaleType, hands: Hands, octaves: Octaves, upDown: boolean): ScaleRun {
  const o = startOctaves(tonic, hands, octaves)
  const rh = hands !== 'lh' ? scaleNotes({ ...tonic, oct: o.rh }, type, octaves) : []
  const lh = hands !== 'rh' ? scaleNotes({ ...tonic, oct: o.lh }, type, octaves) : []
  const fingering = runFingering(tonic, type, octaves)
  const count = Math.max(rh.length, lh.length)
  const up = Array.from({ length: count }, (_, i) => i)
  const order = upDown ? [...up, ...up.slice(0, -1).reverse()] : up
  const at = (notes: Note[], fingers: number[] | undefined, pos: number): HandNote | undefined =>
    notes.length ? { note: notes[pos], midi: midiOf(notes[pos]), finger: fingers?.[pos] } : undefined
  const steps = order.map((pos) => ({ pos, rh: at(rh, fingering?.rh, pos), lh: at(lh, fingering?.lh, pos) }))
  return { rh, lh, fingering, steps }
}

/** Highlight ids for the score: two per step, the right hand's then the left's. */
export const noteId = (step: number, hand: 'rh' | 'lh') => step * 2 + (hand === 'lh' ? 1 : 0)
export const stepOfId = (id: number) => Math.floor(id / 2)

const LAST: Record<number, [Duration, number]> = { 1: ['q', 0], 2: ['h', 0], 3: ['h', 1], 4: ['w', 0] }

/**
 * The run as music to read: a quarter note per beat in 4/4 (the beats the in-time run clicks), the last note held to
 * the end of its bar. The right hand on the treble staff, the left on the bass staff; together, a grand staff.
 */
export function runScore(steps: Step[], keySig: number): ScoreInput {
  const n = steps.length
  const lastBeats = 4 - ((n - 1) % 4)
  const bars = Array.from({ length: (n - 1 + lastBeats) / 4 }, (_, b) => ({ start: b * 4, dur: 4, keySig, time: [4, 4] as [number, number] }))
  const voice = (hand: 'rh' | 'lh', staff: StaffId) => ({
    staff,
    events: steps.map((s, k): ScoreEvent => {
      const [dur, dots] = k === n - 1 ? LAST[lastBeats] : (['q', 0] as [Duration, number])
      const h = s[hand]!
      return { key: `${hand}${k}`, start: k, dur, dots, notes: [{ id: noteId(k, hand), note: h.note, finger: h.finger, tie: false, cont: false }] }
    }),
  })
  const staves: StaffId[] = []
  const voices = []
  if (steps[0]?.rh) {
    staves.push('treble')
    voices.push(voice('rh', 'treble'))
  }
  if (steps[0]?.lh) {
    staves.push('bass')
    voices.push(voice('lh', 'bass'))
  }
  return { staves, bars, voices, chords: [], final: true }
}
