import { type Chord, CHORD_TYPE, type ChordType, chordTones } from './chord'
import { IV } from './interval'
import { type Note, type Spelling, FLAT_SPELL, SHARP_SPELL, fromMidi, mod, noteName, pcOf, pitchName, placeAtMidi, transpose } from './note'
import { SCALE_TYPE, scaleNotes } from './scale'

export type Mode = 'major' | 'minor'

export interface Key {
  tonic: Note
  mode: Mode
}

const L = (letter: string, acc = 0): Note => ({ letter: 'CDEFGAB'.indexOf(letter), acc, oct: 4 })

/** Major-key tonics indexed by number of fifths: -7 (7 flats) … +7 (7 sharps). */
const MAJOR_BY_FIFTHS: Record<number, Note> = {
  [-7]: L('C', -1), [-6]: L('G', -1), [-5]: L('D', -1), [-4]: L('A', -1), [-3]: L('E', -1), [-2]: L('B', -1), [-1]: L('F'),
  0: L('C'), 1: L('G'), 2: L('D'), 3: L('A'), 4: L('E'), 5: L('B'), 6: L('F', 1), 7: L('C', 1),
}

export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const

/** The 12 keys around the circle of fifths (clockwise from C), as most players spell them. */
export const CIRCLE: { major: Note; minor: Note; fifths: number }[] = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1].map(
  (f) => {
    const major = MAJOR_BY_FIFTHS[f]
    return { major, minor: relativeMinorTonic(major), fifths: f }
  },
)

function relativeMinorTonic(major: Note): Note {
  const n = transpose(major, { num: -3, semis: -3 })
  return { ...n, oct: 4 }
}

export function majorKey(f: number): Key {
  return { tonic: MAJOR_BY_FIFTHS[f], mode: 'major' }
}

/** Number of sharps (+) or flats (−) in the key signature. */
export function keyFifths(k: Key): number {
  const major = k.mode === 'major' ? k.tonic : transpose(k.tonic, IV.m3)
  for (const [f, n] of Object.entries(MAJOR_BY_FIFTHS)) {
    if (n.letter === major.letter && n.acc === major.acc) return Number(f)
  }
  // Theoretical keys (e.g. D♯ major): fall back to the enharmonic count.
  const pc = pcOf(major)
  const f = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].indexOf(pc)
  return f > 6 ? f - 12 : f
}

export function keyName(k: Key): string {
  return `${pitchName(k.tonic)} ${k.mode}`
}

export function keyShort(k: Key): string {
  return pitchName(k.tonic) + (k.mode === 'minor' ? 'm' : '')
}

