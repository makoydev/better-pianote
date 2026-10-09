import { IV } from './interval'
import { type Interval, type Note, midiOf, pcOf, transpose } from './note'

export interface ScaleType {
  id: string
  name: string
  ivs: Interval[]
  mood: string
  /** Shown as a tip in the scale explorer. */
  about: string
}

export const SCALE_TYPES: ScaleType[] = [
  {
    id: 'major',
    name: 'Major',
    ivs: [IV.P1, IV.M2, IV.M3, IV.P4, IV.P5, IV.M6, IV.M7],
    mood: 'Bright and happy',
    about: 'The “Do Re Mi” scale. Most pop songs and nursery rhymes live here.',
  },
  {
    id: 'minor',
    name: 'Natural minor',
    ivs: [IV.P1, IV.M2, IV.m3, IV.P4, IV.P5, IV.m6, IV.m7],
    mood: 'Sad and gentle',
    about: 'Same notes as its relative major, starting from the 6th note. A minor = C major from A.',
  },
  {
    id: 'harmonic-minor',
    name: 'Harmonic minor',
    ivs: [IV.P1, IV.M2, IV.m3, IV.P4, IV.P5, IV.m6, IV.M7],
    mood: 'Dramatic, exotic',
    about: 'Natural minor with a raised 7th. That raised note makes the V chord major, so it pulls home harder.',
  },
  {
    id: 'melodic-minor',
    name: 'Melodic minor',
    ivs: [IV.P1, IV.M2, IV.m3, IV.P4, IV.P5, IV.M6, IV.M7],
    mood: 'Smooth, jazzy',
    about: 'Minor with a raised 6th and 7th going up. Classical players use the natural minor coming down.',
  },
  {
    id: 'major-pentatonic',
    name: 'Major pentatonic',
    ivs: [IV.P1, IV.M2, IV.M3, IV.P5, IV.M6],
    mood: 'Open, folky, can’t-go-wrong',
    about: 'Five notes with no half steps, so nothing clashes. Try it on the black keys only (G♭ major pentatonic)!',
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor pentatonic',
    ivs: [IV.P1, IV.m3, IV.P4, IV.P5, IV.m7],
    mood: 'Bluesy, rock',
    about: 'The guitar solo scale. Same box you know from the fretboard, now on keys.',
  },
  {
    id: 'blues',
    name: 'Blues',
    ivs: [IV.P1, IV.m3, IV.P4, IV.d5, IV.P5, IV.m7],
    mood: 'Gritty, soulful',
    about: 'Minor pentatonic plus the “blue note” (♭5). Slide off it into the 5th.',
  },
  {
    id: 'dorian',
    name: 'Dorian',
    ivs: [IV.P1, IV.M2, IV.m3, IV.P4, IV.P5, IV.M6, IV.m7],
    mood: 'Cool, minor but hopeful',
    about: 'Minor with a bright 6th. Think “So What” or “Oye Como Va”. D to D on the white keys.',
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    ivs: [IV.P1, IV.M2, IV.M3, IV.P4, IV.P5, IV.M6, IV.m7],
    mood: 'Rock, laid-back',
    about: 'Major with a flat 7th. G to G on the white keys. Classic rock and Celtic tunes love it.',
  },
  {
    id: 'lydian',
    name: 'Lydian',
    ivs: [IV.P1, IV.M2, IV.M3, IV.A4, IV.P5, IV.M6, IV.M7],
    mood: 'Floating, film-score',
    about: 'Major with a raised 4th. F to F on the white keys. The “movie magic” sound.',
  },
]

export const SCALE_TYPE: Record<string, ScaleType> = Object.fromEntries(SCALE_TYPES.map((s) => [s.id, s]))

/** Notes of the scale going up, including the top tonic for each octave. */
export function scaleNotes(tonic: Note, type: ScaleType, octaves = 1): Note[] {
  const out: Note[] = []
  for (let o = 0; o < octaves; o++) {
    const base = { ...tonic, oct: tonic.oct + o }
    for (const iv of type.ivs) out.push(transpose(base, iv))
  }
  out.push({ ...tonic, oct: tonic.oct + octaves })
  return out
}

export function scalePcs(tonic: Note, type: ScaleType): number[] {
  return type.ivs.map((iv) => pcOf(transpose(tonic, iv)))
}

/** Step pattern between neighbours: W (2 semitones), H (1), or 1½ (3). */
export function stepPattern(type: ScaleType): string[] {
  const semis = [...type.ivs.map((iv) => iv.semis), 12]
  const out: string[] = []
  for (let i = 1; i < semis.length; i++) {
    const d = semis[i] - semis[i - 1]
    out.push(d === 2 ? 'W' : d === 1 ? 'H' : d === 3 ? 'W+H' : `${d}`)
  }
  return out
}

type Fingering = { rh: number[]; lh: number[] }

// Standard one-octave fingerings, ascending (both hands read left to right on the keyboard).
const C_SHAPE: Fingering = { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [5, 4, 3, 2, 1, 3, 2, 1] }
const MAJOR_FINGERING: Record<number, Fingering> = {
  0: C_SHAPE, // C
  7: C_SHAPE, // G
  2: C_SHAPE, // D
  9: C_SHAPE, // A
  4: C_SHAPE, // E
  11: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [4, 3, 2, 1, 4, 3, 2, 1] }, // B
  6: { rh: [2, 3, 4, 1, 2, 3, 1, 2], lh: [4, 3, 2, 1, 3, 2, 1, 4] }, // F♯ / G♭
  1: { rh: [2, 3, 1, 2, 3, 4, 1, 2], lh: [3, 2, 1, 4, 3, 2, 1, 3] }, // D♭
  8: { rh: [3, 4, 1, 2, 3, 1, 2, 3], lh: [3, 2, 1, 4, 3, 2, 1, 3] }, // A♭
  3: { rh: [3, 1, 2, 3, 4, 1, 2, 3], lh: [3, 2, 1, 4, 3, 2, 1, 3] }, // E♭
  10: { rh: [2, 1, 2, 3, 1, 2, 3, 4], lh: [3, 2, 1, 4, 3, 2, 1, 3] }, // B♭
  5: { rh: [1, 2, 3, 4, 1, 2, 3, 4], lh: [5, 4, 3, 2, 1, 3, 2, 1] }, // F
}
const MINOR_FINGERING: Record<number, Fingering> = {
  9: C_SHAPE, // A minor
  4: C_SHAPE, // E minor
  2: C_SHAPE, // D minor
  7: C_SHAPE, // G minor
  0: C_SHAPE, // C minor
  11: { rh: [1, 2, 3, 1, 2, 3, 4, 5], lh: [4, 3, 2, 1, 4, 3, 2, 1] }, // B minor
  5: { rh: [1, 2, 3, 4, 1, 2, 3, 4], lh: [5, 4, 3, 2, 1, 3, 2, 1] }, // F minor
}

/** Standard fingering for one octave, or null when we don't have a trusted one. */
export function scaleFingering(tonic: Note, type: ScaleType): Fingering | null {
  const pc = pcOf(tonic)
  if (type.id === 'major') return MAJOR_FINGERING[pc] ?? null
  if (type.id === 'minor' || type.id === 'harmonic-minor') return MINOR_FINGERING[pc] ?? null
  return null
}

/** MIDI numbers for a scale, handy for exercises. */
export function scaleMidis(tonic: Note, type: ScaleType, octaves = 1): number[] {
  return scaleNotes(tonic, type, octaves).map(midiOf)
}
