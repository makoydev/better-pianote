import { mod } from '../../lib/theory'

/** Progression Jam: presets, roman-numeral helpers and accompaniment patterns (pure, testable). */

export interface Preset {
  id: string
  name: string
  /** Numerals are read against the major scale of the tonic (Nashville style), so ♭VII etc. are borrowed chords. */
  romans: string[]
  /** Default tonic (major-key spelling). */
  tonic: string
  minor?: boolean
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
    minor: true,
    about: 'Walking down from i to V, like flamenco or “Hit the Road Jack”.',
  },
]

/** Chips for building your own progression. */
export const PALETTE = [
  'I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°',
  'Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7',
  'i', 'iv', 'bIII', 'bVI', 'bVII',
]

/** Numerals with a real flat sign: "bVII" → "♭VII". */
export const romanLabel = (rn: string) => rn.replace(/^b/, '♭').replace(/^#/, '♯')

const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Nashville number for a numeral: vi → 6m, V7 → 57, ♭VII → ♭7, vii° → 7°. */
export function nashville(rn: string): string {
  const m = /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/.exec(rn)
  if (!m) return rn
  const [, acc, num, suffix] = m
  const deg = ROMANS.indexOf(num.toUpperCase()) + 1
  const lower = num !== num.toUpperCase()
  const a = acc === 'b' || acc === '♭' ? '♭' : acc ? '♯' : ''
  const q = suffix.startsWith('°') || suffix.startsWith('ø') ? suffix : lower ? `m${suffix}` : suffix
  return `${a}${deg}${q}`
}

export type PatternId = 'block' | 'fingerstyle' | 'ballad'

export interface Hit {
  /** Eighth-note position inside the chord (0 = the chord's downbeat). */
  tick: number
  notes: number[]
  /** Length in eighth notes. */
  dur: number
  vel: number
}

/**
 * What to play over one chord. `ticks` is the chord's length in eighth notes (8 = one bar of 4/4).
 * `pcs` are the chord tones (root first), `rh` the voiced right hand, `bass` the left-hand root.
 */
export function patternHits(pattern: PatternId, rh: number[], bass: number, pcs: number[], ticks: number): Hit[] {
  const hits: Hit[] = []
  if (pattern === 'block') {
    hits.push({ tick: 0, notes: [bass], dur: ticks, vel: 0.68 })
    for (let t = 0; t < ticks; t += 2) hits.push({ tick: t, notes: rh, dur: 1.7, vel: t === 0 ? 0.66 : t === 4 ? 0.54 : 0.44 })
  } else if (pattern === 'fingerstyle') {
    // Alternating bass like Travis picking, fingers rolling through the chord.
    hits.push({ tick: 0, notes: [bass], dur: 4, vel: 0.66 })
    if (ticks > 4) {
      const fifth = bass + 7 > 55 ? bass - 5 : bass + 7
      hits.push({ tick: 4, notes: [fifth], dur: 4, vel: 0.56 })
    }
    const order = rh.length >= 4 ? [0, 1, 2, 3, 2, 1, 2, 3] : [0, 1, 2, 1, 0, 1, 2, 1]
    for (let t = 0; t < ticks; t++) {
      const n = rh[Math.min(order[t % 8], rh.length - 1)]
      hits.push({ tick: t, notes: [n], dur: 2, vel: t % 2 === 0 ? 0.52 : 0.42 })
    }
  } else {
    // Ballad: the left hand rolls 1–5–8–10, the flowing piano-ballad pattern, under a soft held chord.
    const third = pcs.length > 1 ? mod(pcs[1] - pcs[0], 12) : 7
    const wave = [bass, bass + 7, bass + 12, bass + 12 + third]
    const order = [0, 1, 2, 3, 2, 1, 2, 1]
    hits.push({ tick: 0, notes: rh, dur: ticks, vel: 0.4 })
    for (let t = 0; t < ticks; t++) hits.push({ tick: t, notes: [wave[order[t % 8]]], dur: 3, vel: t === 0 ? 0.6 : 0.46 })
  }
  return hits
}

/** Drum kit for one eighth-note tick of a 4/4 bar: kick on 1 and 3, snare on 2 and 4, hats on every eighth. */
export function drumHits(tickInBar: number): { kick: boolean; snare: boolean; hat: number } {
  const t = mod(tickInBar, 8)
  return { kick: t === 0 || t === 4, snare: t === 2 || t === 6, hat: t % 2 === 0 ? 0.7 : 0.45 }
}
