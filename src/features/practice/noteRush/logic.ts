import { LETTERS, midiOf, mod, noteName, parseNote } from '../../../lib/theory'

export type RushClef = 'treble' | 'bass' | 'grand'
export type RushLevel = 1 | 2 | 3 | 4 | 5

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

// Friendly accidentals only (no E♯, B♯, F♭, C♭).
const SHARPABLE = new Set(['C', 'D', 'F', 'G', 'A'])
const FLATTABLE = new Set(['D', 'E', 'G', 'A', 'B'])

export function poolFor(clef: RushClef, level: RushLevel): { name: string; staff: 'treble' | 'bass' }[] {
  const p = POOLS[level === 5 ? 3 : level]
  const t = p.treble.map((name) => ({ name, staff: 'treble' as const }))
  const b = p.bass.map((name) => ({ name, staff: 'bass' as const }))
  return clef === 'treble' ? t : clef === 'bass' ? b : [...t, ...b]
}

export function makeRound(clef: RushClef, level: RushLevel, count = 150, rand: () => number = Math.random): RushNote[] {
  const pool = poolFor(clef, level)
  const out: RushNote[] = []
  let last = ''
  for (let id = 0; out.length < count; id++) {
    const pick = pool[Math.floor(rand() * pool.length)]
    let name = pick.name
    if (level === 5 && rand() < 0.45) {
      const letter = name[0]
      const options = [SHARPABLE.has(letter) ? '#' : null, FLATTABLE.has(letter) ? 'b' : null].filter(Boolean) as string[]
      if (options.length) name = letter + options[Math.floor(rand() * options.length)] + name.slice(1)
    }
    if (name === last) continue
    last = name
    out.push({ id, name, midi: midiOf(parseNote(name)), staff: pick.staff })
  }
  return out
}

export function multiplier(combo: number) {
  return combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1
}

export function isCorrect(note: RushNote, midi: number, strictOctave: boolean) {
  return strictOctave ? midi === note.midi : mod(midi, 12) === mod(note.midi, 12)
}

/** Name-it mode: letter plus accidental must match how the note is written. */
export function nameMatches(note: RushNote, letter: number, acc: number) {
  const n = parseNote(note.name)
  return n.letter === letter && n.acc === acc
}

/** Keyboard range (whole octaves) that covers every note in the pool. */
export function keyboardRange(clef: RushClef, level: RushLevel): [number, number] {
  const ms = poolFor(clef, level).map((p) => midiOf(parseNote(p.name)))
  const lo = Math.min(...ms) - 1
  const hi = Math.max(...ms) + 1
  return [lo - mod(lo, 12), hi + (11 - mod(hi, 12))]
}

export const prettyName = (name: string) => noteName(parseNote(name))
