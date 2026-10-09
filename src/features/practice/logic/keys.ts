import { type Key, keyName, keySignature, majorKey, relativeKey } from '../../../lib/theory'
import { shuffle } from './chords'

/** Key Signature Quiz question generators. */

export interface KeyLevel {
  id: string
  name: string
  description: string
  /** Most sharps/flats used. */
  max: number
  minor: boolean
  grand: boolean
}

export const KEY_LEVELS: KeyLevel[] = [
  { id: 'easy', name: 'Up to 2 sharps or flats', description: 'C, G, D, F and B♭ major.', max: 2, minor: false, grand: false },
  { id: 'mid', name: 'Up to 4', description: 'Adds A, E, E♭ and A♭ major.', max: 4, minor: false, grand: false },
  { id: 'all', name: 'All the major keys', description: 'Up to 7 sharps or flats, on the grand staff.', max: 7, minor: false, grand: true },
  { id: 'minor', name: 'Minor keys', description: 'Every signature also belongs to a minor key.', max: 5, minor: true, grand: true },
]

export type KeyMode = 'name' | 'find'

export interface KeyQuestion {
  /** The signature on the staff (or the right answer, in "find" mode). */
  fifths: number
  key: Key
  /** "name": labels to choose from. "find": signatures (fifths) to choose from. */
  options: { label: string; fifths: number }[]
  answer: number
}

const clamp = (f: number, max: number) => Math.max(-max, Math.min(max, f))

function keyFor(fifths: number, minor: boolean): Key {
  const k = majorKey(fifths)
  return minor ? relativeKey(k) : k
}

export function makeKeyQuestion(level: KeyLevel, prev: number | null, rng: () => number = Math.random): KeyQuestion {
  let fifths: number
  do {
    fifths = Math.floor(rng() * (2 * level.max + 1)) - level.max
  } while (fifths === prev)
  const minor = level.minor && rng() < 0.6
  const key = keyFor(fifths, minor)
  // Good distractors: same count of the other accidental, and neighbours on the circle.
  const candidates = [-fifths, fifths + 1, fifths - 1, fifths + 2, fifths - 2, -fifths + 1, -fifths - 1]
    .map((f) => clamp(f, Math.max(level.max, 2)))
    .filter((f, i, all) => f !== fifths && all.indexOf(f) === i)
  const picks = shuffle(candidates, rng).slice(0, 3)
  const all = shuffle([fifths, ...picks], rng)
  return {
    fifths,
    key,
    options: all.map((f) => ({ fifths: f, label: keyName(keyFor(f, minor)) })),
    answer: all.indexOf(fifths),
  }
}

export function describeSignature(fifths: number): string {
  if (fifths === 0) return 'no sharps or flats'
  const n = Math.abs(fifths)
  return `${n} ${fifths > 0 ? 'sharp' : 'flat'}${n > 1 ? 's' : ''}`
}

/** "D major has 2 sharps: F♯, C♯. Trick: …" */
export function explainKey(fifths: number, key: Key): string {
  const sig = keySignature(fifths)
  const names = sig.letters.map((l) => l + (sig.acc > 0 ? '♯' : '♭'))
  const base = fifths === 0 ? `${keyName(key)} has no sharps or flats.` : `${keyName(key)} has ${describeSignature(fifths)}: ${names.join(', ')}.`
  if (key.mode === 'minor') {
    return `${base} It shares this signature with its relative major, ${keyName(relativeKey(key))}: the minor key starts 3 half steps lower.`
  }
  if (fifths > 0) return `${base} Trick: the last sharp (${names[names.length - 1]}) is a half step below the key's name.`
  if (fifths === -1) return `${base} Just remember: one flat means F major.`
  if (fifths < -1) return `${base} Trick: the second-to-last flat (${names[names.length - 2]}) is the key's name.`
  return base
}
