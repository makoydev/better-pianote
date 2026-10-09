import type { NoteState, StaffItem } from '../../components/staff/Staff'
import { type Song, type SongEvent, eventBeats } from '../../content/songs'
import { type Chord, chordSymbol, midiOf, parseChord, parseNote } from '../../lib/theory'

/** A song laid out in time (quarter-note beats), ready for wait mode, playback and drawing. */

export interface TimedNote {
  id: number
  midi: number
  name: string
  hand: 'rh' | 'lh'
  /** Start, in quarter notes from the beginning. */
  start: number
  /** How long it sounds (tied notes merged). */
  dur: number
  /** The written note, for drawing. */
  ev: SongEvent
  finger?: number
  /** Index of the right-hand event it starts under (the cursor position). */
  event: number
  /** Second half of a tie: it's held, not played again. */
  cont: boolean
}

export interface RhEvent {
  index: number
  start: number
  dur: number
  bar: number
  ev: SongEvent
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
  firstEvent: number
}

export interface Timeline {
  rh: RhEvent[]
  notes: TimedNote[]
  chords: ChordChange[]
  bars: BarSpan[]
  total: number
}

const EPS = 1e-6

export function buildTimeline(song: Song): Timeline {
  const rh: RhEvent[] = []
  const notes: TimedNote[] = []
  const chordStarts: { start: number; symbol: string }[] = []
  const bars: BarSpan[] = []
  let t = 0
  let id = 0
  song.rh.forEach((bar, b) => {
    bars.push({ start: t, dur: 0, firstEvent: rh.length })
    for (const ev of bar) {
      const d = eventBeats(ev)
      const index = rh.length
      rh.push({ index, start: t, dur: d, bar: b, ev })
      if (ev.chord) chordStarts.push({ start: t, symbol: ev.chord })
      for (const n of ev.notes) {
        notes.push({ id: id++, midi: midiOf(parseNote(n)), name: n, hand: 'rh', start: t, dur: d, ev, finger: ev.finger, event: index, cont: false })
      }
      t += d
    }
    bars[b].dur = t - bars[b].start
  })
  const total = t

  // Ties: the second note is held, so the first one sounds for both.
  for (let i = 1; i < rh.length; i++) {
    if (!rh[i - 1].ev.tie) continue
    for (const n of notes.filter((x) => x.event === i && x.hand === 'rh')) {
      const prev = notes.find((p) => p.hand === 'rh' && p.event === i - 1 && p.midi === n.midi)
      if (!prev) continue
      n.cont = true
      // Walk back to the first note of the tie chain and lengthen it.
      let head = prev
      while (head.cont) {
        const before = notes.find((p) => p.hand === 'rh' && p.midi === head.midi && p.event === head.event - 1)
        if (!before) break
        head = before
      }
      head.dur += n.dur
    }
  }

  const eventAt = (time: number) => {
    for (let i = rh.length - 1; i >= 0; i--) if (rh[i].start <= time + EPS) return i
    return 0
  }

  song.lh?.forEach((bar, b) => {
    let lt = bars[b]?.start ?? total
    for (const ev of bar) {
      const d = eventBeats(ev)
      for (const n of ev.notes) {
        notes.push({ id: id++, midi: midiOf(parseNote(n)), name: n, hand: 'lh', start: lt, dur: d, ev, finger: ev.finger, event: eventAt(lt), cont: false })
      }
      lt += d
    }
  })

  const chords: ChordChange[] = chordStarts.map((c, i) => ({
    start: c.start,
    dur: (chordStarts[i + 1]?.start ?? total) - c.start,
    chord: parseChord(c.symbol),
    symbol: chordSymbol(parseChord(c.symbol)),
  }))

  return { rh, notes, chords, bars, total }
}

/** One thing to play in wait mode: every note that starts at the same moment. */
export interface Step {
  start: number
  event: number
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
      const rhNote = ns.find((n) => n.hand === 'rh')
      const event = rhNote ? rhNote.event : ns[0].event
      return {
        start,
        event,
        bar: tl.rh[event].bar,
        notes: ns.sort((a, b) => (a.hand === b.hand ? a.midi - b.midi : a.hand === 'rh' ? -1 : 1)),
        chord: tl.chords.find((c) => Math.abs(c.start - start) < EPS),
      }
    })
}

/** Staff items for the right hand, plus which event each item is (-1 for bar lines). */
export function songStaffItems(song: Song, opts: { chords?: boolean; fingers?: boolean; bars?: [number, number] } = {}) {
  const { chords = true, fingers = true } = opts
  const [b0, b1] = opts.bars ?? [0, song.rh.length - 1]
  const items: StaffItem[] = []
  const eventOf: number[] = []
  let index = 0
  song.rh.forEach((bar, b) => {
    for (const ev of bar) {
      if (b >= b0 && b <= b1) {
        items.push({
          key: `e${index}`,
          notes: ev.notes.map((n) => ({ note: n, finger: fingers ? ev.finger : undefined })),
          dur: ev.dur,
          dots: ev.dots || undefined,
          chord: chords && ev.chord ? chordSymbol(parseChord(ev.chord)) : undefined,
          tie: ev.tie || undefined,
        })
        eventOf.push(index)
      }
      index++
    }
    if (b >= b0 && b <= b1) {
      const last = b === song.rh.length - 1
      if (b < b1 || last) {
        items.push({ bar: last ? 'final' : 'single', key: `bar${b}` })
        eventOf.push(-1)
      }
    }
  })
  return { items, eventOf }
}

/** Copy of the staff items with a state on each event (done, active, wrong …). */
export function withStates(items: StaffItem[], eventOf: number[], stateOf: (event: number) => NoteState | undefined): StaffItem[] {
  return items.map((it, i) => {
    if ('bar' in it) return it
    const s = stateOf(eventOf[i])
    return s ? { ...it, state: s } : it
  })
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
