import type { Duration } from '../../components/staff/layout'
import { type Frac, eq, frac, ge, mul, sub } from './frac'

/** How a note or rest is written: a value, its dots, and an optional tuplet ratio. */
export interface Notated {
  dur: Duration
  dots: number
  tuplet?: { actual: number; normal: number }
}

/** MusicXML <type> names the app can draw. */
export const TYPE_DUR: Record<string, Duration> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
  '64th': '64',
}
/** Written values longer than a whole note: split into tied wholes. */
export const LONG_TYPES: Record<string, Frac> = { breve: frac(8), long: frac(16), maxima: frac(32) }
/** Values the app can't draw at all. */
export const TOO_SHORT_TYPES = new Set(['128th', '256th', '512th', '1024th'])

const BASE: [Duration, Frac][] = [
  ['w', frac(4)],
  ['h', frac(2)],
  ['q', frac(1)],
  ['8', frac(1, 2)],
  ['16', frac(1, 4)],
  ['32', frac(1, 8)],
  ['64', frac(1, 16)],
]
const BASE_LEN = Object.fromEntries(BASE) as Record<Duration, Frac>

/** Written length of a value in quarter notes: a dot adds half, a second dot another quarter. */
export function writtenLength(dur: Duration, dots: number): Frac {
  const b = BASE_LEN[dur]
  return frac(b.n * (2 ** (dots + 1) - 1), b.d * 2 ** dots)
}

/** How long it actually sounds, tuplet included. */
export function soundingLength(x: Notated): Frac {
  const w = writtenLength(x.dur, x.dots)
  return x.tuplet ? mul(w, frac(x.tuplet.normal, x.tuplet.actual)) : w
}

const onGrid = (len: Frac) => (len.n * 16) % len.d === 0
// Every single value (with up to two dots) that lands on the 64th-note grid, longest first.
const SINGLE = BASE.flatMap(([dur]) => [0, 1, 2].map((dots) => ({ dur, dots, len: writtenLength(dur, dots) })))
  .filter((s) => onGrid(s.len))
  .sort((a, b) => b.len.n * a.len.d - a.len.n * b.len.d)

/**
 * Standard values adding up to `len`: one value if one fits exactly (dots allowed), otherwise plain values
 * longest first (the caller ties them). Null if `len` isn't a whole number of 64ths.
 */
export function splitPlain(len: Frac): Notated[] | null {
  if (len.n <= 0 || !onGrid(len)) return null
  const one = SINGLE.find((s) => eq(s.len, len))
  if (one) return [{ dur: one.dur, dots: one.dots }]
  const out: Notated[] = []
  let rest = len
  for (const [dur, b] of BASE) {
    while (ge(rest, b)) {
      out.push({ dur, dots: 0 })
      rest = sub(rest, b)
    }
  }
  return rest.n === 0 ? out : null
}

// Tuplets to try when a length only fits inside one (gaps in a triplet passage, say).
const RATIOS: [number, number][] = [
  [3, 2],
  [5, 4],
  [6, 4],
  [7, 4],
  [7, 8],
  [9, 8],
  [11, 8],
  [13, 8],
  [15, 8],
]

/**
 * Write a length (in quarter notes) as note values. `prefer` is how the score wrote it, used when it
 * matches exactly. Otherwise the length is split into tied pieces, inside the preferred tuplet if there
 * is one, or a common tuplet. As a last resort an exact stand-in keeps the timing right (`exact: false`).
 */
export function notate(len: Frac, prefer?: Notated): { pieces: Notated[]; exact: boolean } {
  if (prefer && eq(soundingLength(prefer), len)) return { pieces: [prefer], exact: true }
  const inTuplet = prefer?.tuplet
  // Inside a tuplet, keep the pieces in the same tuplet so they stay under one bracket.
  const tries: [number, number][] = inTuplet ? [[inTuplet.actual, inTuplet.normal], ...RATIOS] : RATIOS
  const plain = splitPlain(len)
  if (plain && !inTuplet) return { pieces: plain, exact: true }
  for (const [actual, normal] of tries) {
    const scaled = splitPlain(mul(len, frac(actual, normal)))
    if (scaled) return { pieces: scaled.map((p) => ({ ...p, tuplet: { actual, normal } })), exact: true }
  }
  if (plain) return { pieces: plain, exact: true }
  return { pieces: [{ dur: 'q', dots: 0, tuplet: { actual: len.d, normal: len.n } }], exact: false }
}
