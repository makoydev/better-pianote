import { IV } from './interval'
import {
  type Interval,
  type Note,
  FLAT_SPELL,
  SHARP_SPELL,
  midiOf,
  mod,
  pcOf,
  pitchName,
  placeAtMidi,
  transpose,
} from './note'

export interface ChordType {
  id: string
  /** What follows the root in a chord symbol: '' for C, 'm7' for Cm7. */
  suffix: string
  name: string
  ivs: Interval[]
  /** Chord-tone labels, e.g. ['1', '♭3', '5']. */
  degrees: string[]
  /** Lower = more common; used to break ties when naming what you play. */
  rank: number
  /** How it tends to feel, for lessons and the chord explorer. */
  mood: string
}

const t = (
  id: string,
  suffix: string,
  name: string,
  ivs: Interval[],
  degrees: string[],
  rank: number,
  mood: string,
): ChordType => ({ id, suffix, name, ivs, degrees, rank, mood })

export const CHORD_TYPES: ChordType[] = [
  t('maj', '', 'major', [IV.P1, IV.M3, IV.P5], ['1', '3', '5'], 0, 'Bright, happy, settled'),
  t('min', 'm', 'minor', [IV.P1, IV.m3, IV.P5], ['1', '♭3', '5'], 1, 'Sad, soft, reflective'),
  t('7', '7', 'dominant 7th', [IV.P1, IV.M3, IV.P5, IV.m7], ['1', '3', '5', '♭7'], 2, 'Bluesy, wants to move on'),
  t('maj7', 'maj7', 'major 7th', [IV.P1, IV.M3, IV.P5, IV.M7], ['1', '3', '5', '7'], 2, 'Dreamy, warm, jazzy'),
  t('m7', 'm7', 'minor 7th', [IV.P1, IV.m3, IV.P5, IV.m7], ['1', '♭3', '5', '♭7'], 2, 'Mellow, smooth, soulful'),
  t('sus4', 'sus4', 'suspended 4th', [IV.P1, IV.P4, IV.P5], ['1', '4', '5'], 3, 'Open, waiting to resolve'),
  t('sus2', 'sus2', 'suspended 2nd', [IV.P1, IV.M2, IV.P5], ['1', '2', '5'], 4, 'Airy, open, modern'),
  t('add9', 'add9', 'add 9', [IV.P1, IV.M3, IV.P5, IV.M9], ['1', '3', '5', '9'], 3, 'Sparkly, hopeful'),
  t('6', '6', 'major 6th', [IV.P1, IV.M3, IV.P5, IV.M6], ['1', '3', '5', '6'], 4, 'Sweet, vintage'),
  t('dim', 'dim', 'diminished', [IV.P1, IV.m3, IV.d5], ['1', '♭3', '♭5'], 5, 'Tense, spooky'),
  t('aug', 'aug', 'augmented', [IV.P1, IV.M3, IV.A5], ['1', '3', '♯5'], 6, 'Mysterious, unresolved'),
  t('m7b5', 'm7♭5', 'half-diminished 7th', [IV.P1, IV.m3, IV.d5, IV.m7], ['1', '♭3', '♭5', '♭7'], 5, 'Dark, yearning'),
  t('dim7', 'dim7', 'diminished 7th', [IV.P1, IV.m3, IV.d5, IV.d7], ['1', '♭3', '♭5', '𝄫7'], 6, 'Dramatic, suspense'),
  t('m6', 'm6', 'minor 6th', [IV.P1, IV.m3, IV.P5, IV.M6], ['1', '♭3', '5', '6'], 5, 'Noir, bittersweet'),
  t('madd9', 'm(add9)', 'minor add 9', [IV.P1, IV.m3, IV.P5, IV.M9], ['1', '♭3', '5', '9'], 4, 'Wistful, cinematic'),
  t('9', '9', 'dominant 9th', [IV.P1, IV.M3, IV.P5, IV.m7, IV.M9], ['1', '3', '5', '♭7', '9'], 5, 'Funky, rich'),
  t('maj9', 'maj9', 'major 9th', [IV.P1, IV.M3, IV.P5, IV.M7, IV.M9], ['1', '3', '5', '7', '9'], 5, 'Lush, floating'),
  t('m9', 'm9', 'minor 9th', [IV.P1, IV.m3, IV.P5, IV.m7, IV.M9], ['1', '♭3', '5', '♭7', '9'], 5, 'Silky, neo-soul'),
  t('7sus4', '7sus4', 'dominant 7th sus4', [IV.P1, IV.P4, IV.P5, IV.m7], ['1', '4', '5', '♭7'], 6, 'Gospel, floating'),
  t('mMaj7', 'm(maj7)', 'minor-major 7th', [IV.P1, IV.m3, IV.P5, IV.M7], ['1', '♭3', '5', '7'], 8, 'Spy-movie tension'),
  t('5', '5', 'power chord', [IV.P1, IV.P5], ['1', '5'], 7, 'Neutral, rock'),
]

