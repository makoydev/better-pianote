import { CHORD_TYPE, type ChordType, INTERVAL_SONGS, SEMITONE_NAMES, fromMidi, mod, pitchName } from '../../../lib/theory'

/** Ear Training question generators. All notes are MIDI numbers. */

export type EarMode = 'quality' | 'interval' | 'echo'

export interface EarLevel {
  id: string
  name: string
  description: string
}

export const QUALITY_LEVELS: (EarLevel & { types: ChordType[] })[] = [
  { id: 'mm', name: 'Major or minor', description: 'Happy or sad? The most important sound to know.', types: [CHORD_TYPE.maj, CHORD_TYPE.min] },
  {
    id: 'four',
    name: 'Add dim & aug',
    description: 'Tense diminished and dreamy augmented join in.',
    types: [CHORD_TYPE.maj, CHORD_TYPE.min, CHORD_TYPE.dim, CHORD_TYPE.aug],
  },
]

export const INTERVAL_LEVELS: (EarLevel & { semis: number[]; harmonic: number })[] = [
  { id: 'five', name: 'The big five', description: 'Major 2nd, major 3rd, 4th, 5th, octave.', semis: [2, 4, 5, 7, 12], harmonic: 0 },
  { id: 'thirds', name: 'Thirds & sixths', description: 'Major vs minor 3rds and 6ths: the colour of chords.', semis: [3, 4, 8, 9], harmonic: 0 },
  { id: 'all', name: 'Every interval', description: 'All twelve, sometimes played together.', semis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], harmonic: 0.3 },
]

export const ECHO_LEVELS: (EarLevel & { length: number; scale: number[]; maxLeap: number })[] = [
  { id: 'three', name: '3 notes', description: 'Short tunes from the five-note pentatonic scale.', length: 3, scale: [0, 2, 4, 7, 9, 12], maxLeap: 1 },
  { id: 'four', name: '4 notes', description: 'Steps and small skips in C major.', length: 4, scale: [0, 2, 4, 5, 7, 9, 11, 12], maxLeap: 2 },
  { id: 'five', name: '5 notes', description: 'Longer tunes with leaps up to a fifth.', length: 5, scale: [0, 2, 4, 5, 7, 9, 11, 12], maxLeap: 4 },
]

const pick = <T,>(xs: T[], rng: () => number) => xs[Math.floor(rng() * xs.length)]

export interface QualityQ {
  kind: 'quality'
  root: number
  type: ChordType
}

export function makeQuality(level: (typeof QUALITY_LEVELS)[number], prev: QualityQ | null, rng: () => number = Math.random): QualityQ {
  let q: QualityQ
  do {
    q = { kind: 'quality', root: 48 + Math.floor(rng() * 12), type: pick(level.types, rng) }
  } while (prev && prev.root === q.root && prev.type === q.type)
  return q
}

export const QUALITY_LABEL: Record<string, string> = { maj: 'Major', min: 'Minor', dim: 'Diminished', aug: 'Augmented' }

export function qualityNotes(q: QualityQ): number[] {
  return q.type.ivs.map((iv) => q.root + iv.semis)
}

export interface IntervalQ {
  kind: 'interval'
  low: number
  semis: number
  harmonic: boolean
}

export function makeInterval(level: (typeof INTERVAL_LEVELS)[number], prev: IntervalQ | null, rng: () => number = Math.random): IntervalQ {
  let q: IntervalQ
  do {
    q = { kind: 'interval', low: 55 + Math.floor(rng() * 10), semis: pick(level.semis, rng), harmonic: rng() < level.harmonic }
  } while (prev && prev.semis === q.semis && level.semis.length > 1 && rng() < 0.7)
  return q
}

export function intervalName(semis: number): string {
  return SEMITONE_NAMES[semis]
}

export function intervalCue(semis: number): string | undefined {
  return INTERVAL_SONGS[semis]
}

export interface EchoQ {
  kind: 'echo'
  notes: number[]
}

/** A short tune around middle C, moving by at most `maxLeap` scale steps. */
export function makeEcho(level: (typeof ECHO_LEVELS)[number], rng: () => number = Math.random): EchoQ {
  const scale = level.scale.map((s) => 60 + s)
  let i = Math.floor(rng() * Math.min(4, scale.length))
  const notes = [scale[i]]
  while (notes.length < level.length) {
    let step = 0
    while (step === 0) step = Math.floor(rng() * (2 * level.maxLeap + 1)) - level.maxLeap
    i = Math.max(0, Math.min(scale.length - 1, i + step))
    // Avoid repeating the same note twice in a row; it's hard to hear as a "tune".
    if (scale[i] === notes[notes.length - 1]) continue
    notes.push(scale[i])
  }
  return { kind: 'echo', notes }
}

/** Echo answers compare letter names only, so any octave counts. */
export const samePitchClass = (a: number, b: number) => mod(a, 12) === mod(b, 12)

export type EarQuestion = QualityQ | IntervalQ | EchoQ

/** How one question went. */
export interface EarOutcome {
  question: EarQuestion
  correct: boolean
  /** Right without help (first try for choices, no reveal for echo). */
  clean: boolean
  /** Your first wrong choice (an option id), when you didn't get it first time. */
  said?: string
  /** Echo: the notes of your first wrong try. */
  played?: number[]
}

/** The option id of the right answer ("min", "9"). */
export function rightOption(q: QualityQ | IntervalQ): string {
  return q.kind === 'quality' ? q.type.id : String(q.semis)
}

/** The notes an option stands for: that chord colour on the question's root, or that interval above its low note. */
export function optionNotes(q: QualityQ | IntervalQ, id: string): number[] {
  if (q.kind === 'interval') return [q.low, q.low + Number(id)]
  return (CHORD_TYPE[id] ?? q.type).ivs.map((iv) => q.root + iv.semis)
}

const tune = (notes: number[]) => notes.map((m) => pitchName(fromMidi(m))).join(' – ')

/** A miss in words: what it was ("Major 6th", "C♯ minor") and what you answered ("minor 7th", "major"). */
export function describeMiss(o: EarOutcome): { asked: string; said?: string } {
  const q = o.question
  if (q.kind === 'echo') return { asked: tune(q.notes), said: o.played?.length ? tune(o.played) : undefined }
  if (q.kind === 'quality') {
    return { asked: `${pitchName(fromMidi(q.root))} ${QUALITY_LABEL[q.type.id].toLowerCase()}`, said: o.said && QUALITY_LABEL[o.said]?.toLowerCase() }
  }
  return { asked: intervalName(q.semis), said: o.said && intervalName(Number(o.said))?.toLowerCase() }
}
