import {
  CHORD_TYPE,
  type Chord,
  type ChordType,
  chordLongName,
  chordPcs,
  chordSymbol,
  chordTones,
  mod,
  parseChord,
  pcOf,
  spellRoot,
} from '../../../lib/theory'

/** Chord Trainer levels and the rules for "did you play this chord?". */

export interface TrainerLevel {
  id: string
  name: string
  description: string
  pool: () => Chord[]
}

const PCS = Array.from({ length: 12 }, (_, i) => i)
const on = (type: ChordType, pcs: number[]): Chord[] => pcs.map((pc) => ({ root: spellRoot(pc, type), type }))

/** Slash chords for the white-key triads: C/E, C/G, Dm/F … (3rd or 5th in the bass). */
function inversions(): Chord[] {
  return ['C', 'Dm', 'Em', 'F', 'G', 'Am'].map(parseChord).flatMap((c) => {
    const tones = chordTones(c.root, c.type)
    return [
      { ...c, bass: tones[1] },
      { ...c, bass: tones[2] },
    ]
  })
}

export const TRAINER_LEVELS: TrainerLevel[] = [
  {
    id: 'white',
    name: 'White-key triads',
    description: 'C, Dm, Em, F, G, Am: the chords of C major.',
    pool: () => ['C', 'Dm', 'Em', 'F', 'G', 'Am'].map(parseChord),
  },
  { id: 'major', name: 'All major chords', description: 'Every major triad, black-key roots too.', pool: () => on(CHORD_TYPE.maj, PCS) },
  { id: 'minor', name: 'All minor chords', description: 'Every minor triad: lower the 3rd.', pool: () => on(CHORD_TYPE.min, PCS) },
  {
    id: 'mixed',
    name: 'Major + minor mix',
    description: 'Read the symbol carefully: is there an “m”?',
    pool: () => [...on(CHORD_TYPE.maj, PCS), ...on(CHORD_TYPE.min, PCS)],
  },
  {
    id: 'colour',
    name: 'Dim, aug & sus',
    description: 'Diminished, augmented, sus2 and sus4 colours.',
    pool: () => [
      ...on(CHORD_TYPE.dim, [11, 1, 6, 8, 2, 4]),
      ...on(CHORD_TYPE.aug, [0, 5, 7, 2]),
      ...on(CHORD_TYPE.sus2, [0, 2, 7, 9, 5]),
      ...on(CHORD_TYPE.sus4, [0, 2, 7, 9, 4]),
    ],
  },
  {
    id: 'sevenths',
    name: '7th chords',
    description: 'Dominant 7, major 7 and minor 7: four notes each.',
    pool: () => [
      ...on(CHORD_TYPE['7'], [0, 2, 4, 5, 7, 9, 10]),
      ...on(CHORD_TYPE.maj7, [0, 2, 5, 7, 3, 10]),
      ...on(CHORD_TYPE.m7, [2, 4, 9, 11, 7, 0]),
    ],
  },
  {
    id: 'inversions',
    name: 'Inversions',
    description: 'Slash chords like C/E: the note after the slash must be lowest.',
    pool: inversions,
  },
]

export type MatchState = 'empty' | 'partial' | 'wrong' | 'bass' | 'correct'

/**
 * Compare played MIDI notes with a chord. Octaves and doublings don't matter;
 * for slash chords the lowest played note must be the bass note.
 */
export function matchChord(midis: number[], chord: Chord): MatchState {
  if (midis.length === 0) return 'empty'
  const target = new Set(chordPcs(chord))
  const played = new Set(midis.map((m) => mod(m, 12)))
  for (const p of played) if (!target.has(p)) return 'wrong'
  if (played.size < target.size) return 'partial'
  if (chord.bass) {
    const lowest = Math.min(...midis)
    if (mod(lowest, 12) !== pcOf(chord.bass)) return 'bass'
  }
  return 'correct'
}

/** "Root + 4 + 3 half steps" style recipe. */
export function chordRecipe(type: ChordType): string {
  const semis = type.ivs.map((iv) => iv.semis % 12).sort((a, b) => a - b)
  const steps = semis.slice(1).map((s, i) => s - semis[i])
  return `Root + ${steps.join(' + ')} half steps`
}

export function chordLabel(c: Chord) {
  return { symbol: chordSymbol(c), name: chordLongName(c) }
}

/** A round of chords from a pool, never the same chord twice in a row. */
export function pickRound(pool: Chord[], n: number, rng: () => number = Math.random): Chord[] {
  const out: Chord[] = []
  let bag: Chord[] = []
  while (out.length < n) {
    if (bag.length === 0) bag = shuffle([...pool], rng)
    const next = bag.pop()!
    if (out.length && chordSymbol(out[out.length - 1]) === chordSymbol(next) && pool.length > 1) {
      bag.unshift(next)
      continue
    }
    out.push(next)
  }
  return out
}

export function shuffle<T>(xs: T[], rng: () => number = Math.random): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}

/** Which inversion a slash chord is (1 = 3rd in bass, 2 = 5th in bass), for drawing it. */
export function inversionIndex(c: Chord): number {
  if (!c.bass) return 0
  const tones = chordTones(c.root, c.type)
  const i = tones.findIndex((t) => pcOf(t) === pcOf(c.bass!))
  return Math.max(0, i)
}
