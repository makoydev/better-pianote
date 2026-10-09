import {
  type Chord,
  FLAT_SPELL,
  LETTERS,
  type Note,
  SEMITONE_NAMES,
  SHARP_SPELL,
  accText,
  chordPcs,
  chordTones,
  closeVoicing,
  intervalBetween,
  mod,
  pcOf,
  placeAtMidi,
} from '../../lib/theory'

/** Chord qualities grouped for the explorer's picker (covers every CHORD_TYPES id). */
export const CHORD_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Triads', ids: ['maj', 'min', 'dim', 'aug'] },
  { title: 'Sus & power', ids: ['sus2', 'sus4', '5'] },
  { title: 'Sevenths', ids: ['7', 'maj7', 'm7', 'm7b5', 'dim7', 'mMaj7', '7sus4'] },
  { title: 'Colour', ids: ['6', 'm6', 'add9', 'madd9', '9', 'maj9', 'm9'] },
]

/** Both names of each pitch class, e.g. { sharp: 'C♯', flat: 'D♭' }. */
export const PC_NAMES = Array.from({ length: 12 }, (_, pc) => {
  const name = ([letter, acc]: readonly [number, number]) => LETTERS[letter] + accText(acc)
  return { pc, sharp: name(SHARP_SPELL[pc]), flat: name(FLAT_SPELL[pc]), black: SHARP_SPELL[pc][1] !== 0 }
})

/** Right-hand chord in close position, lowest note at or above `floor` (default middle C). */
export function rhVoicing(chord: Chord, inversion: number, floor = 60): number[] {
  const pcs = chordPcs({ root: chord.root, type: chord.type })
  return closeVoicing(pcs, Math.min(inversion, pcs.length - 1), floor)
}

/** Left hand: root-position root, 3rd and 5th (no extensions), root between E2 and D♯3 by default. */
export function lhVoicing(chord: Chord, low = 40): number[] {
  const pcs = chordPcs({ root: chord.root, type: chord.type }).slice(0, 3)
  return closeVoicing(pcs, 0, low)
}

/** Spell MIDI notes with the chord's own letter names (G♯ in E major, not A♭). */
export function spellVoicing(chord: Chord, midis: number[]): Note[] {
  const tones = chordTones(chord.root, chord.type)
  return midis.map((m) => {
    const t = tones.find((n) => pcOf(n) === mod(m, 12)) ?? tones[0]
    return placeAtMidi(t.letter, t.acc, m)
  })
}

const TRIADS = new Set(['maj', 'min', 'dim', 'aug'])

/**
 * Right-hand fingering for a close voicing (thumb = 1). Triads use the standard 1-3-5 / 1-2-5 / 1-3-5;
 * other shapes put neighbouring fingers on notes a step apart.
 */
export function rhFingers(midis: number[], typeId: string, inversion: number): number[] {
  const n = midis.length
  if (n <= 1) return [1]
  if (n === 2) return midis[1] - midis[0] >= 7 ? [1, 5] : [1, 3]
  if (n === 3) {
    if (TRIADS.has(typeId)) return inversion === 1 ? [1, 2, 5] : [1, 3, 5]
    const [a, b, c] = midis
    if (c - b <= 2) return [1, 4, 5]
    if (b - a <= 2) return [1, 2, 5]
    return [1, 3, 5]
  }
  if (n === 4) return midis[3] - midis[2] <= 2 ? [1, 2, 4, 5] : [1, 2, 3, 5]
  return [1, 2, 3, 4, 5].slice(0, n)
}

/** Left-hand fingering for a close voicing, lowest note first (pinky = 5). */
export function lhFingers(midis: number[]): number[] {
  const n = midis.length
  if (n <= 1) return [5]
  if (n === 2) return [5, 1]
  if (n === 3) {
    const [a, b, c] = midis
    if (b - a <= 2) return [5, 4, 1]
    if (c - b <= 2) return [5, 2, 1]
    return [5, 3, 1]
  }
  return midis[1] - midis[0] <= 2 ? [5, 4, 2, 1] : [5, 3, 2, 1]
}

export interface FormulaPart {
  note: Note
  degree: string
  /** Half steps above the root. */
  semis: number
  /** Half steps above the previous chord tone. */
  gap: number
  gapName: string
  /** Interval from the root, e.g. "Minor 3rd". */
  fromRoot: string
}

/** How the chord is built: each tone, its degree, and the step from the tone below. */
export function chordFormula(chord: Chord): FormulaPart[] {
  const tones = chordTones({ ...chord.root, oct: 4 }, chord.type)
  const semis = chord.type.ivs.map((iv) => iv.semis)
  return tones.map((n, i) => {
    const gap = i === 0 ? 0 : semis[i] - semis[i - 1]
    return {
      note: n,
      degree: chord.type.degrees[i],
      semis: semis[i],
      gap,
      gapName: i === 0 ? '' : (SEMITONE_NAMES[gap] ?? `${gap} half steps`),
      fromRoot: i === 0 ? 'Root' : intervalBetween(tones[0], n).name,
    }
  })
}

export interface GuitarShape {
  /** Six strings, low E to high E: fret number, 0 = open, x = not played. */
  frets: string
  /** A finger laid across several strings (string 6 = low E). */
  barre?: { fret: number; from: number; to: number }
}

/** Standard-tuning shapes, keyed by chord symbol. Every one is checked note-by-note in the tests. */
export const GUITAR_SHAPES: Record<string, GuitarShape> = {
  C: { frets: 'x32010' },
  D: { frets: 'xx0232' },
  E: { frets: '022100' },
  G: { frets: '320003' },
  A: { frets: 'x02220' },
  Am: { frets: 'x02210' },
  Em: { frets: '022000' },
  Dm: { frets: 'xx0231' },
  E7: { frets: '020100' },
  A7: { frets: 'x02020' },
  D7: { frets: 'xx0212' },
  G7: { frets: '320001' },
  C7: { frets: 'x32310' },
  B7: { frets: 'x21202' },
  Cmaj7: { frets: 'x32000' },
  Fmaj7: { frets: 'xx3210' },
  Amaj7: { frets: 'x02120' },
  Dmaj7: { frets: 'xx0222' },
  Am7: { frets: 'x02010' },
  Em7: { frets: '020000' },
  Dm7: { frets: 'xx0211' },
  Asus2: { frets: 'x02200' },
  Asus4: { frets: 'x02230' },
  Dsus2: { frets: 'xx0230' },
  Dsus4: { frets: 'xx0233' },
  Esus4: { frets: '022200' },
  Cadd9: { frets: 'x32030' },
  F: { frets: '133211', barre: { fret: 1, from: 6, to: 1 } },
  Bm: { frets: 'x24432', barre: { fret: 2, from: 5, to: 1 } },
  'B♭': { frets: 'x13331', barre: { fret: 1, from: 5, to: 1 } },
  E5: { frets: '022xxx' },
  A5: { frets: 'x022xx' },
}

const TUNING = [40, 45, 50, 55, 59, 64]

/** MIDI notes a guitar shape sounds (open strings E2 A2 D3 G3 B3 E4). */
export function shapeMidis(frets: string): number[] {
  return [...frets].flatMap((f, i) => (f === 'x' ? [] : [TUNING[i] + Number(f)]))
}
