import type { Duration, StaffItem } from '../../../components/staff/Staff'

/** Rhythm Tap: pattern generation (in beats) and tap scoring (in seconds). */

export interface RNote {
  dur: Duration
  dots: number
  rest: boolean
  /** Beats from the start of the pattern. */
  start: number
  beats: number
}

interface Cell {
  id: string
  notes: [Duration, number, boolean][]
  /** Beats within the bar where this cell may start (default: any beat). */
  starts?: number[]
}

const BEATS: Record<Duration, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125, '64': 0.0625 }
const noteLen = (d: Duration, dots: number) => BEATS[d] * (dots ? 1.5 : 1)
const cellLen = (c: Cell) => c.notes.reduce((s, [d, dots]) => s + noteLen(d, dots), 0)

const CELL = {
  q: { id: 'q', notes: [['q', 0, false]] },
  h: { id: 'h', notes: [['h', 0, false]], starts: [0, 1, 2] },
  w: { id: 'w', notes: [['w', 0, false]], starts: [0] },
  qr: { id: 'qr', notes: [['q', 0, true]] },
  hr: { id: 'hr', notes: [['h', 0, true]], starts: [0, 2] },
  e2: { id: '88', notes: [['8', 0, false], ['8', 0, false]] },
  dq8: { id: 'q.8', notes: [['q', 1, false], ['8', 0, false]], starts: [0, 2] },
  hd: { id: 'h.', notes: [['h', 1, false]], starts: [0, 1] },
  sync: { id: '8q8', notes: [['8', 0, false], ['q', 0, false], ['8', 0, false]], starts: [0, 2] },
  s4: { id: '16x4', notes: [['16', 0, false], ['16', 0, false], ['16', 0, false], ['16', 0, false]] },
  e16: { id: '8-16-16', notes: [['8', 0, false], ['16', 0, false], ['16', 0, false]] },
  s16e: { id: '16-16-8', notes: [['16', 0, false], ['16', 0, false], ['8', 0, false]] },
  re: { id: '8r8', notes: [['8', 0, true], ['8', 0, false]] },
} satisfies Record<string, Cell>

export interface RhythmLevel {
  id: string
  name: string
  description: string
  bpm: number
  /** [cell, weight] */
  cells: [Cell, number][]
}

export const RHYTHM_LEVELS: RhythmLevel[] = [
  { id: 'l1', name: 'Quarters & halves', description: 'Steady beats and two-beat notes.', bpm: 80, cells: [[CELL.q, 3], [CELL.h, 2]] },
  {
    id: 'l2',
    name: 'Wholes & rests',
    description: 'Hold for four, and feel the silences.',
    bpm: 80,
    cells: [[CELL.q, 3], [CELL.h, 2], [CELL.w, 1], [CELL.qr, 2], [CELL.hr, 1]],
  },
  { id: 'l3', name: 'Eighth notes', description: '“1 & 2 &”: two taps in a beat.', bpm: 76, cells: [[CELL.q, 2], [CELL.h, 1], [CELL.qr, 1], [CELL.e2, 4]] },
  {
    id: 'l4',
    name: 'Dotted rhythms',
    description: 'Long-short: a dotted quarter then an eighth.',
    bpm: 72,
    cells: [[CELL.q, 2], [CELL.e2, 2], [CELL.dq8, 4], [CELL.hd, 1], [CELL.qr, 1]],
  },
  {
    id: 'l5',
    name: 'Syncopation & 16ths',
    description: 'Off-beats and quick taps.',
    bpm: 66,
    cells: [[CELL.q, 1], [CELL.e2, 2], [CELL.sync, 3], [CELL.s4, 2], [CELL.e16, 2], [CELL.s16e, 2], [CELL.re, 2]],
  },
]

const isRestCell = (c: Cell) => c.notes.some(([, , rest]) => rest)

