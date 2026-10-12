import { type Chord, type Note, chordSymbol, mod, parseChord, pcOf } from '../../lib/theory'
import { GUITAR_SHAPES, TUNING } from './chordTools'

/** A chord shape on the guitar (standard tuning). */
export interface GuitarVoicing {
  /** Six strings, low E first: the fret, 0 = open, null = not played. */
  frets: (number | null)[]
  /** One finger laid across several strings at one fret (string 6 = low E). */
  barre?: { fret: number; from: number; to: number }
  /** A hand-picked open chord, or the movable shape with its root on the low E string or the A string. */
  form: 'open' | 'E' | 'A'
  /** The fret the movable shape sits at (0 for open chords). */
  fret: number
  /** The open shape this becomes with a capo instead of the barre: F♯m (E shape, fret 2) = Em shape, capo 2. */
  capo?: { shape: string; fret: number }
}

type Template = { offsets: (number | null)[]; barre?: boolean }

/**
 * Movable shapes, as frets relative to the root's fret: on the low E string (E shapes, like a barred F) or on the
 * A string (A shapes, like a barred B♭). `barre` lays the first finger across from the root's string to the top.
 */
const E_SHAPES: Record<string, Template> = {
  maj: { offsets: [0, 2, 2, 1, 0, 0], barre: true },
  min: { offsets: [0, 2, 2, 0, 0, 0], barre: true },
  '7': { offsets: [0, 2, 0, 1, 0, 0], barre: true },
  m7: { offsets: [0, 2, 0, 0, 0, 0], barre: true },
  maj7: { offsets: [0, null, 1, 1, 0, null] },
  sus4: { offsets: [0, 2, 2, 2, 0, 0], barre: true },
  '7sus4': { offsets: [0, 2, 0, 2, 0, 0], barre: true },
  '5': { offsets: [0, 2, 2, null, null, null] },
  '6': { offsets: [0, null, -1, 1, 0, null] },
  m6: { offsets: [0, null, -1, 0, 0, null] },
  m7b5: { offsets: [0, null, 0, 0, -1, null] },
  dim7: { offsets: [0, null, -1, 0, -1, null] },
  dim: { offsets: [0, 1, 2, 0, null, null] },
  aug: { offsets: [0, null, 2, 1, 1, null] },
  maj9: { offsets: [0, null, 1, 1, null, 2] },
  mMaj7: { offsets: [0, null, 1, 0, 0, null] },
}

const A_SHAPES: Record<string, Template> = {
  maj: { offsets: [null, 0, 2, 2, 2, 0], barre: true },
  min: { offsets: [null, 0, 2, 2, 1, 0], barre: true },
  '7': { offsets: [null, 0, 2, 0, 2, 0], barre: true },
  m7: { offsets: [null, 0, 2, 0, 1, 0], barre: true },
  maj7: { offsets: [null, 0, 2, 1, 2, 0], barre: true },
  sus2: { offsets: [null, 0, 2, 2, 0, 0], barre: true },
  sus4: { offsets: [null, 0, 2, 2, 3, 0], barre: true },
  '7sus4': { offsets: [null, 0, 2, 0, 3, 0], barre: true },
  '5': { offsets: [null, 0, 2, 2, null, null] },
  '6': { offsets: [null, 0, 2, 2, 2, 2], barre: true },
  m7b5: { offsets: [null, 0, 1, 0, 1, null] },
  dim7: { offsets: [null, 0, 1, -1, 1, null] },
  dim: { offsets: [null, 0, 1, 2, 1, null] },
  aug: { offsets: [null, 0, 3, 2, 2, null] },
  add9: { offsets: [null, 0, -1, -3, 0, null] },
  madd9: { offsets: [null, 0, -2, -3, 0, null] },
  '9': { offsets: [null, 0, -1, 0, 0, 0] },
  maj9: { offsets: [null, 0, -1, 1, 0, null] },
  m9: { offsets: [null, 0, -2, 0, 0, null] },
  mMaj7: { offsets: [null, 0, 2, 1, 1, 0], barre: true },
}

