import { CHORD_TYPE, CIRCLE, type Chord, type Key, type Mode, type Note, chordTones, keyId, keyScale, mod, pcOf } from '../../lib/theory'
import { go } from '../../router'
import { getPref, setPref } from '../../state/prefs'
import { PRESETS, isMinorProgression, isProgression } from './jam'

/**
 * Open one tool on something from another: set the choices the tool remembers (its prefs), then go there.
 * Pure helpers first, then the openers.
 */

/** Where a key sits on the circle of fifths, by sound (G♭ major is F♯ major's spot). */
export function circleIndex(key: Key): number {
  const pc = pcOf(key.tonic)
  return CIRCLE.findIndex((c) => pcOf(key.mode === 'major' ? c.major : c.minor) === pc)
}

/** The circle's own spelling of a key (the one Free Play's key list uses). */
export function circleKey(key: Key): Key {
  const c = CIRCLE[circleIndex(key)]
  return { tonic: key.mode === 'major' ? c.major : c.minor, mode: key.mode }
}

const JAM_CUSTOM = 'custom'
const JAM_PRESETS = [...PRESETS.map((p) => p.id), JAM_CUSTOM]

/**
 * The Jam's progression for jamming in a key of this mode: what it plays now if that's already major or minor to
 * match, otherwise the pop anthem (major) or the Andalusian cadence (minor). The Jam takes its mode from the chords.
 */
export function jamPresetFor(mode: Mode, current: { preset: string; romans: unknown }): string {
  const preset = PRESETS.find((p) => p.id === current.preset)
  const romans = preset ? preset.romans : current.preset === JAM_CUSTOM && isProgression(current.romans) ? current.romans : []
  if (romans.length && isMinorProgression(romans) === (mode === 'minor')) return current.preset
  return mode === 'minor' ? 'andalusian' : 'pop'
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
// Chords the Jam can't write as numerals become the nearest one it can.
const JAM_TYPE: Record<string, string> = { '5': 'maj', mMaj7: 'min', maj9: 'maj7' }
const UPPER: Record<string, string> = { maj: '', aug: '+', '7': '7', maj7: 'maj7', '6': '6', sus4: 'sus4', sus2: 'sus2', add9: 'add9', '9': '9', '7sus4': '7sus4' }
const LOWER: Record<string, string> = { min: '', dim: '°', m7b5: 'ø7', dim7: '°7', m7: '7', m6: '6', madd9: 'add9', m9: '9' }

/**
 * A chord as a Jam numeral on `tonic`. The Jam counts up the tonic's major scale (Nashville style), so in A minor
 * F is ♭VI ("bVI"). A 3rd, 5th or 7th in the bass becomes "/3", "/5" or "/7".
 */
export function jamNumeral(chord: Chord, tonic: Note): string {
  const type = CHORD_TYPE[JAM_TYPE[chord.type.id] ?? chord.type.id]
  const scale = keyScale({ tonic, mode: 'major' })
  const rootPc = pcOf(chord.root)
  let degree = mod(chord.root.letter - tonic.letter, 7)
  let diff = mod(rootPc - pcOf(scale[degree]) + 6, 12) - 6
  if (Math.abs(diff) > 1) {
    // Spelled oddly for this key: go by sound (every note is on the scale or a half step below one).
    degree = scale.findIndex((n) => pcOf(n) === rootPc)
    diff = 0
    if (degree < 0) {
      degree = scale.findIndex((n) => pcOf(n) === mod(rootPc + 1, 12))
      diff = -1
    }
  }
  const acc = diff < 0 ? 'b' : diff > 0 ? '#' : ''
  const rn = type.id in UPPER ? ROMAN[degree] + UPPER[type.id] : ROMAN[degree].toLowerCase() + LOWER[type.id]
  let bass = ''
  if (chord.bass) {
    const i = chordTones(chord.root, type).findIndex((n) => pcOf(n) === pcOf(chord.bass!))
    const label = ({ 1: '3', 2: '5', 3: '7' } as Record<number, string>)[i]
    if (label && type.degrees[i].endsWith(label)) bass = `/${label}`
  }
  return acc + rn + bass
}

/** Practise the key's scale (major, or natural minor) in the Scale Explorer. */
export function openScale(key: Key) {
  setPref('scale:tonic', pcOf(key.tonic))
  setPref('scale:type', key.mode === 'major' ? 'major' : 'minor')
  go('/explore/scales')
}

/** Jam in the key, keeping the Jam's progression if it fits the mode. */
export function openJamInKey(key: Key) {
  const preset = getPref('jam:preset', 'river', JAM_PRESETS)
  const romans = getPref<unknown>('jam:romans', [])
  setPref('jam:preset', jamPresetFor(key.mode, { preset, romans }))
  setPref('jam:tonic', pcOf(key.tonic))
  go('/explore/progressions')
}

/** Loop chords in the Jam as your own progression (up to 16, the Jam's limit) in the key. */
export function openJamWith(chords: Chord[], key: Key) {
  setPref('jam:preset', JAM_CUSTOM)
  setPref(
    'jam:romans',
    chords.slice(0, 16).map((c) => jamNumeral(c, key.tonic)),
  )
  setPref('jam:tonic', pcOf(key.tonic))
  go('/explore/progressions')
}

/** Free Play with the key locked. */
export function openFreePlay(key: Key) {
  setPref('free-play:key', keyId(circleKey(key)))
  go('/play')
}

/** The key on the circle of fifths. */
export function openCircle(key: Key) {
  setPref('circle:index', circleIndex(key))
  setPref('circle:mode', key.mode)
  go('/explore/circle')
}

/** A chord in the Chord Explorer, in the inversion you played (shown in the right hand, where inversions live). */
export function openChord(chord: Chord, inversion = 0) {
  setPref('chord:root', pcOf(chord.root))
  setPref('chord:type', chord.type.id)
  setPref('chord:inversion', Math.max(0, Math.min(3, inversion)))
  if (inversion > 0) setPref('chord:hands', 'rh')
  go('/explore/chords')
}