/** A random pattern of whole bars of 4/4 that always starts with a note. */
export function makePattern(level: RhythmLevel, bars = 2, rng: () => number = Math.random): RNote[] {
  const out: RNote[] = []
  for (let b = 0; b < bars; b++) {
    let pos = 0
    let rests = 0
    while (pos < 4) {
      const options = level.cells.filter(([c]) => {
        if (cellLen(c) > 4 - pos) return false
        if (c.starts && !c.starts.includes(pos)) return false
        if (isRestCell(c) && (rests >= 1 || c.notes[0][2] && b === 0 && pos === 0)) return false
        return true
      })
      const total = options.reduce((s, [, w]) => s + w, 0)
      let r = rng() * total
      let cell = options[0][0]
      for (const [c, w] of options) {
        if ((r -= w) < 0) {
          cell = c
          break
        }
      }
      if (isRestCell(cell)) rests++
      let t = b * 4 + pos
      for (const [dur, dots, rest] of cell.notes) {
        const beats = noteLen(dur, dots)
        out.push({ dur, dots, rest, start: t, beats })
        t += beats
      }
      pos += cellLen(cell)
    }
  }
  return out
}

/** Counting syllable for a beat position: 1 e & a. */
export function countLabel(start: number): string {
  const beat = Math.floor(start % 4 + 1e-9) + 1
  const frac = Math.round((start - Math.floor(start + 1e-9)) * 4) / 4
  if (frac === 0) return String(beat)
  if (frac === 0.5) return '&'
  return frac === 0.25 ? 'e' : 'a'
}

export function patternToStaff(pattern: RNote[], states?: ('normal' | 'correct' | 'wrong' | 'active')[]): StaffItem[] {
  const items: StaffItem[] = []
  pattern.forEach((n, i) => {
    if (i > 0 && Math.abs(n.start % 4) < 1e-9) items.push({ bar: 'single' })
    items.push({
      key: i,
      notes: n.rest ? [] : ['B4'],
      dur: n.dur,
      dots: n.dots || undefined,
      text: n.rest ? `(${countLabel(n.start)})` : countLabel(n.start),
      state: states?.[i] ?? 'normal',
    })
  })
  items.push({ bar: 'final' })
  return items
}

/** Beat positions where you should tap (notes, not rests). */
export function onsetBeats(pattern: RNote[]): number[] {
  return pattern.filter((n) => !n.rest).map((n) => n.start)
}

export type Grade = 'perfect' | 'good' | 'ok' | 'miss'

export interface NoteResult {
  expected: number
  tap: number | null
  /** Seconds; negative = early. */
  error: number | null
  grade: Grade
}

export const GRADE_POINTS: Record<Grade, number> = { perfect: 100, good: 80, ok: 50, miss: 0 }

/**
 * Match taps to expected onsets (both in seconds, same clock). Each onset takes the closest unused tap
 * inside a window that never reaches halfway to its neighbours. Unmatched taps count as extras.
 */
export function scoreTaps(expected: number[], taps: number[]): { results: NoteResult[]; extras: number[]; score: number } {
  const used = new Set<number>()
  const results = expected.map((t, i): NoteResult => {
    const prevGap = i > 0 ? t - expected[i - 1] : Infinity
    const nextGap = i < expected.length - 1 ? expected[i + 1] - t : Infinity
    const win = Math.min(0.2, 0.5 * Math.min(prevGap, nextGap))
    let best = -1
    let bestErr = Infinity
    taps.forEach((tap, j) => {
      if (used.has(j)) return
      const err = tap - t
      if (Math.abs(err) <= win && Math.abs(err) < Math.abs(bestErr)) {
        best = j
        bestErr = err
      }
    })
    if (best < 0) return { expected: t, tap: null, error: null, grade: 'miss' }
    used.add(best)
    const a = Math.abs(bestErr)
    const grade: Grade = a <= 0.045 ? 'perfect' : a <= 0.09 ? 'good' : 'ok'
    return { expected: t, tap: taps[best], error: bestErr, grade }
  })
  const extras = taps.filter((_, j) => !used.has(j))
  const avg = results.reduce((s, r) => s + GRADE_POINTS[r.grade], 0) / Math.max(1, results.length)
  const score = Math.max(0, Math.round(avg - extras.length * 12))
  return { results, extras, score }
}