export const CHORD_TYPE: Record<string, ChordType> = Object.fromEntries(CHORD_TYPES.map((c) => [c.id, c]))

export interface Chord {
  root: Note
  type: ChordType
  /** Set for slash chords like C/E. */
  bass?: Note
}

/** Chord tones in root position, starting at the root's octave. */
export function chordTones(root: Note, type: ChordType): Note[] {
  return type.ivs.map((iv) => transpose(root, iv))
}

export function chordPcs(c: Chord): number[] {
  return chordTones(c.root, c.type).map(pcOf)
}

export function chordSymbol(c: Chord): string {
  const base = pitchName(c.root) + c.type.suffix
  return c.bass && pcOf(c.bass) !== pcOf(c.root) ? `${base}/${pitchName(c.bass)}` : base
}

export function chordLongName(c: Chord): string {
  const base = `${pitchName(c.root)} ${c.type.name}`
  return c.bass && pcOf(c.bass) !== pcOf(c.root) ? `${base} over ${pitchName(c.bass)}` : base
}

/** Move the lowest note up an octave `k` times (1st inversion, 2nd inversion …). */
export function invert(notes: Note[], k: number): Note[] {
  const out = [...notes]
  for (let i = 0; i < k; i++) {
    const low = out.shift()
    if (!low) break
    out.push({ ...low, oct: low.oct + 1 })
  }
  return out
}

/** Chord tones laid out from a given octave, optionally inverted. */
export function voicedChord(c: Chord, oct: number, inversion = 0): Note[] {
  const root = { ...c.root, oct }
  // Keep every tone within reach: drop 9ths into the octave for close voicings.
  const tones = chordTones(root, c.type).map((n, i) =>
    c.type.ivs[i].num > 8 ? { ...n, oct: n.oct - 1 } : n,
  )
  const sorted = [...tones].sort((a, b) => midiOf(a) - midiOf(b))
  return invert(sorted, inversion)
}

const ODD_NOTES = new Set(['E1', 'B1', 'F-1', 'C-1']) // E♯, B♯, F♭, C♭

function spellingCost(root: Note, type: ChordType): number {
  return chordTones(root, type).reduce((sum, n) => {
    const odd = ODD_NOTES.has(`${'CDEFGAB'[n.letter]}${n.acc}`) ? 2 : 0
    return sum + Math.abs(n.acc) + (Math.abs(n.acc) > 1 ? 10 : 0) + odd
  }, 0)
}

/** Pick the friendliest spelling of a root, e.g. D♭ major (not C♯) but C♯ minor (not D♭). */
export function spellRoot(pc: number, type: ChordType, prefer?: 'sharp' | 'flat'): Note {
  const sharp = { letter: SHARP_SPELL[pc][0], acc: SHARP_SPELL[pc][1], oct: 4 }
  const flat = { letter: FLAT_SPELL[pc][0], acc: FLAT_SPELL[pc][1], oct: 4 }
  if (sharp.acc === 0) return sharp
  if (prefer) return prefer === 'sharp' ? sharp : flat
  const cs = spellingCost(sharp, type)
  const cf = spellingCost(flat, type)
  if (cs !== cf) return cs < cf ? sharp : flat
  return pc === 1 || pc === 6 ? sharp : flat
}

/** Chords that still read clearly with the 5th left out (pianists drop it all the time). */
const NO5_OK = new Set(['7', 'maj7', 'm7', 'mMaj7', '9', 'maj9', 'm9'])

export interface DetectedChord {
  chord: Chord
  symbol: string
  name: string
  /** 0 = root position, 1 = 3rd in the bass, 2 = 5th in the bass, 3 = 7th in the bass. */
  inversion: number
  /** True when the 5th was left out (common in piano voicings). */
  no5: boolean
  /** The played notes, spelled to match the chord. */
  notes: Note[]
}

