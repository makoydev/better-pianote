import { type Chord, FLAT_SPELL, type Key, type Note, SHARP_SPELL, chordTones, midiOf, mod, parseNote, pcOf, placeAtMidi, romanToChord, spellRoot } from '../../lib/theory'

/** Progression Jam: presets, roman-numeral helpers and accompaniment patterns (pure, testable). */

export interface Preset {
  id: string
  name: string
  /** Numerals are read against the major scale of the tonic (Nashville style), so ♭VII etc. are borrowed chords. */
  romans: string[]
  /** Default key (only its pitch class counts: the spelling follows the mode, see jamTonic). */
  tonic: string
  about: string
}

export const PRESETS: Preset[] = [
  {
    id: 'pop',
    name: 'Pop anthem',
    romans: ['I', 'V', 'vi', 'IV'],
    tonic: 'C',
    about: 'The four chords behind countless hits, like “Let It Be” and “Someone Like You”.',
  },
  {
    id: 'river',
    name: 'River Flows in You',
    romans: ['vi', 'IV', 'I', 'V'],
    tonic: 'A',
    about: 'The progression behind Yiruma’s River Flows in You: F♯m – D – A – E in A major. The pop anthem’s chords, starting on vi so it feels wistful.',
  },
  {
    id: 'doowop',
    name: '50s doo-wop',
    romans: ['I', 'vi', 'IV', 'V'],
    tonic: 'C',
    about: '“Stand By Me” and a thousand slow dances.',
  },
  {
    id: 'jazz',
    name: 'Jazz ii–V–I',
    romans: ['ii7', 'V7', 'Imaj7', 'Imaj7'],
    tonic: 'C',
    about: 'The most important move in jazz: tension (ii7, V7) resolving home (Imaj7).',
  },
  {
    id: 'blues',
    name: '12-bar blues',
    romans: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    tonic: 'A',
    about: 'Three chords, twelve bars, endless solos. The last V7 turns it around to the top.',
  },
  {
    id: 'canon',
    name: 'Pachelbel’s Canon',
    romans: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
    tonic: 'D',
    about: 'The centuries-old chord loop that pop songs keep borrowing.',
  },
  {
    id: 'royal',
    name: 'Royal road',
    romans: ['IV', 'V', 'iii', 'vi'],
    tonic: 'C',
    about: 'J-pop and anime’s favourite: rising, bittersweet, cinematic.',
  },
  {
    id: 'andalusian',
    name: 'Andalusian cadence',
    romans: ['i', 'bVII', 'bVI', 'V'],
    tonic: 'A',
    about: 'Walking down from i to V, like flamenco or “Hit the Road Jack”.',
  },
]

/** Chips for building your own progression. */
export const PALETTE = [
  'I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°',
  'Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7',
  'i', 'iv', 'bIII', 'bVI', 'bVII',
]

/**
 * More chips: the blues' dominant sevenths, sus4s, the I and V with their 3rd in the bass (C/E and G/B in C),
 * and the major II and III, which pull to V and vi.
 */
export const MORE_CHIPS = ['I7', 'IV7', 'Isus4', 'Vsus4', 'I/3', 'V/3', 'II', 'III']

/** Every chip, grouped for the picker. */
export const PALETTE_GROUPS: { title: string; romans: string[] }[] = [
  { title: 'In the key', romans: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] },
  { title: 'Sevenths', romans: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'I7', 'IV7'] },
  { title: 'Sus and slash', romans: ['Isus4', 'Vsus4', 'I/3', 'V/3'] },
  { title: 'Outside the key', romans: ['i', 'iv', 'bIII', 'bVI', 'bVII', 'II', 'III'] },
]

/** The longest progression you can build. */
export const MAX_CHORDS = 16

/** The Jam's tempo range (BPM). */
export const clampJamBpm = (bpm: number) => Math.round(Math.min(160, Math.max(50, bpm)))