/** Highest fret a generated shape may use. */
const MAX_FRET = 15

const OPEN_ROOT: Record<'E' | 'A', Note> = { E: { letter: 2, acc: 0, oct: 4 }, A: { letter: 5, acc: 0, oct: 4 } }

/** "x24432" style text (frets over 9 in brackets), for labels and keys. */
export function fretText(frets: (number | null)[]): string {
  return frets.map((f) => (f === null ? 'x' : f > 9 ? `(${f})` : String(f))).join('')
}

/** MIDI notes a voicing sounds, low string first. */
export function voicingMidis(frets: (number | null)[]): number[] {
  return frets.flatMap((f, i) => (f === null ? [] : [TUNING[i] + f]))
}

const sound = (c: Chord) => `${pcOf(c.root)}:${c.type.id}`

/** The hand-picked open chords (the barred ones, F, B♭ and Bm, come out of the movable shapes). */
const OPEN_SHAPES = Object.entries(GUITAR_SHAPES)
  .filter(([, shape]) => !shape.barre)
  .map(([symbol, shape]) => ({
    symbol,
    chord: parseChord(symbol),
    voicing: { frets: [...shape.frets].map((f) => (f === 'x' ? null : Number(f))), form: 'open', fret: 0 } as GuitarVoicing,
  }))

function movable(chord: Chord, form: 'E' | 'A'): GuitarVoicing | null {
  const t = (form === 'E' ? E_SHAPES : A_SHAPES)[chord.type.id]
  if (!t) return null
  const open = pcOf(OPEN_ROOT[form])
  // Shapes that reach below the root's fret can't sit at the nut: take them an octave up.
  let fret = mod(pcOf(chord.root) - open, 12)
  if (t.offsets.some((o) => o !== null && fret + o < 0)) fret += 12
  const frets = t.offsets.map((o) => (o === null ? null : fret + o))
  if (frets.some((f) => f !== null && f > MAX_FRET)) return null
  const v: GuitarVoicing = { frets, form, fret }
  if (t.barre && fret > 0) v.barre = { fret, from: form === 'E' ? 6 : 5, to: 1 }
  if (fret > 0 && t.offsets.every((o) => o === null || o >= 0)) v.capo = { shape: chordSymbol({ root: OPEN_ROOT[form], type: chord.type }), fret }
  return v
}

/**
 * Ways to play a chord on the guitar: its open chord (if there's a common one), then the movable E and A shapes,
 * lowest on the neck first. Every chord type has at least one. Slash chords use the plain chord's shapes.
 */
export function guitarVoicings(chord: Chord): GuitarVoicing[] {
  const key = sound(chord)
  const open = OPEN_SHAPES.filter((s) => sound(s.chord) === key).map((s) => s.voicing)
  const moving = (['E', 'A'] as const)
    .map((form) => movable(chord, form))
    .filter((v): v is GuitarVoicing => v !== null)
    .sort((a, b) => a.fret - b.fret)
  const out: GuitarVoicing[] = []
  for (const v of [...open, ...moving]) {
    if (!out.some((o) => fretText(o.frets) === fretText(v.frets))) out.push(v)
  }
  return out
}

/** Open chord shapes that make this chord with a capo, lowest capo first: B = A shape capo 2, G shape capo 4 … */
export function capoShapes(chord: Chord, maxCapo = 7): { shape: string; fret: number }[] {
  return OPEN_SHAPES.filter((s) => s.chord.type.id === chord.type.id)
    .map((s) => ({ shape: s.symbol, fret: mod(pcOf(chord.root) - pcOf(s.chord.root), 12) }))
    .filter((c) => c.fret >= 1 && c.fret <= maxCapo)
    .sort((a, b) => a.fret - b.fret)
}

/** Short name for a voicing: "Open", "E shape · 2fr", "A shape". */
export function voicingName(v: GuitarVoicing): string {
  if (v.form === 'open') return 'Open'
  return `${v.form} shape${v.fret > 0 ? ` · ${v.fret}fr` : ''}`
}
