import type { StaffId } from '../../components/staff/layout'
import type { ScoreBar, ScoreInput, ScoreVoice } from '../../components/staff/score'
import { type Song, type SongEvent, eventBeats } from '../../content/songs'
import { type Chord, chordSymbol, midiOf, parseChord, parseNote } from '../../lib/theory'

/** A song laid out in time (quarter-note beats), ready for wait mode, playback and drawing. */

export interface TimedNote {
  id: number
  midi: number
  name: string
  hand: 'rh' | 'lh'
  /** Index into Timeline.voices. */
  voice: number
  /** Start, in quarter notes from the beginning. */
  start: number
  /** How long it sounds (tied notes merged). */
  dur: number
  /** The written note. */
  ev: SongEvent
  finger?: number
  bar: number
  /** Tied to the same note in its voice's next event. */
  tie: boolean
  /** Second half of a tie: it's held, not played again. */
  cont: boolean
}

export interface TimedEvent {
  start: number
  beats: number
  bar: number
  ev: SongEvent
  /** One per note name, in the same order. */
  notes: TimedNote[]
}

/** One line of music: a hand's main line, or an extra voice. */
export interface TimedVoice {
  hand: 'rh' | 'lh'
  events: TimedEvent[]
}

export interface ChordChange {
  start: number
  dur: number
  chord: Chord
  symbol: string
}

export interface BarSpan {
  start: number
  dur: number
}

export interface Timeline {
  voices: TimedVoice[]
  notes: TimedNote[]
  /** Every moment where something starts (notes, rests or a bar), sorted. */
  cols: number[]
  bars: BarSpan[]
  chords: ChordChange[]
  total: number
}

const EPS = 1e-6

export function buildTimeline(song: Song): Timeline {
  const sources: { hand: 'rh' | 'lh'; bars: SongEvent[][] }[] = [{ hand: 'rh', bars: song.rh }]
  if (song.lh) sources.push({ hand: 'lh', bars: song.lh })
  for (const v of song.voices ?? []) sources.push(v)

  const bars: BarSpan[] = []
  let t = 0
  for (const bar of song.rh) {
    const d = bar.reduce((s, e) => s + eventBeats(e), 0)
    bars.push({ start: t, dur: d })
    t += d
  }
  const total = t

  let id = 0
  const notes: TimedNote[] = []
  const voices: TimedVoice[] = sources.map((src, vi) => {
    const events: TimedEvent[] = []
    src.bars.forEach((bar, b) => {
      let at = bars[b]?.start ?? total
      for (const ev of bar) {
        const d = eventBeats(ev)
        const te: TimedEvent = { start: at, beats: d, bar: b, ev, notes: [] }
        ev.notes.forEach((name, k) => {
          const n: TimedNote = {
            id: id++,
            midi: midiOf(parseNote(name)),
            name,
            hand: src.hand,
            voice: vi,
            start: at,
            dur: d,
            ev,
            finger: ev.fingers ? (ev.fingers[k] ?? undefined) : ev.finger,
            bar: b,
            tie: ev.tie || !!ev.tieNotes?.includes(name),
            cont: false,
          }
          te.notes.push(n)
          notes.push(n)
        })
        events.push(te)
        at += d
      }
    })
    return { hand: src.hand, events }
  })

  // Ties: the second note is held, so the first one sounds for both.
  for (const v of voices) {
    v.events.forEach((cur, i) => {
      const next = v.events[i + 1]
      for (const n of cur.notes) {
        if (!n.tie) continue
        const m = next?.notes.find((x) => x.midi === n.midi && !x.cont)
        if (m) m.cont = true
        else n.tie = false
      }
    })
    const open = new Map<number, TimedNote>()
    for (const ev of v.events) {
      for (const n of ev.notes) {
        if (n.cont) {
          const head = open.get(n.midi)
          if (head) head.dur += n.dur
          if (!n.tie) open.delete(n.midi)
        } else if (n.tie) open.set(n.midi, n)
      }
    }
  }

  const colSet = new Map<number, number>()
  for (const b of bars) colSet.set(Math.round(b.start * 1e6), b.start)
  for (const v of voices) for (const e of v.events) if (!e.ev.hidden) colSet.set(Math.round(e.start * 1e6), e.start)
  const cols = [...colSet.values()].sort((a, b) => a - b)

  // Chord symbols can sit on any voice (imported scores put them where they start).
  const chordStarts = new Map<number, { start: number; symbol: string }>()
  for (const v of voices) {
    for (const e of v.events) {
      const k = Math.round(e.start * 1e6)
      if (e.ev.chord && !chordStarts.has(k)) chordStarts.set(k, { start: e.start, symbol: e.ev.chord })
    }
  }
  const starts = [...chordStarts.values()].sort((a, b) => a.start - b.start)
  const chords: ChordChange[] = starts.map((c, i) => ({
    start: c.start,
    dur: (starts[i + 1]?.start ?? total) - c.start,
    chord: parseChord(c.symbol),
    symbol: chordSymbol(parseChord(c.symbol)),
  }))

  return { voices, notes, cols, bars, chords, total }
}

