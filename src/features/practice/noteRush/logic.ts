import { LETTERS, accText, keyId, keyName, keySignature, majorKey, midiOf, mod, noteName, parseNote } from '../../../lib/theory'

export type RushClef = 'treble' | 'bass' | 'grand'
export type RushLevel = 1 | 2 | 3 | 4 | 5

/** Key signatures a round can use, as sharps (+) or flats (−): none, G, D, F and B♭ major. */
export const RUSH_KEYS = [0, 1, 2, -1, -2] as const
export type RushKey = (typeof RUSH_KEYS)[number]

export interface RushNote {
  id: number
  /** Spelled name, e.g. "F#4". */
  name: string
  midi: number
  staff: 'treble' | 'bass'
}

export const LEVELS: { level: RushLevel; title: string; detail: string }[] = [
  { level: 1, title: 'Landmarks', detail: 'Middle C, treble G, bass F and friends' },
  { level: 2, title: 'C position', detail: 'The five notes under each hand' },
  { level: 3, title: 'The whole staff', detail: 'Every line and space' },
  { level: 4, title: 'Ledger lines', detail: 'Notes above and below the staff' },
  { level: 5, title: 'Sharps & flats', detail: 'The whole staff, with accidentals' },
]

/** The CT-S1's keys: the on-screen keyboard never reaches past them. */
const LOWEST = 36 // C2
const HIGHEST = 96 // C7

/** White-key names from `from` to `to`, e.g. naturals('D4', 'G5'). */
export function naturals(from: string, to: string): string[] {
  const a = parseNote(from)
  const b = parseNote(to)
  const out: string[] = []
  for (let step = a.oct * 7 + a.letter; step <= b.oct * 7 + b.letter; step++) out.push(`${LETTERS[step % 7]}${Math.floor(step / 7)}`)
  return out
}

const POOLS: Record<1 | 2 | 3 | 4, { treble: string[]; bass: string[] }> = {
  1: { treble: ['C4', 'G4', 'C5', 'F5'], bass: ['G2', 'C3', 'F3', 'C4'] },
  2: { treble: naturals('C4', 'G4'), bass: naturals('C3', 'G3') },
  3: { treble: naturals('D4', 'G5'), bass: naturals('F2', 'B3') },
  4: { treble: naturals('A3', 'C6'), bass: naturals('C2', 'E4') },
}

export function poolFor(clef: RushClef, level: RushLevel): { name: string; staff: 'treble' | 'bass' }[] {
  const p = POOLS[level === 5 ? 3 : level]
  const t = p.treble.map((name) => ({ name, staff: 'treble' as const }))
  const b = p.bass.map((name) => ({ name, staff: 'bass' as const }))
  return clef === 'treble' ? t : clef === 'bass' ? b : [...t, ...b]
}

// Friendly accidentals only: no E♯, B♯, F♭ or C♭ (and never a double sharp or flat).
const UNFRIENDLY = new Set(['E1', 'B1', 'F-1', 'C-1'])
const friendly = (letter: number, acc: number) => Math.abs(acc) <= 1 && !UNFRIENDLY.has(`${LETTERS[letter]}${acc}`)

/** The sharp (1) or flat (−1) the key signature gives a letter. */
export function keyAccidental(letter: number, key: number): number {
  const sig = keySignature(key)
  return sig.letters.includes(LETTERS[letter]) ? sig.acc : 0
}

/** One note a round can ask, and its share of the picks before weak spots are weighted in. */
export interface RushChoice {
  name: string
  staff: 'treble' | 'bass'
  chance: number
}

/**
 * Every note a round can ask: the level's notes as the key signature makes them (in G major every F is F♯), and at
 * level 5 also raised or lowered a half step, which is what the written accidentals are for (about 45% of notes).
 */
export function rushChoices(clef: RushClef, level: RushLevel, key = 0): RushChoice[] {
  return poolFor(clef, level).flatMap(({ name, staff }) => {
    const n = parseNote(name)
    const spell = (acc: number) => LETTERS[n.letter] + accText(acc, true) + n.oct
    const own = keyAccidental(n.letter, key)
    if (level !== 5) return [{ name: spell(own), staff, chance: 1 }]
    const altered = [own + 1, own - 1].filter((acc) => friendly(n.letter, acc))
    return [{ name: spell(own), staff, chance: altered.length ? 0.55 : 1 }, ...altered.map((acc) => ({ name: spell(acc), staff, chance: 0.45 / altered.length }))]
  })
}

