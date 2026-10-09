/**
 * Exact fractions for musical time, in quarter notes. Floats won't do: triplets give thirds, and a score
 * can change its divisions mid-piece. Denominators stay small, so plain numbers are safe.
 */
export interface Frac {
  readonly n: number
  readonly d: number
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

export function frac(n: number, d = 1): Frac {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw new RangeError(`Bad fraction ${n}/${d}`)
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d) || 1
  return { n: n / g + 0, d: d / g }
}

export const ZERO = frac(0)

export const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d)
export const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
export const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d)
export const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n)
/** Negative, zero or positive, like a sort comparator. */
export const cmp = (a: Frac, b: Frac) => a.n * b.d - b.n * a.d
export const eq = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d
export const lt = (a: Frac, b: Frac) => cmp(a, b) < 0
export const gt = (a: Frac, b: Frac) => cmp(a, b) > 0
export const ge = (a: Frac, b: Frac) => cmp(a, b) >= 0
export const fmax = (a: Frac, b: Frac) => (lt(a, b) ? b : a)
export const toNum = (a: Frac) => a.n / a.d

/** "480" or "12.5" → an exact fraction (MusicXML durations are decimals). Null if it isn't a number. */
export function parseDecimal(s: string | null | undefined): Frac | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec((s ?? '').trim())
  if (!m || (!m[2] && !m[3])) return null
  // More than six decimal places is noise; keep the numbers small.
  const decimals = (m[3] ?? '').slice(0, 6)
  const n = Number((m[2] || '0') + decimals)
  return frac(m[1] === '-' ? -n : n, 10 ** decimals.length)
}
