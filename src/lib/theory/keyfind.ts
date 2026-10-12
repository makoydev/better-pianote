import { type Chord, type ChordType, chordPcs, chordTones, spellRoot } from './chord'
import { IV } from './interval'
import { ALL_MAJOR_KEYS, ALL_MINOR_KEYS, CIRCLE, type Key, type Mode, keyFifths, keyScale, romanFor, romanToChord } from './key'
import { LETTER_SEMIS, type Note, mod, pcOf, transpose } from './note'

/**
 * Finding the key from what you play (melody notes and chords), the chords that tend to come next,
 * and the keys a chord belongs to.
 */

/** Krumhansl–Kessler key profiles: how strongly each note of the octave (tonic first) says "this key". */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export interface PlayedNote {
  midi: number
  /** How much it counts, e.g. how long it sounded in seconds (default 1). */
  weight?: number
}

export interface KeyCandidate {
  key: Key
  score: number
}

const ALL_KEYS = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS]

type Quality = 'major' | 'minor' | 'dim' | 'aug' | 'open'

/** Major, minor, diminished or augmented by its 3rd and 5th; sus and power chords are open (they fit either). */
export function chordQuality(type: ChordType): Quality {
  const semis = new Set(type.ivs.map((iv) => mod(iv.semis, 12)))
  if (semis.has(4)) return semis.has(8) && !semis.has(7) ? 'aug' : 'major'
  if (semis.has(3)) return semis.has(6) && !semis.has(7) ? 'dim' : 'minor'
  return 'open'
}

