import type { Duration, StaffNoteSpec } from '../../components/staff/Staff'
import type { PlayStep, StaffVisual } from '../../content/types'
import { type Note, midiOf, mod, parseNote } from '../../lib/theory'
import type { RunSummary, StepResult } from '../../lib/timing'
import { timingTendency } from '../practice/logic/rhythm'
import { targetMidis } from './match'

/** Play steps in time (pure): when each note falls, and what to say about a run. */

export interface TimedStepNote {
  midi: number
  /** When it starts and how long it lasts, in beats (quarter notes) from the start of the music. */
  at: number
  len: number
  /** Its place among the staff's notes and rests (for its colour there), or -1 without a staff. */
  event: number
}

export interface StepRhythm {
  notes: TimedStepNote[]
  /** Beats in a bar. */
  meter: number
  /** The whole passage, rests included, in beats. */
  beats: number
}

const BEATS: Record<Duration, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125, '64': 0.0625 }

/** A written length in beats: each dot adds half of what comes before it. */
export const beatsOf = (dur: Duration = 'q', dots = 0) => BEATS[dur] * (2 - 0.5 ** dots)

const keyOf = (n: string | Note | StaffNoteSpec) =>
  typeof n === 'string' ? midiOf(parseNote(n)) : 'letter' in n ? midiOf(n) : midiOf(typeof n.note === 'string' ? parseNote(n.note) : n.note)

/**
 * When each note on a staff falls, from its written lengths, rests and ties, provided its notes are `notes` in
 * order, one at a time (any octave with `anyOctave`). Null without a time signature, or when the staff spells out
 * something else.
 */
export function staffRhythm(staff: StaffVisual, notes: number[], anyOctave = false): StepRhythm | null {
  if (!staff.time) return null
  const out: TimedStepNote[] = []
  let at = 0
  let event = -1
  // A tied note carries on into the next event instead of being played again.
  let tied: TimedStepNote | null = null
  for (const it of staff.items) {
    if ('bar' in it) continue
    event++
    const len = beatsOf(it.dur, it.dots)
    const keys = (it.notes ?? []).map(keyOf)
    if (keys.length > 1) return null
    if (keys.length === 0) tied = null
    else if (tied && tied.midi === keys[0]) {
      tied.len += len
      if (!it.tie) tied = null
    } else {
      const want = notes[out.length]
      if (want === undefined || (anyOctave ? mod(want, 12) !== mod(keys[0], 12) : want !== keys[0])) return null
      const n = { midi: keys[0], at, len, event }
      out.push(n)
      tied = it.tie ? n : null
    }
    at += len
  }
  if (out.length !== notes.length) return null
  return { notes: out, meter: (staff.time[0] * 4) / staff.time[1], beats: at }
}

/**
 * A play step's rhythm: from its staff when that has a time signature (so "Show me" can play the written lengths),
 * or, for a step to play in time without a staff, a note on each beat of 4/4.
 */
export function stepRhythm(step: PlayStep): StepRhythm | null {
  const t = step.target
  if (t.type !== 'sequence') return null
  const notes = targetMidis(t)
  if (step.staff) return staffRhythm(step.staff, notes, t.anyOctave)
  if (!step.timed) return null
  return { notes: notes.map((midi, k) => ({ midi, at: k, len: 1, event: -1 })), meter: 4, beats: Math.ceil(notes.length / 4) * 4 }
}

export interface RunReport {
  passed: boolean
  /** Long notes (two beats or more) let go before 60% of their length. */
  short: boolean[]
  title: string
  /** How the notes went, as a sentence ("6 of 8 on the beat, 2 a little late."), or nothing when all were. */
  detail: string
  tip: string | null
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const sentence = (parts: (string | false | 0)[]) => `${parts.filter(Boolean).join(', ')}.`

/**
 * What a run in time comes to. It passes when every note is the right one and within Rhythm Tap's window of its
 * moment (one stray note is forgiven). `inTime` says which notes were; `names` are the notes' names for the tips.
 */
export function reportRun(summary: RunSummary, results: StepResult[], inTime: boolean[], rhythm: StepRhythm, beat: number, names: string[]): RunReport {
  const short = rhythm.notes.map((n, k) => {
    const held = results[k]?.held
    return n.len >= 2 && held != null && held < 0.6 * n.len * beat
  })
  const passed = summary.inTime === summary.total && summary.extras <= 1
  const offBeat = (v: 'early' | 'late') => results.filter((r, k) => r.verdict === v && !inTime[k]).length
  const slight = (v: 'early' | 'late') => results.filter((r, k) => r.verdict === v && inTime[k]).length
  const tendency = timingTendency(summary.errors)
  const listed = (pick: (k: number) => boolean) => [...new Set(names.filter((_, k) => pick(k)))].join(', ')
  const shorts = short.filter(Boolean).length
  const holdTip = shorts ? `Let go too soon: ${listed((k) => short[k])}. Keep each key down for its whole count.` : null
  const letGo = shorts > 0 && `${shorts} let go too soon`

  if (passed) {
    const parts = [
      `${summary.onTime} of ${summary.total} on the beat`,
      slight('early') && `${slight('early')} a little early`,
      slight('late') && `${slight('late')} a little late`,
      summary.extras && plural(summary.extras, 'extra note'),
      letGo,
    ]
    const perfect = summary.onTime === summary.total && !summary.extras && !shorts
    return {
      passed,
      short,
      title: summary.onTime === summary.total ? 'Right on the beat!' : 'In time!',
      detail: perfect ? '' : sentence(parts),
      tip: holdTip ?? (tendency && Math.abs(tendency.ms) > 30 ? `${tendency.text}.` : null),
    }
  }

  const parts = [
    offBeat('early') && `${offBeat('early')} too early`,
    offBeat('late') && `${offBeat('late')} too late`,
    summary.wrong && plural(summary.wrong, 'wrong note'),
    summary.missed && `${summary.missed} missed`,
    summary.extras > 1 && plural(summary.extras, 'extra note'),
    letGo,
  ]
  // Several notes off the same way is a habit (rushing or dragging); otherwise say which notes to watch.
  const early = offBeat('early')
  const late = offBeat('late')
  let tip: string | null
  if (summary.missed === summary.total) tip = 'No notes came through. Start, wait for the clicks to count you in, then play along.'
  else if (summary.wrong) tip = 'Check which keys first: Show me plays it for you.'
  else if (summary.missed) tip = 'Keep going after a slip: the beat doesn’t wait.'
  else if (early >= 2 && !late) tip = 'You’re rushing: wait for each beat before you play.'
  else if (late >= 2 && !early) tip = 'You’re dragging: be ready to play right on each beat.'
  else if (early || late) tip = `Off the beat: ${listed((k) => !inTime[k])}. Count out loud and play each note right on its count.`
  else tip = holdTip
  return { passed, short, title: 'Not quite in time', detail: sentence(parts), tip }
}