/** Numerals with a real flat sign: "bVII" → "♭VII". */
export const romanLabel = (rn: string) => rn.replace(/^b/, '♭').replace(/^#/, '♯')

/**
 * The first home chord decides the mode: i makes it a minor key (like the Andalusian cadence), I or no home
 * chord a major one. Only the first counts, so a minor progression can still end on a major I.
 */
export function isMinorProgression(romans: string[]): boolean {
  for (const rn of romans) {
    const home = /^([Ii])(?![IViv])/.exec(rn)?.[1]
    if (home) return home === 'i'
  }
  return false
}

// Key names by pitch class, as musicians write them: minor keys take C♯ (4 sharps) over D♭ (8 flats).
const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_TONICS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/** The jam's tonic for a pitch class, spelled for a major or a minor key. */
export function jamTonic(pc: number, minor: boolean): Note {
  return parseNote(`${(minor ? MINOR_TONICS : MAJOR_TONICS)[mod(pc, 12)]}4`)
}

/** Names no chord chart uses: double flats and sharps, and F♭ C♭ E♯ B♯. */
function awkward(n: Note): boolean {
  return Math.abs(n.acc) > 1 || (n.acc === -1 && (n.letter === 0 || n.letter === 3)) || (n.acc === 1 && (n.letter === 2 || n.letter === 6))
}

/** The plain name of an awkward note, keeping to its side: C𝄪 → D, E♯ → F, C𝄫 → B♭. */
function plainNote(n: Note): Note {
  const [letter, acc] = (n.acc > 0 ? SHARP_SPELL : FLAT_SPELL)[pcOf(n)]
  return placeAtMidi(letter, acc, midiOf(n))
}

/**
 * A chord with an awkward root, respelled from its simpler enharmonic: B𝄫 → A, C♭ → B, E♯ → F. An awkward
 * slash bass is written plainly too, the way chord charts do: C♯/E♯ → C♯/F, A♯/C𝄪 → A♯/D.
 */
export function plainSpelling(c: Chord): Chord {
  let out = c
  if (awkward(c.root)) {
    const root = { ...spellRoot(pcOf(c.root), c.type, c.root.acc > 0 ? 'sharp' : 'flat'), oct: c.root.oct }
    const bass = c.bass
    out = bass ? { ...c, root, bass: chordTones(root, c.type).find((n) => pcOf(n) === pcOf(bass)) ?? bass } : { ...c, root }
  }
  if (out.bass && awkward(out.bass)) out = { ...out, bass: plainNote(out.bass) }
  return out
}

/**
 * A progression's chords in a key. Numerals count up the tonic's major scale, so borrowed chords can land on
 * awkward roots in flat keys (♭VI of D♭ is B𝄫): those are respelled (A).
 */
export function jamChords(romans: string[], pc: number, minor: boolean): Chord[] {
  const key: Key = { tonic: jamTonic(pc, minor), mode: 'major' }
  return romans.map((rn) => plainSpelling(romanToChord(rn, key)))
}

/** A progression saved on an earlier visit, if every numeral in it can still be read. */
export function isProgression(v: unknown): v is string[] {
  if (!Array.isArray(v)) return false
  return v.every((rn) => {
    if (typeof rn !== 'string') return false
    try {
      romanToChord(rn, { tonic: parseNote('C4'), mode: 'major' })
      return true
    } catch {
      return false
    }
  })
}

/** Edits to a progression (new arrays; out-of-range moves leave it as it was). */
export const replaceAt = (romans: string[], i: number, rn: string) => romans.map((r, k) => (k === i ? rn : r))
export const removeAt = (romans: string[], i: number) => romans.filter((_, k) => k !== i)
export function moveAt(romans: string[], i: number, by: -1 | 1): string[] {
  const j = i + by
  if (i < 0 || i >= romans.length || j < 0 || j >= romans.length) return romans
  const out = [...romans]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export const sameRomans = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((r, i) => r === b[i])

/** Stable keys for a progression's cards ("IV#0", "IV#1" for a repeated chord), so a moved card slides instead of reappearing. */
export function cardKeys(romans: string[]): string[] {
  const seen = new Map<string, number>()
  return romans.map((r) => {
    const n = seen.get(r) ?? 0
    seen.set(r, n + 1)
    return `${r}#${n}`
  })
}

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const accSign = (acc: number) => (acc < 0 ? '♭'.repeat(-acc) : '♯'.repeat(acc))

/**
 * Nashville number for a numeral: vi → 6m, V7 → 57, ♭VII → ♭7, vii° → 7°. A slash numeral names its bass by
 * scale degree, as Nashville charts do: I/3 (C/E) → 1/3, V/3 (G/B) → 5/7.
 */
export function nashville(rn: string): string {
  const m = /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*?)(\/\d)?$/.exec(rn)
  if (!m) return rn
  const [, acc, num, suffix, slash] = m
  const deg = ROMANS.indexOf(num.toUpperCase()) + 1
  const lower = num !== num.toUpperCase()
  const a = acc === 'b' || acc === '♭' ? '♭' : acc ? '♯' : ''
  const q = suffix.startsWith('°') || suffix.startsWith('ø') ? suffix : lower ? `m${suffix}` : suffix
  return `${a}${deg}${q}${slash ? `/${bassDegree(rn) ?? slash.slice(1)}` : ''}`
}

/** The scale degree of a slash numeral's bass, e.g. "7" for V/3 or "♭6" for iv/3 (read in C, where every degree is natural). */
function bassDegree(rn: string): string | null {
  try {
    const bass = romanToChord(rn, { tonic: parseNote('C4'), mode: 'major' }).bass
    return bass ? `${accSign(bass.acc)}${bass.letter + 1}` : null
  } catch {
    return null
  }
}

export type PatternId = 'block' | 'fingerstyle' | 'ballad' | 'waltz' | 'six-eight'

/** The band's feels. Each one has its own metre. */
export const FEELS: { id: PatternId; label: string }[] = [
  { id: 'block', label: 'Strum' },
  { id: 'fingerstyle', label: 'Fingerstyle' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'waltz', label: 'Waltz 3/4' },
  { id: 'six-eight', label: 'Ballad 6/8' },
]
export const FEEL_IDS = FEELS.map((f) => f.id)

export type MeterId = '4/4' | '3/4' | '6/8'

export interface Meter {
  id: MeterId
  /** Eighth-note ticks in a bar. */
  bar: number
  /** Ticks per count: what the beat dots and the count-in follow (quarters; eighths in 6/8, "1 2 3 4 5 6"). */
  count: number
  /** Ticks per beat, the note the tempo counts: a quarter, or a dotted quarter in 6/8. */
  beat: number
}

const METER: Record<MeterId, Meter> = {
  '4/4': { id: '4/4', bar: 8, count: 2, beat: 2 },
  '3/4': { id: '3/4', bar: 6, count: 2, beat: 2 },
  '6/8': { id: '6/8', bar: 6, count: 1, beat: 3 },
}

export const meterOf = (pattern: PatternId): Meter => METER[pattern === 'waltz' ? '3/4' : pattern === 'six-eight' ? '6/8' : '4/4']

/** Counts that start a beat get the accent: the first, and in 6/8 the second dotted quarter too. */
export const accented = (meter: Meter, count: number) => count === 0 || (meter.id === '6/8' && count === 3)

/**
 * How long each chord lasts, as saved in "jam:chord-length": 4 = two beats, 8 = a bar, 16 = two bars (in eighths
 * of a 4/4 bar, the original unit). Half a bar only splits 4/4 into whole beats, so 3/4 and 6/8 offer bars.
 */
export type ChordLength = 4 | 8 | 16
export const CHORD_LENGTHS: ChordLength[] = [4, 8, 16]
export const LENGTH_LABEL: Record<ChordLength, string> = { 4: '2 beats', 8: '1 bar', 16: '2 bars' }
export const lengthsFor = (meter: Meter): ChordLength[] => (meter.id === '4/4' ? CHORD_LENGTHS : [8, 16])

/** A chord's length in ticks (eighth notes) in this metre. */
export function chordTicks(length: ChordLength, meter: Meter): number {
  if (!lengthsFor(meter).includes(length)) return meter.bar
  return (meter.bar * length) / 8
}

export interface Hit {
  /** Eighth-note position inside the chord (0 = the chord's downbeat). */
  tick: number
  notes: number[]
  /** Length in eighth notes. */
  dur: number
  vel: number
  /** The band's left hand (bass) or right hand (chords), so either can sit out while you play it. */
  part: 'bass' | 'chords'
}

/** The lowest chord tone at or above `from` (MIDI). */
function toneAbove(from: number, pcs: number[]): number {
  let m = from
  while (!pcs.includes(mod(m, 12))) m++
  return m
}

/** The highest chord tone at or below `from` (MIDI). */
function toneBelow(from: number, pcs: number[]): number {
  let m = from
  while (!pcs.includes(mod(m, 12))) m--
  return m
}

/**
 * The left hand's "fifth": the chord tone about a fifth above the bass (the real 5th of a root-position chord,
 * ♭5 of a diminished one, the root above a 3rd in the bass), or a 4th-ish below when that would climb too high.
 */
function upperBass(bass: number, pcs: number[]): number {
  const up = toneAbove(bass + 6, pcs)
  return up > 55 ? toneBelow(bass - 4, pcs) : up
}

/**
 * What to play over one chord. `ticks` is the chord's length in eighth notes (8 = one bar of 4/4), played bar by
 * bar in the pattern's metre (a half-bar chord plays the first half). `pcs` are the chord tones (root first), `rh`
 * the voiced right hand, `bass` the left-hand bass note (the root, or the slash note of a slash chord).
 * Left-hand patterns only use chord tones, so C/E or B° never get a stray note.
 */
export function patternHits(pattern: PatternId, rh: number[], bass: number, pcs: number[], ticks: number): Hit[] {
  const { bar } = meterOf(pattern)
  const hits: Hit[] = []
  for (let start = 0, b = 0; start < ticks; start += bar, b++) {
    for (const h of barHits(pattern, rh, bass, pcs, Math.min(bar, ticks - start), b)) hits.push({ ...h, tick: h.tick + start })
  }
  return hits
}

/** One bar (or the first `len` ticks of it); `b` counts the bars of a chord that lasts several. */
function barHits(pattern: PatternId, rh: number[], bass: number, pcs: number[], len: number, b: number): Hit[] {
  const hits: Hit[] = []
  const held = b === 0 ? 0.4 : 0.34
  if (pattern === 'block') {
    hits.push({ tick: 0, notes: [bass], dur: len, vel: 0.68, part: 'bass' })
    for (let t = 0; t < len; t += 2) hits.push({ tick: t, notes: rh, dur: 1.7, vel: t === 0 ? 0.66 : t === 4 ? 0.54 : 0.44, part: 'chords' })
  } else if (pattern === 'fingerstyle') {
    // Alternating bass like Travis picking, fingers rolling through the chord.
    hits.push({ tick: 0, notes: [bass], dur: 4, vel: 0.66, part: 'bass' })
    if (len > 4) hits.push({ tick: 4, notes: [upperBass(bass, pcs)], dur: 4, vel: 0.56, part: 'bass' })
    const order = rh.length >= 4 ? [0, 1, 2, 3, 2, 1, 2, 3] : [0, 1, 2, 1, 0, 1, 2, 1]
    for (let t = 0; t < len; t++) {
      const n = rh[Math.min(order[t % 8], rh.length - 1)]
      hits.push({ tick: t, notes: [n], dur: 2, vel: t % 2 === 0 ? 0.52 : 0.42, part: 'chords' })
    }
  } else if (pattern === 'ballad') {
    // Ballad: the left hand rolls 1–5–8–10, the flowing piano-ballad pattern, under a soft held chord.
    const wave = [bass, toneAbove(bass + 6, pcs), bass + 12, toneAbove(bass + 14, pcs)]
    const order = [0, 1, 2, 3, 2, 1, 2, 1]
    hits.push({ tick: 0, notes: rh, dur: len, vel: held, part: 'chords' })
    for (let t = 0; t < len; t++) hits.push({ tick: t, notes: [wave[order[t % 8]]], dur: 3, vel: t === 0 ? 0.6 : 0.46, part: 'bass' })
  } else if (pattern === 'waltz') {
    // Oom-pah-pah: bass on 1 (root, then the fifth in a chord's second bar), the chord on 2 and 3.
    hits.push({ tick: 0, notes: [b % 2 ? upperBass(bass, pcs) : bass], dur: 2, vel: 0.66, part: 'bass' })
    for (const t of [2, 4]) if (t < len) hits.push({ tick: t, notes: rh, dur: 1.6, vel: t === 2 ? 0.5 : 0.44, part: 'chords' })
  } else {
    // 6/8: the left hand rolls 1–5–8–10–8–5 across the six eighths, under a soft held chord.
    const fifth = toneAbove(bass + 6, pcs)
    const wave = [bass, fifth, bass + 12, toneAbove(bass + 14, pcs), bass + 12, fifth]
    hits.push({ tick: 0, notes: rh, dur: len, vel: held, part: 'chords' })
    for (let t = 0; t < len; t++) hits.push({ tick: t, notes: [wave[t]], dur: 2.5, vel: t === 0 ? 0.6 : t === 3 ? 0.52 : 0.44, part: 'bass' })
  }
  return hits
}

/**
 * Drum kit for one eighth-note tick of a bar. 4/4: kick on 1 and 3, snare on 2 and 4. 3/4: kick on 1, snare on
 * 2 and 3. 6/8: kick on 1, snare on 4. Hats on every eighth, louder on the counts.
 */
export function drumHits(tickInBar: number, meter: MeterId = '4/4'): { kick: boolean; snare: boolean; hat: number } {
  if (meter === '4/4') {
    const t = mod(tickInBar, 8)
    return { kick: t === 0 || t === 4, snare: t === 2 || t === 6, hat: t % 2 === 0 ? 0.7 : 0.45 }
  }
  const t = mod(tickInBar, 6)
  if (meter === '3/4') return { kick: t === 0, snare: t === 2 || t === 4, hat: t % 2 === 0 ? 0.7 : 0.45 }
  return { kick: t === 0, snare: t === 3, hat: t === 0 || t === 3 ? 0.7 : 0.45 }
}