/** Index of the bar playing at a moment. */
export function barAt(tl: Timeline, t: number): number {
  let b = 0
  while (b + 1 < tl.bars.length && tl.bars[b + 1].start <= t + EPS) b++
  return b
}

/** One thing to play in wait mode: every note that starts at the same moment. */
export interface Step {
  start: number
  bar: number
  notes: TimedNote[]
  chord?: ChordChange
}

export function buildSteps(tl: Timeline, hands: 'rh' | 'both'): Step[] {
  const groups = new Map<number, TimedNote[]>()
  for (const n of tl.notes) {
    if (n.cont || (hands === 'rh' && n.hand === 'lh')) continue
    const k = Math.round(n.start * 1000)
    groups.set(k, [...(groups.get(k) ?? []), n])
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, ns]) => {
      const start = ns[0].start
      return {
        start,
        bar: ns[0].bar,
        notes: ns.sort((a, b) => (a.hand === b.hand ? a.midi - b.midi : a.hand === 'rh' ? -1 : 1)),
        chord: tl.chords.find((c) => Math.abs(c.start - start) < EPS),
      }
    })
}

/** Key and time signature in force in each bar. */
function signatures(song: Song, bars: number) {
  let key = song.keySig
  let time = song.time
  const changes = [...(song.changes ?? [])].sort((a, b) => a.bar - b.bar)
  return Array.from({ length: bars }, (_, b) => {
    for (const c of changes) {
      if (c.bar !== b) continue
      if (c.keySig !== undefined) key = c.keySig
      if (c.time) time = c.time
    }
    return { keySig: key, time }
  })
}

/** What the score layout needs to draw a song (or some of its bars). */
export function songScoreInput(
  song: Song,
  tl: Timeline,
  opts: { hands: 'rh' | 'both'; bars?: [number, number]; fingers?: boolean },
): ScoreInput {
  const both = opts.hands === 'both' && !!song.lh
  const [b0, b1] = opts.bars ?? [0, tl.bars.length - 1]
  const sigs = signatures(song, tl.bars.length)
  const bars: ScoreBar[] = tl.bars.slice(b0, b1 + 1).map((b, i) => ({ start: b.start, dur: b.dur, ...sigs[b0 + i] }))
  const voices: ScoreVoice[] = []
  tl.voices.forEach((v, vi) => {
    if (!both && v.hand === 'lh') return
    const staff: StaffId = v.hand === 'rh' ? 'treble' : 'bass'
    voices.push({
      staff,
      events: v.events.flatMap((e, i) =>
        e.bar < b0 || e.bar > b1
          ? []
          : [
              {
                key: `${vi}:${i}`,
                start: e.start,
                dur: e.ev.dur,
                dots: e.ev.dots,
                tuplet: e.ev.tuplet,
                hidden: e.ev.hidden,
                notes: e.notes.map((n) => ({
                  id: n.id,
                  note: parseNote(n.name),
                  finger: opts.fingers === false ? undefined : n.finger,
                  tie: n.tie,
                  cont: n.cont,
                })),
              },
            ],
      ),
    })
  })
  const from = tl.bars[b0]?.start ?? 0
  const to = (tl.bars[b1]?.start ?? 0) + (tl.bars[b1]?.dur ?? 0)
  return {
    staves: both ? ['treble', 'bass'] : ['treble'],
    bars,
    voices,
    chords: tl.chords.filter((c) => c.start >= from - EPS && c.start < to - EPS).map((c) => ({ start: c.start, text: c.symbol })),
    final: b1 === tl.bars.length - 1,
    pickup: !!song.pickup && b0 === 0,
  }
}

/** Bars for a preview: up to two after any pickup, fewer when they're busy (max moments to show). */
export function previewBars(tl: Timeline, hands: 'rh' | 'both', pickup: boolean, max = 12): [number, number] {
  const moments = (bar: number) => {
    const set = new Set<number>()
    for (const v of tl.voices) {
      if (hands === 'rh' && v.hand === 'lh') continue
      for (const e of v.events) if (e.bar === bar && !e.ev.hidden) set.add(Math.round(e.start * 1e6))
    }
    return set.size
  }
  const first = Math.min(pickup ? 1 : 0, tl.bars.length - 1)
  let last = first
  let count = 0
  for (let b = 0; b <= last; b++) count += moments(b)
  while (last + 1 < tl.bars.length && last < first + 1 && count + moments(last + 1) <= max) count += moments(++last)
  return [0, last]
}

/** Keyboard range that fits the notes, at least two octaves, starting on a C. */
export function keyboardRange(midis: number[]) {
  const lo = Math.min(...midis)
  const hi = Math.max(...midis)
  const from = Math.floor(lo / 12) * 12
  let to = Math.floor(hi / 12) * 12 + 11
  if (to - from < 23) to = from + 23
  return { from, to: to + 1 }
}