const MAJOR_DEGREES: Quality[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']
const MINOR_DEGREES: Quality[] = ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major']

/** Scale degree (0–6) of a pitch class in the key, or -1. */
function degreeOf(pc: number, k: Key): number {
  return keyScale(k).findIndex((n) => pcOf(n) === pc)
}

/** A chord that belongs to the key: all its notes in the scale, or a minor key's major V (its 7th note raised). */
function fitsKey(c: Chord, k: Key): boolean {
  const scale = new Set(keyScale(k).map(pcOf))
  if (chordPcs(c).every((p) => scale.has(p))) return true
  return k.mode === 'minor' && raisedSeventhChord(c, k) !== null
}

/** In a minor key, V, V7, vii° and vii°7 use the raised 7th (harmonic minor). Returns the numeral, or null. */
function raisedSeventhChord(c: Chord, k: Key): string | null {
  const t = pcOf(k.tonic)
  const root = pcOf(c.root)
  if (root === mod(t + 7, 12) && (c.type.id === 'maj' || c.type.id === '7')) return c.type.id === '7' ? 'V7' : 'V'
  if (root === mod(t + 11, 12) && (c.type.id === 'dim' || c.type.id === 'dim7')) return c.type.id === 'dim7' ? 'vii°7' : 'vii°'
  return null
}

const isTonicChord = (c: Chord, k: Key) => pcOf(c.root) === pcOf(k.tonic) && chordQuality(c.type) === (k.mode === 'major' ? 'major' : 'minor')
const isDominant = (c: Chord, k: Key) => pcOf(c.root) === mod(pcOf(k.tonic) + 7, 12) && chordQuality(c.type) === 'major'

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length
  const mb = b.reduce((s, x) => s + x, 0) / b.length
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

/** How long each pitch class sounded: the notes you played plus the chords (their roots count a little extra). */
function pitchProfile(notes: PlayedNote[], chords: Chord[]): number[] {
  const h = new Array<number>(12).fill(0)
  for (const n of notes) h[mod(n.midi, 12)] += n.weight ?? 1
  for (const c of chords) {
    for (const p of chordPcs(c)) h[p] += 1
    h[pcOf(c.root)] += 0.5
  }
  return h
}

/**
 * Every key, best fit first. Notes are matched against the Krumhansl–Kessler profiles (Krumhansl–Schmuckler key
 * finding); the last few chords add evidence: chords outside the key count against it, and a home chord (first,
 * last, or anywhere) and a major V count for it. Major keys get a nudge, as pop music lives there most.
 */
export function rankKeys(notes: PlayedNote[], chords: Chord[] = []): KeyCandidate[] {
  const h = pitchProfile(notes, chords)
  const recent = chords.slice(-8)
  return ALL_KEYS.map((key) => {
    const profile = key.mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE
    const t = pcOf(key.tonic)
    let score = correlation(h, profile.map((_, i) => profile[mod(i - t, 12)]))
    if (recent.length) {
      score += 0.35 * (recent.filter((c) => fitsKey(c, key)).length / recent.length - 1)
      if (recent.some((c) => isTonicChord(c, key))) score += 0.05
      if (isTonicChord(recent[0], key)) score += 0.03
      if (isTonicChord(recent[recent.length - 1], key)) score += 0.05
      if (recent.some((c) => isDominant(c, key))) score += 0.04
    }
    if (key.mode === 'major') score += 0.02
    return { key, score }
  }).sort((a, b) => b.score - a.score)
}

const sameKey = (a: Key, b: Key) => a.mode === b.mode && pcOf(a.tonic) === pcOf(b.tonic)

export interface KeyFound {
  key: Key
  /** A close second (often the relative major or minor), or null when the first is clear. */
  alt: Key | null
}

/** Within this the runner-up is worth mentioning ("A major · or F♯ minor"). */
const ALT_MARGIN = 0.15
/** The key on screen only changes when another one fits clearly better, so numerals don't flicker. */
const STAY_MARGIN = 0.08

/**
 * The likely key, once there's enough to go on: five different notes (a phrase of melody, or two chords) or
 * three chords. Pass the key shown before as `prev` to keep it until another key fits clearly better.
 */
export function findKey(notes: PlayedNote[], chords: Chord[] = [], prev: Key | null = null): KeyFound | null {
  const pcs = new Set([...notes.map((n) => mod(n.midi, 12)), ...chords.flatMap(chordPcs)])
  if (pcs.size < 5 && !(chords.length >= 3 && pcs.size >= 4)) return null
  const ranked = rankKeys(notes, chords)
  let best = ranked[0]
  const kept = prev ? ranked.find((c) => sameKey(c.key, prev)) : undefined
  if (kept && kept.score >= best.score - STAY_MARGIN) best = kept
  const second = ranked.find((c) => !sameKey(c.key, best.key))
  const alt = second && second.score >= best.score - ALT_MARGIN ? second.key : null
  return { key: best.key, alt }
}

/**
 * A chord spelled for a key: a root that's a note of the key the way the key writes it (D♯m in B major, not E♭m;
 * G♭ in D♭ major, not F♯), any other root the way the key leans (sharps or flats, or the friendliest spelling in
 * C major and A minor). A spelling that would need double sharps or flats (E♯ major in F♯) falls back to the plain
 * one (F). The bass follows the chord's own letters.
 */
export function spellChordInKey(chord: Chord, key: Key | null): Chord {
  if (!key) return chord
  const pc = pcOf(chord.root)
  const fifths = keyFifths(key)
  const inKey = keyScale(key).find((n) => pcOf(n) === pc)
  const plain = (root: Note) => chordTones(root, chord.type).every((n) => Math.abs(n.acc) < 2)
  const picked = inKey && plain(inKey) ? inKey : spellRoot(pc, chord.type, fifths > 0 ? 'sharp' : fifths < 0 ? 'flat' : undefined)
  if (picked.letter === chord.root.letter && picked.acc === chord.root.acc) return chord
  const root = { ...picked, oct: chord.root.oct }
  const bassPc = chord.bass ? pcOf(chord.bass) : null
  const bass = bassPc === null ? undefined : (chordTones(root, chord.type).find((n) => pcOf(n) === bassPc) ?? chord.bass)
  return { root, type: chord.type, bass }
}

export interface Suggestion {
  chord: Chord
  /** Its roman numeral in the key, e.g. "IV" or "♭VII". */
  roman: string
}

// What usually follows each chord of the key (by scale degree), most common first.
const MAJOR_NEXT: string[][] = [
  ['IV', 'V', 'vi', 'ii'], // I
  ['V', 'IV', 'vi'], // ii
  ['vi', 'IV', 'ii'], // iii
  ['V', 'I', 'ii', 'vi'], // IV
  ['I', 'vi', 'IV'], // V
  ['IV', 'ii', 'V', 'iii'], // vi
  ['I', 'vi', 'iii'], // vii°
]
const MINOR_NEXT: string[][] = [
  ['VI', 'iv', 'VII', 'V'], // i
  ['V', 'i'], // ii°
  ['VI', 'VII', 'iv'], // III
  ['V', 'i', 'VII'], // iv
  ['i', 'VI', 'iv'], // v or V
  ['VII', 'III', 'iv', 'i'], // VI
  ['III', 'i', 'VI'], // VII
]
// Borrowed chords in a major key: ♭VII and ♭VI lead home, iv leads back to I.
const BORROWED_NEXT: Record<string, string[]> = { bVII: ['I', 'IV'], bVI: ['bVII', 'V', 'I'], bIII: ['IV', 'bVI'], iv: ['I', 'V'] }

const label = (rn: string) => rn.replace(/^b/, '♭').replace(/^#/, '♯')

/**
 * Chords to try after `last` in `key`, spelled in the key: after vi → IV, ii, V; after V → I, vi, IV. A chord
 * outside the key that leads somewhere (a dominant a 5th above a chord of the key, a borrowed ♭VII) suggests
 * where it leads first; anything else falls back to the key's main chords.
 */
export function nextChords(last: Chord, key: Key, max = 4): Suggestion[] {
  const major = key.mode === 'major'
  const rootPc = pcOf(last.root)
  const quality = chordQuality(last.type)
  const degree = degreeOf(rootPc, key)
  const expected = degree >= 0 ? (major ? MAJOR_DEGREES : MINOR_DEGREES)[degree] : null
  // A minor key's V is usually major (its 7th note is raised), so it counts as the 5th degree too.
  const fits = expected !== null && (quality === 'open' || quality === expected || (!major && degree === 4 && quality === 'major'))
  let romans: string[] = []
  if (fits) romans = (major ? MAJOR_NEXT : MINOR_NEXT)[degree]
  else {
    // A major or 7th chord a 5th above a chord of the key (E7 in C) usually resolves to it (Am). In a minor key
    // that includes VII (D → G in A minor) and the major V (B7 → E); nothing resolves to a diminished chord.
    const target = degreeOf(mod(rootPc + 5, 12), key)
    const degrees = major ? MAJOR_DEGREES : MINOR_DEGREES
    if ((quality === 'major' || quality === 'open') && target >= 0 && degrees[target] !== 'dim') {
      const rn = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][target]
      romans.push(!major && target === 4 ? 'V' : degrees[target] === 'minor' ? rn.toLowerCase() : rn)
    }
    if (major) {
      const borrowed = Object.keys(BORROWED_NEXT).find((rn) => {
        const c = romanToChord(rn, key)
        return pcOf(c.root) === rootPc && chordQuality(c.type) === quality
      })
      if (borrowed) romans.push(...BORROWED_NEXT[borrowed])
    }
    romans.push(...(major ? ['I', 'IV', 'V', 'vi'] : ['i', 'iv', 'V', 'VI']))
  }
  const out: Suggestion[] = []
  for (const rn of romans) {
    const chord = romanToChord(rn, key)
    const same = pcOf(chord.root) === rootPc && chordQuality(chord.type) === quality
    if (same || out.some((s) => s.roman === label(rn))) continue
    out.push({ chord, roman: label(rn) })
    if (out.length >= max) break
  }
  return out
}

export interface KeyWithChord {
  key: Key
  /** The chord's roman numeral in that key, e.g. "vi". */
  roman: string
  /** Position on the circle of fifths (CIRCLE index). */
  index: number
}

/** Uppercase for major-sounding chords; sus and power chords too (they have no 3rd to make them minor). */
function numeral(degree: number, type: ChordType): string {
  const rn = romanFor(degree, type)
  return chordQuality(type) === 'open' ? rn.replace(/^[ivx]+/, (s) => s.toUpperCase()) : rn
}

/** Every note is in the scale with the same letter and accidental (octaves don't matter). */
const spelledIn = (notes: Note[], scale: Note[]) => notes.every((n) => scale.some((s) => s.letter === n.letter && s.acc === n.acc))

/**
 * The chord's numeral in the key, if its notes as spelled belong to it: B♭m is iii in G♭ major, not in F♯ major
 * (that's A♯m). Minor keys also take V, V7, vii° and vii°7 with the raised 7th (harmonic minor).
 */
function numeralIn(chord: Chord, key: Key): string | null {
  const scale = keyScale(key)
  const tones = chordTones(chord.root, chord.type)
  if (spelledIn(tones, scale)) return numeral(scale.findIndex((n) => n.letter === chord.root.letter), chord.type)
  if (key.mode !== 'minor') return null
  const lead = { ...transpose(key.tonic, IV.M7), oct: 4 }
  const harmonic: [string, Note, string][] = [
    ['V', scale[4], 'maj'],
    ['V7', scale[4], '7'],
    ['vii°', lead, 'dim'],
    ['vii°7', lead, 'dim7'],
  ]
  const hit = harmonic.find(([, root, id]) => id === chord.type.id && root.letter === chord.root.letter && root.acc === chord.root.acc)
  return hit && spelledIn(tones, [...scale.slice(0, 6), lead]) ? hit[0] : null
}

/** The circle's keys at a position, plus the flat twin of its six-sharp keys (G♭ major, E♭ minor). */
function keysAt(index: number, mode: Mode): Key[] {
  const c = CIRCLE[index]
  const tonic = mode === 'major' ? c.major : c.minor
  if (c.fifths !== 6) return [{ tonic, mode }]
  // F♯ → G♭, D♯ → E♭: the next letter up, flattened.
  const letter = (tonic.letter + 1) % 7
  const twin = { letter, acc: mod(pcOf(tonic) - LETTER_SEMIS[letter] + 6, 12) - 6, oct: tonic.oct }
  return [
    { tonic, mode },
    { tonic: twin, mode },
  ]
}

/**
 * The keys a chord belongs to, with its numeral in each: Am → vi in C, ii in G, iii in F, then i in A minor,
 * iv in E minor, v in D minor. Major keys first, then minor keys (up to four each), nearest the chord's own key on
 * the circle first.
 */
export function keysWithChord(chord: Chord, perMode = 4): KeyWithChord[] {
  const rootPc = pcOf(chord.root)
  const minorish = chordQuality(chord.type) === 'minor'
  const anchor = CIRCLE.findIndex((c) => pcOf(minorish ? c.minor : c.major) === rootPc)
  const distance = (i: number) => {
    const d = mod(i - anchor, 12)
    // Sharp side before flat side at the same distance: 0, +1, −1, +2, −2 …
    return d <= 6 ? d * 2 : (12 - d) * 2 + 1
  }
  const order = CIRCLE.map((_, i) => i).sort((a, b) => distance(a) - distance(b))
  const found: KeyWithChord[] = []
  for (const mode of ['major', 'minor'] as const) {
    let n = 0
    for (const index of order) {
      for (const key of keysAt(index, mode)) {
        const roman = numeralIn(chord, key)
        if (!roman) continue
        found.push({ key, index, roman })
        n++
        break
      }
      if (n >= perMode) break
    }
  }
  return found
}
