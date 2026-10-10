import type { ChordChange, Timeline, TimedNote } from './timeline'

/** Listen mode: what to play when, at exact times (triplets and 32nds included), from any starting point. */

const EPS = 1e-6

/** Everything that happens at one moment: notes starting, a backing chord, the playhead moving. */
export interface Cue {
  t: number
  notes: TimedNote[]
  chord?: ChordChange
  /** A column of the score starts here, so the playhead moves to it. */
  col: boolean
}

export function buildCues(tl: Timeline): Cue[] {
  const map = new Map<number, Cue>()
  const at = (t: number) => {
    const k = Math.round(t * 1e6)
    let c = map.get(k)
    if (!c) map.set(k, (c = { t, notes: [], col: false }))
    return c
  }
  for (const n of tl.notes) if (!n.cont) at(n.start).notes.push(n)
  for (const c of tl.chords) at(c.start).chord = c
  for (const t of tl.cols) at(t).col = true
  return [...map.values()].sort((a, b) => a.t - b.t)
}

/** Index of the first cue at or after moment t. */
export function firstCueAt(cues: Cue[], t: number): number {
  let lo = 0
  let hi = cues.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cues[mid].t < t - EPS) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Where playback is: the moment the next tick starts at, and the next cue to play. */
export interface Playhead {
  pos: number
  next: number
}

/**
 * Move the playhead on by one tick of `len` beats, inside the part that plays ([lo, hi)). Returns the cues due in
 * that tick, each with its offset in beats from the tick's start. When looping it wraps back to lo; otherwise
 * `end` is the offset where the music stops.
 */
export function advance(cues: Cue[], head: Playhead, len: number, lo: number, hi: number, looping: boolean) {
  const due: { cue: Cue; offset: number }[] = []
  if (hi - lo < EPS) return { due, end: 0 }
  let start = head.pos
  let end = head.pos + len
  let skipped = 0
  for (;;) {
    const stop = Math.min(end, hi)
    while (head.next < cues.length && cues[head.next].t < stop - EPS) {
      const c = cues[head.next++]
      if (c.t >= start - EPS) due.push({ cue: c, offset: skipped + c.t - start })
    }
    if (end < hi - EPS) break
    if (!looping) {
      head.pos = hi
      return { due, end: skipped + hi - start }
    }
    // Back to the first looped bar for the rest of this tick.
    skipped += hi - start
    end = lo + (end - hi)
    start = lo
    head.next = firstCueAt(cues, lo)
  }
  head.pos = end
  return { due }
}

/** Notes that started before t and are still sounding at t (picked up when playback starts there). */
export function ringingAt(tl: Timeline, t: number): TimedNote[] {
  return tl.notes.filter((n) => !n.cont && n.start < t - EPS && n.start + n.dur > t + EPS)
}
