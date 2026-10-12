import { micHearsChord } from '../../../lib/input/micMatch'
import {
  CHORD_TYPE,
  type Chord,
  type ChordType,
  INTERVAL_SONGS,
  IV,
  type Interval,
  type Note,
  SEMITONE_NAMES,
  fromMidi,
  mod,
  pitchName,
  spellRoot,
  transpose,
} from '../../../lib/theory'
import { weightedPick } from '../shared/weak'
import { matchChord } from './chords'

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

export interface QualityQ {
  kind: 'quality'
  root: number
  type: ChordType
}

/** `weight` (by item id, e.g. "quality:min") makes weak spots come up more often; 0 rules an option out. */
export function makeQuality(level: (typeof QUALITY_LEVELS)[number], prev: QualityQ | null, rng: () => number = Math.random, weight: (id: string) => number = () => 1): QualityQ {
  let q: QualityQ
  do {
    q = { kind: 'quality', root: 48 + Math.floor(rng() * 12), type: weightedPick(level.types, (t) => weight(`quality:${t.id}`), rng) }
  } while (prev && prev.root === q.root && prev.type === q.type)
  return q
}

export const QUALITY_LABEL: Record<string, string> = { maj: 'Major', min: 'Minor', dim: 'Diminished', aug: 'Augmented' }

export function qualityNotes(q: QualityQ): number[] {
  return q.type.ivs.map((iv) => q.root + iv.semis)
}

/** The question's chord spelled the usual way for its colour: G♯ minor (not A♭ minor), D♭ major (not C♯ major). */
export function qualityChord(q: QualityQ): Chord {
  return { root: { ...spellRoot(mod(q.root, 12), q.type), oct: fromMidi(q.root).oct }, type: q.type }
}

/** "G♯ minor". */
export const qualityName = (q: QualityQ) => `${pitchName(qualityChord(q).root)} ${QUALITY_LABEL[q.type.id].toLowerCase()}`

const INTERVAL_SPELLINGS: Record<number, Interval[]> = {
  1: [IV.m2], 2: [IV.M2], 3: [IV.m3], 4: [IV.M3], 5: [IV.P4], 6: [IV.A4, IV.d5],
  7: [IV.P5], 8: [IV.m6], 9: [IV.M6], 10: [IV.m7], 11: [IV.M7], 12: [IV.P8],
}
const ODD = new Set(['E1', 'B1', 'F-1', 'C-1'])
const spellingCost = (ns: Note[]) => ns.reduce((c, n) => c + Math.abs(n.acc) + (Math.abs(n.acc) > 1 ? 10 : 0) + (ODD.has(`${'CDEFGAB'[n.letter]}${n.acc}`) ? 2 : 0), 0)

/**
 * An interval's two notes spelled as that interval, the friendliest way: up a major 3rd from the black key above C
 * is D♭–F (C♯–F would be a 4th, and C♯–E♯ is hard to read); a tritone from C is C–F♯.
 */
export function intervalSpelling(low: number, semis: number): [Note, Note] {
  const lows = [fromMidi(low), fromMidi(low, 'sharp'), fromMidi(low, 'flat')]
  let best: [Note, Note] = [lows[0], fromMidi(low + semis)]
  let cost = Infinity
  for (const l of lows) {
    for (const iv of INTERVAL_SPELLINGS[semis] ?? []) {
      const pair: [Note, Note] = [l, transpose(l, iv)]
      const c = spellingCost(pair)
      if (c < cost) [best, cost] = [pair, c]
    }
  }
  return best
}

export interface IntervalQ {
  kind: 'interval'
  low: number
  semis: number
  harmonic: boolean
}

/** `weight` as for makeQuality, by "interval:<half steps>". */
export function makeInterval(level: (typeof INTERVAL_LEVELS)[number], prev: IntervalQ | null, rng: () => number = Math.random, weight: (id: string) => number = () => 1): IntervalQ {
  let q: IntervalQ
  do {
    q = { kind: 'interval', low: 55 + Math.floor(rng() * 10), semis: weightedPick(level.semis, (s) => weight(`interval:${s}`), rng), harmonic: rng() < level.harmonic }
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
  /** From the question appearing to your answer. */
  ms?: number
}

/** The id weak spots are kept under: "quality:min", "interval:9". Echo tunes aren't tracked. */
export function earItemId(q: EarQuestion): string | null {
  return q.kind === 'quality' ? `quality:${q.type.id}` : q.kind === 'interval' ? `interval:${q.semis}` : null
}

/** What a level asks, as item ids. */
export function earItemIds(level: EarLevel & ({ types: ChordType[] } | { semis: number[] })): string[] {
  return 'types' in level ? level.types.map((t) => `quality:${t.id}`) : level.semis.map((s) => `interval:${s}`)
}

/** "Minor", "Major 6th". */
export function earItemName(id: string): string {
  const [kind, v] = id.split(':')
  return kind === 'quality' ? (QUALITY_LABEL[v] ?? v) : intervalName(Number(v))
}

/** What notes played on the keys say: an answer (an option id, or another one you played), or not yet. */
export type Played = { id: string } | { partial: number; of: number } | { stray: true }

/** The pairs a missing 5th can't tell apart: a minor chord without its 5th could be diminished, a major one augmented. */
const SAME_THIRD: Record<string, string> = { min: 'dim', dim: 'min', maj: 'aug', aug: 'maj' }

/**
 * Read what you play as an answer.
 *
 * - Intervals: the newest note, as half steps above the low note (1 to 12). The low note itself just starts you off;
 *   notes below it or more than an octave above aren't an answer.
 * - Chords: the notes sounding together, as a chord on the question's root (any octave, any order, any inversion).
 *   Through the mic a missing 5th is forgiven (see micHearsChord), unless it could then be either of two choices.
 *   A chord that's no choice at all (a diminished one when only major and minor are offered) is a slip, not an answer.
 */
export function readPlayed(q: QualityQ | IntervalQ, notes: number[], latest: number, options: string[], viaMic = false): Played {
  if (q.kind === 'interval') {
    const d = latest - q.low
    if (d === 0) return { partial: 1, of: 2 }
    return d >= 1 && d <= 12 ? { id: String(d) } : { stray: true }
  }
  const root = fromMidi(q.root)
  const chords = options.map((id) => ({ id, chord: { root, type: CHORD_TYPE[id] } }))
  const exact = chords.filter((c) => matchChord(notes, c.chord) === 'correct')
  if (exact.length) return { id: exact[0].id }
  if (viaMic) {
    const heard = chords.filter((c) => micHearsChord(notes, c.chord) && !options.includes(SAME_THIRD[c.id]))
    if (heard.length === 1) return { id: heard[0].id }
  }
  // Still building one of them, or a note that's in none of them.
  const could = chords.filter((c) => matchChord(notes, c.chord) === 'partial')
  if (!could.length) return { stray: true }
  const pcs = new Set(notes.map((m) => mod(m, 12)))
  return { partial: pcs.size, of: Math.min(...could.map((c) => c.chord.type.ivs.length)) }
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
  if (q.kind === 'quality') return { asked: qualityName(q), said: o.said && QUALITY_LABEL[o.said]?.toLowerCase() }
  return { asked: intervalName(q.semis), said: o.said && intervalName(Number(o.said))?.toLowerCase() }
}
