import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock } from '../lib/audio/clock'
import { audio } from '../lib/audio/engine'
import { MIC_DELAY, heardTime } from '../lib/audio/heard'
import { playNotes, stopDemos } from '../lib/audio/play'
import { useNoteEvents } from '../lib/input/bus'
import { RunJudge, type StepResult, type Target } from '../lib/timing'
import { useLive } from '../state/live'

export type RunSummary = ReturnType<RunJudge['summary']>

export interface TimedNote extends Target {
  /** How long it lasts, in beats (for "Show me"; default 1). */
  len?: number
}

export interface TimedPlan {
  targets: TimedNote[]
  /** Beats in a bar: the count-in's length, and the click that's accented. */
  meter: number
  /** Beats from the first beat to the end, where the run stops (default: a beat after the last note). */
  beats?: number
  hands: 1 | 2
  strict: boolean
}

export interface TimedRun {
  phase: 'count' | 'play' | 'done'
  /** "Show me": the app plays it in time and nothing is judged. */
  demo: boolean
  /** The count-in click we're on (1 up to the meter). */
  count: number
  /** The beat of the bar it is once the music starts (0 = the first beat). */
  beat: number | null
  /** The note whose moment it is. */
  step: number | null
  results: StepResult[]
  /** Each note's timing so far is within Rhythm Tap's window. */
  inTime: boolean[]
  summary: RunSummary | null
  /** A wrong key, flashed red for a moment, and a right one, flashed green. */
  wrongAt: number | null
  hitAt: number | null
  /** Keys a demo is sounding right now. */
  lit: number[]
}

/** The list without one copy of m (a repeated note can be lit twice). */
const without = (list: number[], m: number) => {
  const i = list.indexOf(m)
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)]
}

const snapshot = (j: RunJudge) => ({ results: j.results.map((r) => ({ ...r, hits: [...r.hits] })), inTime: j.results.map((_, k) => j.inTime(k)) })
const posOf = (t: TimedNote, k: number) => t.at ?? k

/**
 * Playing in time: a bar of count-in clicks, then the notes at their moments (the clicks can stop after the
 * count-in), each judged against the beat as you heard it. `onDone` gets the summary once the run's last beat
 * passes. `start({ demo: true })` plays it the same way instead, with the clicks, for "Show me".
 */
export function useTimedRun({
  plan,
  bpm,
  click,
  onDone,
}: {
  plan: TimedPlan
  bpm: number
  click: boolean
  onDone: (s: RunSummary, results: StepResult[]) => void
}) {
  const [run, setRun] = useState<TimedRun | null>(null)
  const judge = useRef<RunJudge | null>(null)
  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])
  const demoing = useRef(false)
  // Each run's scheduled updates check they still belong to the run that's on.
  const runId = useRef(0)

  const stop = useCallback(() => {
    runId.current++
    clock.current?.stop()
    clock.current = null
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    judge.current = null
    // A demo cut short stops sounding too.
    if (demoing.current) stopDemos()
    demoing.current = false
    setRun(null)
  }, [])
  useEffect(() => stop, [stop])

  const start = ({ demo = false }: { demo?: boolean } = {}) => {
    stop()
    const ctx = audio.unlock()
    const { targets, meter, hands, strict } = plan
    const beat = 60 / bpm
    const begin = ctx.currentTime + 0.2
    const t0 = begin + meter * beat
    const last = targets.length ? posOf(targets[targets.length - 1], targets.length - 1) : 0
    const beats = plan.beats ?? Math.floor(last) + 1
    const j = new RunJudge({ t0, beat, hands, strict, targets })
    judge.current = demo ? null : j
    demoing.current = demo
    setRun({ phase: 'count', demo, count: 0, beat: null, step: null, ...snapshot(j), summary: null, wrongAt: null, hitAt: null, lit: [] })
    const id = runId.current
    const ui = (time: number, fn: () => void) => {
      timers.current = [...timers.current.slice(-200), audio.at(time, () => runId.current === id && fn())]
    }
    const c = new Clock({
      interval: () => beat,
      onTick: (i, time) => {
        if (i < meter) {
          audio.click(i === 0, time)
          ui(time, () => setRun((r) => r && { ...r, count: i + 1 }))
          return
        }
        const k = i - meter
        if (k < beats) {
          // A demo keeps the clicks going, so you hear where each note falls.
          if (click || demo) audio.click(k % meter === 0, time)
          ui(time, () => {
            // Notes whose moment has passed without being played are misses.
            if (!demo) j.close(heardTime(performance.now()))
            setRun((r) => r && { ...r, phase: 'play', beat: k % meter, ...(demo ? {} : snapshot(j)) })
          })
          // The notes due in this beat: the playhead moves to each as its moment comes (a demo plays them).
          targets.forEach((t, n) => {
            const at = posOf(t, n)
            if (at < k || at >= k + 1) return
            const when = t0 + at * beat
            if (demo) {
              const dur = Math.max(0.15, (t.len ?? 1) * beat * 0.92)
              playNotes(t.midis, { dur, delay: Math.max(0, when - audio.now - 0.03) })
              ui(when, () => setRun((r) => r && { ...r, step: n, lit: [...r.lit, ...t.midis] }))
              ui(when + dur, () => setRun((r) => r && { ...r, lit: t.midis.reduce(without, r.lit) }))
            } else ui(when, () => setRun((r) => r && { ...r, step: n }))
          })
          return
        }
        // The end of the last bar: judge what's left and show how it went.
        c.stop()
        ui(time, () => {
          if (demo) {
            demoing.current = false
            setRun(null)
            return
          }
          j.close(Infinity)
          judge.current = null
          const summary = j.summary()
          setRun((r) => r && { ...r, phase: 'done', beat: null, step: null, ...snapshot(j), summary })
          onDone(summary, j.results)
        })
      },
    })
    clock.current = c
    c.start(begin - ctx.currentTime)
  }

  useNoteEvents((e) => {
    const j = judge.current
    if (!j) return
    const mic = e.source === 'mic'
    if (e.type === 'off') {
      // How long a note was held: only a key you can see let go, with the pedal up (the mic can't tell).
      if (!mic && !useLive.getState().sustain && j.release(e.midi, heardTime(e.time)) !== null) setRun((cur) => cur && { ...cur, ...snapshot(j) })
      return
    }
    const r = j.note(e.midi, heardTime(e.time) - (mic ? MIC_DELAY : 0), { mic })
    if (r === null) return
    setRun((cur) => cur && { ...cur, ...snapshot(j), wrongAt: r === 'wrong' ? e.midi : cur.wrongAt, hitAt: r === 'wrong' ? cur.hitAt : e.midi })
  })

  // A flashed key fades after a moment.
  useEffect(() => {
    if (run?.wrongAt == null) return
    const t = window.setTimeout(() => setRun((r) => r && { ...r, wrongAt: null }), 450)
    return () => window.clearTimeout(t)
  }, [run?.wrongAt])
  useEffect(() => {
    if (run?.hitAt == null) return
    const t = window.setTimeout(() => setRun((r) => r && { ...r, hitAt: null }), 300)
    return () => window.clearTimeout(t)
  }, [run?.hitAt])

  return { run, start, stop, running: !!run && run.phase !== 'done' }
}
