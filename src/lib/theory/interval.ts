import { type Interval, type Note, midiOf, stepOf } from './note'

export const IV = {
  P1: { num: 1, semis: 0 },
  m2: { num: 2, semis: 1 },
  M2: { num: 2, semis: 2 },
  m3: { num: 3, semis: 3 },
  M3: { num: 3, semis: 4 },
  P4: { num: 4, semis: 5 },
  A4: { num: 4, semis: 6 },
  d5: { num: 5, semis: 6 },
  P5: { num: 5, semis: 7 },
  A5: { num: 5, semis: 8 },
  m6: { num: 6, semis: 8 },
  M6: { num: 6, semis: 9 },
  d7: { num: 7, semis: 9 },
  m7: { num: 7, semis: 10 },
  M7: { num: 7, semis: 11 },
  P8: { num: 8, semis: 12 },
  m9: { num: 9, semis: 13 },
  M9: { num: 9, semis: 14 },
  P11: { num: 11, semis: 17 },
  M13: { num: 13, semis: 21 },
} satisfies Record<string, Interval>

/** Interval names by semitone count (0–12). */
export const SEMITONE_NAMES = [
  'Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone',
  'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave',
] as const

/** Songs that start with each ascending interval, to help your ear remember it. */
export const INTERVAL_SONGS: Partial<Record<number, string>> = {
  1: '“Jaws” theme',
  2: '“Happy Birthday” (…py Birth-)',
  3: '“Greensleeves” (A-las)',
  4: '“When the Saints Go Marching In” (Oh when)',
  5: '“Here Comes the Bride”',
  6: '“The Simpsons” (The Simp-)',
  7: '“Twinkle Twinkle” (Twin-kle, twin-kle)',
  8: '“The Entertainer” (the jump up in the intro)',
  9: '“My Bonnie Lies Over the Ocean” (My Bon-)',
  10: '“Somewhere” from West Side Story (There’s a)',
  12: '“Somewhere Over the Rainbow” (Some-where)',
}

const ORDINALS = ['', 'Unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'Octave', '9th', '10th', '11th', '12th', '13th']
const PERFECT_TYPE = new Set([1, 4, 5, 8])
const MAJOR_SEMIS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 }

/** Precise interval name between two spelled notes, e.g. "Minor 3rd", "Augmented 4th". */
export function intervalBetween(a: Note, b: Note): { num: number; semis: number; name: string } {
  const [lo, hi] = midiOf(a) <= midiOf(b) ? [a, b] : [b, a]
  const num = stepOf(hi) - stepOf(lo) + 1
  const semis = midiOf(hi) - midiOf(lo)
  const simpleNum = ((num - 1) % 7) + 1
  const simpleSemis = semis - 12 * Math.floor((num - 1) / 7)
  const diff = simpleSemis - MAJOR_SEMIS[simpleNum]
  let quality: string
  if (PERFECT_TYPE.has(simpleNum)) {
    quality = diff === 0 ? 'Perfect' : diff > 0 ? 'Augmented' : 'Diminished'
  } else {
    quality = diff === 0 ? 'Major' : diff === -1 ? 'Minor' : diff > 0 ? 'Augmented' : 'Diminished'
  }
  let label = ORDINALS[num] ?? `${num}th`
  if (num === 1) return { num, semis, name: diff === 0 ? 'Unison' : `${quality} unison` }
  if (num === 8 && diff === 0) return { num, semis, name: 'Octave' }
  if (num === 8) label = 'octave'
  return { num, semis, name: `${quality} ${label}` }
}