/**
 * Name the chord formed by a set of held MIDI notes. Doublings and octaves don't matter,
 * the lowest note decides inversions. Returns null when nothing matches (or under 2 pitch classes).
 */
export function detectChord(midis: number[], prefer?: 'sharp' | 'flat'): DetectedChord | null {
  const sorted = [...new Set(midis)].sort((a, b) => a - b)
  const pcs = [...new Set(sorted.map((m) => mod(m, 12)))]
  if (pcs.length < 2) return null
  const bassPc = mod(sorted[0], 12)
  let best: { root: number; type: ChordType; no5: boolean; score: number } | null = null
  for (const root of pcs) {
    const rel = new Set(pcs.map((p) => mod(p - root, 12)))
    for (const type of CHORD_TYPES) {
      const tpl = new Set(type.ivs.map((iv) => mod(iv.semis, 12)))
      let no5 = false
      if (!setEq(rel, tpl)) {
        if (!NO5_OK.has(type.id)) continue
        tpl.delete(7)
        if (!setEq(rel, tpl)) continue
        no5 = true
      }
      const score = 100 - type.rank * 6 - (no5 ? 9 : 0) + (root === bassPc ? 20 : 0)
      if (!best || score > best.score) best = { root, type, no5, score }
    }
  }
  if (!best) return null
  const root = spellRoot(best.root, best.type, prefer)
  const tones = chordTones(root, best.type)
  const notes = sorted.map((m) => {
    const tone = tones.find((n) => pcOf(n) === mod(m, 12))!
    return placeAtMidi(tone.letter, tone.acc, m)
  })
  const bassTone = tones.find((n) => pcOf(n) === bassPc)!
  const chord: Chord = { root, type: best.type, bass: bassPc === best.root ? undefined : bassTone }
  const bassIndex = tones.findIndex((n) => pcOf(n) === bassPc)
  // The bass tone's chord degree gives the inversion (3rd → 1st, 5th → 2nd, 7th → 3rd).
  // Anything else (a 9th, a sus note) in the bass is just a slash chord: -1.
  const bassNum = best.type.ivs[bassIndex].num
  const inversion = ({ 1: 0, 3: 1, 5: 2, 7: 3 } as Record<number, number>)[bassNum] ?? -1
  return { chord, symbol: chordSymbol(chord), name: chordLongName(chord), inversion, no5: best.no5, notes }
}

function setEq(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

export const INVERSION_NAMES = ['Root position', '1st inversion', '2nd inversion', '3rd inversion']

/** Parse a chord symbol like "F#m7", "Bb", "C/E", "Gsus4". */
export function parseChord(symbol: string): Chord {
  const m = /^([A-G](?:#|b|♯|♭)?)(.*?)(?:\/([A-G](?:#|b|♯|♭)?))?$/.exec(symbol.trim())
  if (!m) throw new Error(`Bad chord symbol: ${symbol}`)
  const rootStr = m[1].replace('♯', '#').replace('♭', 'b')
  const suffix = m[2].replace('♭', 'b').replace('♯', '#')
  const aliases: Record<string, string> = {
    '': 'maj', M: 'maj', maj: 'maj', m: 'min', min: 'min', '-': 'min',
    dim: 'dim', '°': 'dim', o: 'dim', aug: 'aug', '+': 'aug',
    '7': '7', maj7: 'maj7', M7: 'maj7', 'Δ7': 'maj7', m7: 'm7', min7: 'm7', '-7': 'm7',
    m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', dim7: 'dim7', '°7': 'dim7', o7: 'dim7',
    sus4: 'sus4', sus: 'sus4', sus2: 'sus2', add9: 'add9', '6': '6', m6: 'm6',
    madd9: 'madd9', 'm(add9)': 'madd9', '9': '9', maj9: 'maj9', m9: 'm9',
    '7sus4': '7sus4', mMaj7: 'mMaj7', 'm(maj7)': 'mMaj7', '5': '5',
  }
  const id = aliases[suffix]
  if (!id) throw new Error(`Unknown chord quality "${suffix}" in ${symbol}`)
  const parse = (s: string) => {
    const letter = 'CDEFGAB'.indexOf(s[0])
    const acc = s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0
    return { letter, acc, oct: 4 }
  }
  const root = parse(rootStr)
  const bass = m[3] ? parse(m[3].replace('♯', '#').replace('♭', 'b')) : undefined
  return { root, type: CHORD_TYPE[id], bass }
}