/** The id weak spots are kept under: the clef it's read in and the note, e.g. "treble:F#4". */
export const rushItemId = (n: { name: string; staff: 'treble' | 'bass' }) => `${n.staff}:${n.name}`

/**
 * A round of notes. `weight` makes some notes come up more often (weak spots, or a drill of what you missed);
 * the same note never comes twice in a row.
 */
export function makeRound(
  clef: RushClef,
  level: RushLevel,
  count = 150,
  rand: () => number = Math.random,
  opts: { key?: number; weight?: (c: RushChoice) => number } = {},
): RushNote[] {
  const choices = rushChoices(clef, level, opts.key)
  const weighted = choices.map((c) => c.chance * (opts.weight?.(c) ?? 1))
  const weights = weighted.some((w) => w > 0) ? weighted : choices.map((c) => c.chance)
  const total = weights.reduce((a, b) => a + b, 0)
  const out: RushNote[] = []
  let last = ''
  for (let id = 0; out.length < count; id++) {
    let r = rand() * total
    let k = 0
    while (k < choices.length - 1 && (r -= weights[k]) >= 0) k++
    const { name, staff } = choices[k]
    if (name === last) continue
    last = name
    out.push({ id, name, midi: midiOf(parseNote(name)), staff })
  }
  return out
}

export function multiplier(combo: number) {
  return combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1
}

/** Stars for a round: accuracy, and enough notes that a slow, careful round doesn't get all three. */
export function rushStars(correct: number, wrong: number): number {
  const total = correct + wrong
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  return accuracy >= 95 && correct >= 25 ? 3 : accuracy >= 85 && correct >= 15 ? 2 : correct > 0 ? 1 : 0
}

/** How much of a three-star round a minute was (0–1): the accuracy, scaled down below the 25 notes three stars need. */
export function rushShare(correct: number, wrong: number): number {
  const total = correct + wrong
  return total ? (correct / total) * Math.min(1, correct / 25) : 0
}

export function isCorrect(note: RushNote, midi: number, strictOctave: boolean) {
  return strictOctave ? midi === note.midi : mod(midi, 12) === mod(note.midi, 12)
}

/** Name-it mode: letter plus accidental must match the note (with the key signature's sharps and flats). */
export function nameMatches(note: RushNote, letter: number, acc: number) {
  const n = parseNote(note.name)
  return n.letter === letter && n.acc === acc
}

/**
 * The keyboard for a round: whole octaves, from the C at or below the lowest note to the B at or above the highest,
 * with nothing extra, and never past the CT-S1's C2–C7.
 */
export function keyboardRange(clef: RushClef, level: RushLevel, key = 0): [number, number] {
  const ms = rushChoices(clef, level, key).map((c) => midiOf(parseNote(c.name)))
  const lo = Math.min(...ms)
  const hi = Math.max(...ms)
  return [Math.max(LOWEST, lo - mod(lo, 12)), Math.min(HIGHEST, hi + 11 - mod(hi, 12))]
}

/** Where a round's bests live: "treble" or, with a key signature, "treble:G" (then ":3" for the level). */
export function rushGroup(clef: RushClef, key: number): string {
  return key ? `${clef}:${keyId(majorKey(key))}` : clef
}

/**
 * A level's description for the setup. With a key signature the notes follow it, so it says so (Landmarks in
 * D major has C♯ where middle C would be).
 */
export function levelDetail(level: RushLevel, key = 0): string {
  const detail = LEVELS[level - 1].detail
  if (!key) return detail
  const inKey = keyName(majorKey(key))
  if (level === 1) return `The landmark lines and spaces, in ${inKey}`
  if (level === 2) {
    const five = rushChoices('treble', 2, key).map((c) => prettyName(c.name).replace(/\d+$/, ''))
    return `The five notes from C up, in ${inKey}: ${five.join(' ')}`
  }
  return `${detail}, in ${inKey}`
}

/** "G major: every F is F♯." */
export function keyHint(key: number): string {
  const sig = keySignature(key)
  if (!sig.letters.length) return 'No sharps or flats: notes are as written.'
  const acc = sig.acc > 0 ? '♯' : '♭'
  return `${keyName(majorKey(key))}: ${sig.letters.map((l) => `every ${l} is ${l}${acc}`).join(' and ')}.`
}

export const prettyName = (name: string) => noteName(parseNote(name))
