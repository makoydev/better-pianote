import type { Song } from '../../content/songs'

/**
 * What bars are called on screen: the pickup, then bar 1, 2 … counted from the first full bar. Imported scores use
 * the numbers printed on them, so with repeats written out the 30th bar can be "bar 14 (2nd time)", as on paper.
 */

/** "1st", "2nd", "3rd", "4th" … "11th", "21st". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}

const printed = (song: Song, i: number) => (song.barNumbers?.length === song.rh.length ? song.barNumbers[i] : undefined)

/** Bar i's number as printed (or counted), with which time through it is (1 unless repeats are written out); null for the pickup. */
export function barNumber(song: Song, i: number): { number: string; pass: number } | null {
  if (i === 0 && song.pickup) return null
  return printed(song, i) ?? { number: String(song.pickup ? i : i + 1), pass: 1 }
}

const again = (pass: number) => (pass > 1 ? ` (${ordinal(pass)} time)` : '')

/** On its own: "Pickup", "14", "14 (2nd time)". */
export function barLabel(song: Song, i: number): string {
  const b = barNumber(song, i)
  return b ? b.number + again(b.pass) : 'Pickup'
}

/** In a sentence: "the pickup", "bar 14", "bar 14 (2nd time)". */
export function barName(song: Song, i: number): string {
  const b = barNumber(song, i)
  return b ? `bar ${b.number}${again(b.pass)}` : 'the pickup'
}

/** A stretch of bars in a sentence: "bar 12", "bars 12–15", "the pickup to bar 2". */
export function barsName(song: Song, from: number, to: number): string {
  if (from === to) return barName(song, from)
  if (!barNumber(song, from)) return `the pickup to ${barName(song, to)}`
  return `bars ${barLabel(song, from)}–${barLabel(song, to)}`
}

/** Starting a line: "Pickup", "Bar 14 (2nd time)". */
export function barTitle(song: Song, i: number): string {
  const b = barNumber(song, i)
  return b ? `Bar ${b.number}${again(b.pass)}` : 'Pickup'
}

/** Bars are named by their plain count (1, 2, 3 …), so "Bar 3 of 16" makes sense. */
export function countedStraight(song: Song): boolean {
  return song.rh.every((_, i) => {
    const b = barNumber(song, i)
    return !b || (b.pass === 1 && b.number === String(song.pickup ? i : i + 1))
  })
}

/** Bar i as one number for "Continue from bar N" (as printed when it is a number; the pickup counts as bar 1). */
export function shownBar(song: Song, i: number): number {
  const b = barNumber(song, i)
  if (!b) return 1
  const n = Number(b.number)
  return Number.isInteger(n) && n >= 1 ? n : song.pickup ? Math.max(1, i) : i + 1
}
