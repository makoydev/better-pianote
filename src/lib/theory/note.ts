/** Spelled notes: a letter, an accidental and an octave, plus MIDI conversion. */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

/** Semitones above C for each natural letter. */
export const LETTER_SEMIS = [0, 2, 4, 5, 7, 9, 11] as const

/** A spelled note. `letter` indexes LETTERS; `acc` is -2..2 (flats negative). */
export interface Note {
  letter: number
  acc: number
  oct: number
}

/** A distance between notes. `num` is the diatonic number (3 = a third); negative means downward. */
export interface Interval {
  num: number
  semis: number
}

export type Spelling = 'sharp' | 'flat' | 'common'

export const mod = (n: number, m: number) => ((n % m) + m) % m

export const MIDDLE_C = 60

export function midiOf(n: Note): number {
  return (n.oct + 1) * 12 + LETTER_SEMIS[n.letter] + n.acc
}

export function pcOf(n: Note): number {
  return mod(LETTER_SEMIS[n.letter] + n.acc, 12)
}

/** One step per letter, so the staff position of a note: C4 → 28, D4 → 29 … */
export function stepOf(n: Note): number {
  return n.oct * 7 + n.letter
}

const NOTE_RE = /^([A-Ga-g])(#{1,2}|x|b{1,2}|♯{1,2}|♭{1,2}|𝄪|𝄫)?(-?\d+)?$/

/** Parse "C4", "Eb3", "F#", "B♭5" … (octave defaults to 4). */
export function parseNote(s: string, defaultOct = 4): Note {
  const m = NOTE_RE.exec(s.trim())
  if (!m) throw new Error(`Bad note name: ${s}`)
  const letter = LETTERS.indexOf(m[1].toUpperCase() as Letter)
  const a = m[2] ?? ''
  let acc = 0
  if (a === 'x' || a === '𝄪') acc = 2
  else if (a === '𝄫') acc = -2
  else if (a.startsWith('#') || a.startsWith('♯')) acc = a.length
  else if (a.startsWith('b') || a.startsWith('♭')) acc = -a.length
  const oct = m[3] !== undefined ? Number(m[3]) : defaultOct
  return { letter, acc, oct }
}

/** Shorthand: note('C#4'). */
export const note = (s: string) => parseNote(s)
/** Shorthand: midi('C#4') → 61. */
export const midi = (s: string) => midiOf(parseNote(s))

const ACC_UNICODE: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }
const ACC_ASCII: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: 'x' }

export function accText(acc: number, ascii = false): string {
  return (ascii ? ACC_ASCII : ACC_UNICODE)[acc] ?? ''
}

export function letterOf(n: Note): Letter {
  return LETTERS[n.letter]
}

/** "E♭4" (or "Eb4" with ascii, or "E♭" without octave). */
export function noteName(n: Note, opts: { octave?: boolean; ascii?: boolean } = {}): string {
  const { octave = true, ascii = false } = opts
  return LETTERS[n.letter] + accText(n.acc, ascii) + (octave ? String(n.oct) : '')
}

/** Pitch-class name without octave, e.g. "F♯". */
export const pitchName = (n: Note, ascii = false) => noteName(n, { octave: false, ascii })

// [letter, acc] for each pitch class
export const SHARP_SPELL: readonly (readonly [number, number])[] = [
  [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0],
]
export const FLAT_SPELL: readonly (readonly [number, number])[] = [
  [0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0],
]
/** The spelling most people expect with no key context: C♯ E♭ F♯ A♭ B♭. */
const COMMON_SHARP = new Set([1, 6])

/** Place a letter+accidental at the octave that gives `midi`. */
export function placeAtMidi(letter: number, acc: number, midiNum: number): Note {
  const oct = Math.floor((midiNum - LETTER_SEMIS[letter] - acc) / 12) - 1
  return { letter, acc, oct }
}

export function fromMidi(midiNum: number, spelling: Spelling = 'common'): Note {
  const pc = mod(midiNum, 12)
  const useSharp = spelling === 'sharp' || (spelling === 'common' && COMMON_SHARP.has(pc))
  const [letter, acc] = (useSharp ? SHARP_SPELL : FLAT_SPELL)[pc]
  return placeAtMidi(letter, acc, midiNum)
}

/** Move a note by an interval, keeping correct letter names (C + M3 = E, E♭ + m3 = G♭). */
export function transpose(n: Note, iv: Interval): Note {
  const steps = iv.num > 0 ? iv.num - 1 : iv.num + 1
  const li = n.letter + steps
  const letter = mod(li, 7)
  const oct = n.oct + Math.floor(li / 7)
  const target = midiOf(n) + iv.semis
  const natural = (oct + 1) * 12 + LETTER_SEMIS[letter]
  return { letter, acc: target - natural, oct }
}

export const sameNote = (a: Note, b: Note) => a.letter === b.letter && a.acc === b.acc && a.oct === b.oct
export const samePitchClass = (a: Note, b: Note) => pcOf(a) === pcOf(b)

/** Fixed-do solfège syllables for each letter. */
export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'] as const

export function solfegeName(n: Note): string {
  return SOLFEGE[n.letter] + accText(n.acc)
}

/** Both names of a black key, e.g. "C♯ / D♭". */
export function enharmonicLabel(midiNum: number): string {
  const s = fromMidi(midiNum, 'sharp')
  const f = fromMidi(midiNum, 'flat')
  return s.acc === 0 ? pitchName(s) : `${pitchName(s)} / ${pitchName(f)}`
}

export const isBlackKey = (midiNum: number) => [1, 3, 6, 8, 10].includes(mod(midiNum, 12))