export function parseKey(s: string): Key {
  const m = /^([A-G])([#b♯♭]?)(m|min|minor)?$/i.exec(s.trim().replace(' major', '').replace(' minor', 'm'))
  if (!m) throw new Error(`Bad key: ${s}`)
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0
  return { tonic: L(m[1].toUpperCase(), acc), mode: m[3] ? 'minor' : 'major' }
}

export function relativeKey(k: Key): Key {
  return k.mode === 'major'
    ? { tonic: relativeMinorTonic(k.tonic), mode: 'minor' }
    : { tonic: { ...transpose(k.tonic, IV.m3), oct: 4 }, mode: 'major' }
}

/** Letters that carry a sharp or flat in this key signature, in signature order. */
export function keySignature(fifths: number): { acc: 1 | -1 | 0; letters: string[] } {
  if (fifths > 0) return { acc: 1, letters: SHARP_ORDER.slice(0, fifths) as unknown as string[] }
  if (fifths < 0) return { acc: -1, letters: FLAT_ORDER.slice(0, -fifths) as unknown as string[] }
  return { acc: 0, letters: [] }
}

/** Where each sharp/flat sits on the staff, per clef (standard engraving positions). */
export const KEYSIG_POSITIONS = {
  treble: { sharp: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], flat: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'] },
  bass: { sharp: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'], flat: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'] },
} as const

export function keyScale(k: Key): Note[] {
  return scaleNotes(k.tonic, SCALE_TYPE[k.mode === 'major' ? 'major' : 'minor']).slice(0, 7)
}

/** Sharps or flats for notes outside the key. */
export function keySpelling(k: Key | null): Spelling {
  if (!k) return 'common'
  const f = keyFifths(k)
  return f > 0 ? 'sharp' : f < 0 ? 'flat' : 'common'
}

/** Spell a MIDI note the way it would be written in this key. */
export function spellInKey(midiNum: number, k: Key | null): Note {
  if (!k) return fromMidi(midiNum)
  const pc = mod(midiNum, 12)
  const inKey = keyScale(k).find((n) => pcOf(n) === pc)
  if (inKey) return placeAtMidi(inKey.letter, inKey.acc, midiNum)
  // In minor keys the raised 7th (leading tone) is spelled as a sharp of the 7th letter.
  if (k.mode === 'minor') {
    const lead = transpose(k.tonic, IV.M7)
    if (pcOf(lead) === pc) return placeAtMidi(lead.letter, lead.acc, midiNum)
  }
  const sp = keySpelling(k)
  const [letter, acc] = (sp === 'flat' ? FLAT_SPELL : SHARP_SPELL)[pc]
  return placeAtMidi(letter, acc, midiNum)
}

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export interface DiatonicChord {
  degree: number
  roman: string
  chord: Chord
}

function qualityFromSemis(third: number, fifth: number, seventh?: number): ChordType {
  if (seventh === undefined) {
    if (third === 4 && fifth === 7) return CHORD_TYPE.maj
    if (third === 3 && fifth === 7) return CHORD_TYPE.min
    if (third === 3 && fifth === 6) return CHORD_TYPE.dim
    return CHORD_TYPE.aug
  }
  if (third === 4 && fifth === 7 && seventh === 11) return CHORD_TYPE.maj7
  if (third === 4 && fifth === 7 && seventh === 10) return CHORD_TYPE['7']
  if (third === 3 && fifth === 7 && seventh === 10) return CHORD_TYPE.m7
  if (third === 3 && fifth === 6 && seventh === 10) return CHORD_TYPE.m7b5
  if (third === 3 && fifth === 6 && seventh === 9) return CHORD_TYPE.dim7
  return CHORD_TYPE.mMaj7
}

export function romanFor(degree: number, type: ChordType): string {
  const upper = ['maj', 'aug', '7', 'maj7', '6', 'sus4', 'sus2', 'add9', '9', 'maj9'].includes(type.id)
  const r = upper ? ROMANS[degree] : ROMANS[degree].toLowerCase()
  const suffix: Record<string, string> = {
    maj: '', min: '', dim: '°', aug: '+', '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7',
    mMaj7: '(maj7)', '6': '6', m6: '6', sus4: 'sus4', sus2: 'sus2', add9: 'add9', madd9: 'add9',
    '9': '9', maj9: 'maj9', m9: '9', '7sus4': '7sus4', '5': '5',
  }
  return r + (suffix[type.id] ?? '')
}

/** The chords built from each note of the key: I ii iii IV V vi vii° in major. */
export function diatonicChords(k: Key, sevenths = false): DiatonicChord[] {
  const scale = keyScale(k)
  const two = [...scale, ...scale.map((n) => ({ ...n, oct: n.oct + 1 })), ...scale.map((n) => ({ ...n, oct: n.oct + 2 }))]
  return scale.map((root, degree) => {
    const pcs = [0, 2, 4, 6].map((o) => two[degree + o])
    const semis = pcs.map((n) => mod(pcOf(n) - pcOf(root), 12))
    const type = qualityFromSemis(semis[1], semis[2], sevenths ? semis[3] : undefined)
    return { degree, roman: romanFor(degree, type), chord: { root, type } }
  })
}

/**
 * Turn a roman numeral into a chord in the key: "vi", "IV", "V7", "ii7", "bVII", "vii°", "Imaj7", "V/3".
 * Case decides major/minor; degrees count from the key's own scale (natural minor in minor keys).
 */
export function romanToChord(rn: string, k: Key): Chord {
  const m = /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°7|ø7|°|ø|\+|maj7|7sus4|7|6|sus4|sus2|add9|9)?(?:\/(\d))?$/.exec(rn.trim())
  if (!m) throw new Error(`Bad roman numeral: ${rn}`)
  const [, accStr, numeral, suffix = '', inv] = m
  const degree = ROMANS.indexOf(numeral.toUpperCase())
  const upper = numeral === numeral.toUpperCase()
  let root = keyScale(k)[degree]
  if (accStr) root = { ...root, acc: root.acc + (accStr === 'b' || accStr === '♭' ? -1 : 1) }
  let id: string
  if (upper) {
    id = ({ '': 'maj', '+': 'aug', '7': '7', maj7: 'maj7', '6': '6', sus4: 'sus4', sus2: 'sus2', add9: 'add9', '9': '9', '7sus4': '7sus4' } as Record<string, string>)[suffix] ?? 'maj'
  } else {
    id = ({ '': 'min', '°': 'dim', 'ø': 'm7b5', 'ø7': 'm7b5', '°7': 'dim7', '7': 'm7', '6': 'm6', add9: 'madd9', '9': 'm9' } as Record<string, string>)[suffix] ?? 'min'
  }
  const type = CHORD_TYPE[id]
  const chord: Chord = { root: { ...root, oct: 4 }, type }
  // "/3" or "/5" puts that chord tone in the bass (e.g. I/3 = C/E).
  if (inv) {
    const tones = chordTones(chord.root, type)
    const idx = { '3': 1, '5': 2, '7': 3 }[inv]
    if (idx !== undefined && tones[idx]) chord.bass = tones[idx]
  }
  return chord
}

