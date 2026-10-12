import { type Key, keyId, keyName, keyShort, keySignature, majorKey, parseKey, relativeKey } from '../../../lib/theory'
import { weightedPick } from '../shared/weak'
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

/** A key a level can ask, by its id ("D", "Bbm"), with its share of the questions before weak spots count. */
export interface QuizKey {
  id: string
  fifths: number
  minor: boolean
  chance: number
}

/** The keys a level asks. The minor level asks its minor keys a little more often than their relative majors. */
export function levelKeys(level: KeyLevel): QuizKey[] {
  const out: QuizKey[] = []
  for (let f = -level.max; f <= level.max; f++) {
    if (level.minor) out.push({ id: keyId(keyFor(f, true)), fifths: f, minor: true, chance: 0.6 })
    out.push({ id: keyId(keyFor(f, false)), fifths: f, minor: false, chance: level.minor ? 0.4 : 1 })
  }
  return out
}

/** "B♭m", "F♯". */
export const keyItemName = (id: string) => keyShort(parseKey(id))

/**
 * A question about a key: the one `ask` names (a key id), or one picked by `weight` (weak spots come up more
 * often), never on the signature `prev` just showed.
 */
export function makeKeyQuestion(
  level: KeyLevel,
  prev: number | null,
  rng: () => number = Math.random,
  opts: { ask?: string; weight?: (id: string) => number } = {},
): KeyQuestion {
  const keys = levelKeys(level)
  const asked = opts.ask ? keys.find((k) => k.id === opts.ask) : undefined
  const { fifths, minor } = asked ?? weightedPick(keys.filter((k) => k.fifths !== prev), (k) => k.chance * (opts.weight?.(k.id) ?? 1), rng)
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

/** A wrong answer in words, for the results: "3 sharps → you said E major (it's A major)". */
export function describeKeyMiss(q: KeyQuestion, picked: number, mode: KeyMode): { asked: string; verb: string; said: string; answer: string } {
  if (mode === 'find') return { asked: keyName(q.key), verb: 'you picked', said: describeSignature(q.options[picked].fifths), answer: describeSignature(q.fifths) }
  const sig = describeSignature(q.fifths)
  return { asked: sig[0].toUpperCase() + sig.slice(1), verb: 'you said', said: q.options[picked].label, answer: keyName(q.key) }
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
