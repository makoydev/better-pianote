import { type Song, barBeats } from '../../content/songs'
import { type ChordChange, type Timeline, type TimedNote, addShared, barAt, signatures } from './timeline'

/** Listen mode: what to play when, at exact times (triplets and 32nds included), from any starting point. */

const EPS = 1e-6

/** Everything that happens at one moment: notes starting, a backing chord, the playhead moving. */
export interface Cue {
  t: number
  notes: TimedNote[]
  chord?: ChordChange
  /** A column of the score starts here, so the playhead moves to it. */
  col: boolean
  /** A metronome beat ('bar' for the first beat of a bar, which is accented). */
  click?: 'bar' | 'beat'
}

/** A metronome click, in beats from the start of the song. */
export interface Click {
  t: number
  accent: boolean
}

export function buildCues(tl: Timeline, clicks: Click[] = []): Cue[] {
  const map = new Map<number, Cue>()
  const at = (t: number) => {
    const k = Math.round(t * 1e6)
    let c = map.get(k)
    if (!c) map.set(k, (c = { t, notes: [], col: false }))
    return c
  }
  // A pitch two voices start together sounds once (playing it twice would just make it louder).
  for (const n of tl.notes) if (!n.cont) addShared(at(n.start).notes, n)
  for (const c of tl.chords) at(c.start).chord = c
  for (const t of tl.cols) at(t).col = true
  for (const c of clicks) at(c.t).click = c.accent ? 'bar' : 'beat'
  return [...map.values()].sort((a, b) => a.t - b.t)
}

/**
 * The beat a metronome clicks, in quarter notes: a dotted quarter in compound time (6/8, 9/8, 12/8), otherwise the
 * note of the time signature's lower number (a quarter in 3/4, an eighth in 3/8).
 */
export function clickBeat(time: [number, number]): number {
  const unit = 4 / time[1]
  return time[1] >= 8 && time[0] > 3 && time[0] % 3 === 0 ? unit * 3 : unit
}

/** Metronome clicks for the whole song: every beat, accented on the first of each bar. */
export function beatClicks(song: Song, tl: Timeline): Click[] {
  const sigs = signatures(song, tl.bars.length)
  const out: Click[] = []
  tl.bars.forEach((bar, b) => {
    const u = clickBeat(sigs[b].time)
    const end = bar.start + bar.dur
    // A pickup is the end of a bar, so its beats count back from the bar line.
    const pickup = b === 0 && !!song.pickup
    const downbeat = pickup ? end - barBeats(sigs[b].time) : bar.start
    const first = pickup ? end - Math.floor(bar.dur / u + EPS) * u : bar.start
    for (let k = 0; first + k * u < end - EPS; k++) {
      const t = first + k * u
      out.push({ t, accent: Math.abs(t - downbeat) < EPS })
    }
  })
  return out
}

export interface CountIn {
  /** Beats from the first click to where the music starts. */
  beats: number
  /** Each click's time in beats from the first one, and its number in the bar (1 is accented). */
  clicks: { at: number; beat: number }[]
}

/**
 * The clicks before playback starts at `pos`: a bar (two when a bar has fewer than three beats), starting on a bar
 * line, so music that starts mid-bar or with a pickup comes in on the right beat ("1 2 3, 1 2" before a pickup on 3).
 */
export function countIn(song: Song, tl: Timeline, pos: number): CountIn {
  const b = barAt(tl, pos)
  const { time } = signatures(song, tl.bars.length)[b]
  const u = clickBeat(time)
  const full = barBeats(time)
  const perBar = Math.max(1, Math.round(full / u))
  const bar = tl.bars[b]
  const downbeat = b === 0 && song.pickup ? bar.start + bar.dur - full : bar.start
  const start = downbeat - (perBar < 3 ? 2 : 1) * full
  const clicks: CountIn['clicks'] = []
  for (let k = 0; start + k * u < pos - EPS; k++) clicks.push({ at: k * u, beat: (k % perBar) + 1 })
  return { beats: pos - start, clicks }
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
 * that tick, each with its offset in beats from the tick's start. When looping it wraps back to lo (`wraps` holds
 * the offsets where it did); otherwise `end` is the offset where the music stops.
 */
export function advance(cues: Cue[], head: Playhead, len: number, lo: number, hi: number, looping: boolean) {
  const due: { cue: Cue; offset: number }[] = []
  const wraps: number[] = []
  if (hi - lo < EPS) return { due, end: 0, wraps }
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
      return { due, end: skipped + hi - start, wraps }
    }
    // Back to the first looped bar for the rest of this tick.
    skipped += hi - start
    wraps.push(skipped)
    end = lo + (end - hi)
    start = lo
    head.next = firstCueAt(cues, lo)
  }
  head.pos = end
  return { due, wraps }
}

/** Notes that started before t and are still sounding at t (picked up when playback starts there), one per key. */
export function ringingAt(tl: Timeline, t: number): TimedNote[] {
  const byKey = new Map<number, TimedNote>()
  for (const n of tl.notes) {
    if (n.cont || n.start >= t - EPS || n.start + n.dur <= t + EPS) continue
    const twin = byKey.get(n.midi)
    if (!twin || n.start + n.dur > twin.start + twin.dur + EPS) byKey.set(n.midi, n)
  }
  return [...byKey.values()]
}