export function keyLabelWithSig(k: Key): string {
  const f = keyFifths(k)
  const sig = f === 0 ? 'no sharps or flats' : `${Math.abs(f)} ${f > 0 ? 'sharp' : 'flat'}${Math.abs(f) > 1 ? 's' : ''}`
  return `${keyName(k)} · ${sig}`
}

export const ALL_MAJOR_KEYS: Key[] = CIRCLE.map((c) => ({ tonic: c.major, mode: 'major' as const }))
export const ALL_MINOR_KEYS: Key[] = CIRCLE.map((c) => ({ tonic: c.minor, mode: 'minor' as const }))

/** "C" "G" … nice labels like "F♯ / G♭" for the enharmonic spots on the circle. */
export function circleLabel(i: number, mode: Mode): string {
  const c = CIRCLE[i]
  const n = mode === 'major' ? c.major : c.minor
  const base = pitchName(n) + (mode === 'minor' ? 'm' : '')
  if (mode === 'major' && c.fifths === 6) return 'F♯/G♭'
  if (mode === 'minor' && c.fifths === 6) return 'D♯m/E♭m'
  return base
}

export const keyId = (k: Key) => noteName(k.tonic, { octave: false, ascii: true }) + (k.mode === 'minor' ? 'm' : '')

/** Roman numeral for any chord in a key, e.g. F♯m in A major → "vi", B♭ in C → "♭VII". */
export function chordToRoman(chord: Chord, k: Key): string {
  const scale = keyScale(k)
  const rootPc = pcOf(chord.root)
  let degree = scale.findIndex((n) => n.letter === chord.root.letter)
  let prefix = ''
  if (degree >= 0) {
    const diff = mod(rootPc - pcOf(scale[degree]) + 6, 12) - 6
    if (diff === -1) prefix = '♭'
    else if (diff === 1) prefix = '♯'
    else if (diff !== 0) degree = -1
  }
  if (degree < 0) {
    // Spelled oddly for this key: fall back to the nearest scale degree by pitch.
    degree = scale.findIndex((n) => pcOf(n) === rootPc)
    if (degree < 0) {
      degree = scale.findIndex((n) => pcOf(n) === mod(rootPc + 1, 12))
      prefix = '♭'
    }
  }
  return prefix + romanFor(degree, chord.type)
}

/**
 * Guess the key from chords you've played. Most chords must fit the key; ties between relative keys
 * (C major vs A minor share chords) are broken by the chords you start and end on, a dominant (V) chord,
 * and a slight preference for major keys, which pop music uses most.
 */
export function guessKey(chords: Chord[]): Key | null {
  if (chords.length < 3) return null
  const minorish = (c: Chord) => ['min', 'm7', 'm6', 'madd9', 'm9', 'mMaj7'].includes(c.type.id)
  let best: { key: Key; score: number } | null = null
  for (const k of [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS]) {
    const triads = diatonicChords(k)
    const tonicPc = pcOf(k.tonic)
    // In minor keys the V chord is usually major (harmonic minor), so accept that too.
    const fits = (c: Chord) => {
      const hit = triads.find((d) => pcOf(d.chord.root) === pcOf(c.root))
      if (!hit) return false
      if (hit.chord.type.id === 'dim') return true
      if (k.mode === 'minor' && hit.degree === 4 && !minorish(c)) return true
      return minorish(c) === (hit.chord.type.id === 'min')
    }
    const hits = chords.filter(fits).length
    if (hits / chords.length < 0.75) continue
    let score = hits
    if (chords.some((c) => pcOf(c.root) === tonicPc && fits(c))) score += 0.5
    if (pcOf(chords[0].root) === tonicPc) score += 0.4
    if (pcOf(chords[chords.length - 1].root) === tonicPc) score += 0.6
    const fifth = mod(tonicPc + 7, 12)
    if (chords.some((c) => pcOf(c.root) === fifth && !minorish(c))) score += 0.3
    if (k.mode === 'major') score += 0.3
    if (!best || score > best.score) best = { key: k, score }
  }
  return best?.key ?? null
}
