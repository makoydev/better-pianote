import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { useNoteEvents } from '../../lib/input/bus'
import { mod } from '../../lib/theory'
import { MIC_DELAY, heardTime } from './heard'
import type { Hands, Step } from './scales'
import { RunJudge, type StepResult } from './scaleTiming'

export type RunSummary = ReturnType<RunJudge['summary']>

export interface TimedRun {
  phase: 'count' | 'play' | 'done'
  /** The count-in click we're on (1–4). */
  count: number
  /** The note whose beat it is. */
  step: number | null
  results: StepResult[]
  summary: RunSummary | null
  /** A wrong key, flashed red for a moment. */
  wrongAt: number | null
}

const COUNT_IN = 4

const snapshot = (j: RunJudge) => j.results.map((r) => ({ ...r, hits: [...r.hits] }))

/**
 * A scale in time: a bar of count-in clicks, then one note per click (the clicks can stop after the count-in),
 * each note judged against the beat as you heard it. `onDone` gets the summary once the last note's moment passes.
 */
export function useTimedRun({
  steps,
  hands,
  bpm,
  click,
  strict,
  onDone,
}: {
  steps: Step[]
  hands: Hands
  bpm: number
  click: boolean
  strict: boolean
  onDone: (s: RunSummary) => void
}) {
  const [run, setRun] = useState<TimedRun | null>(null)
  const judge = useRef<RunJudge | null>(null)
  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])

  const stop = useCallback(() => {
    clock.current?.stop()
    clock.current = null
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    judge.current = null
    setRun(null)
  }, [])
  useEffect(() => stop, [stop])

  const start = () => {
    stop()
    const ctx = audio.unlock()
    const beat = 60 / bpm
    const begin = ctx.currentTime + 0.2
    const j = new RunJudge({
      t0: begin + COUNT_IN * beat,
      beat,
      hands: hands === 'both' ? 2 : 1,
      strict,
      targets: steps.map((s) => ({ pc: mod((s.rh ?? s.lh)!.midi, 12), midis: [s.rh?.midi, s.lh?.midi].filter((m): m is number => m !== undefined) })),
    })
    judge.current = j
    setRun({ phase: 'count', count: 0, step: null, results: snapshot(j), summary: null, wrongAt: null })
    const ui = (time: number, fn: () => void) => {
      timers.current = [...timers.current.slice(-40), audio.at(time, fn)]
    }
    const c = new Clock({
      interval: () => beat,
      onTick: (i, time) => {
        if (i < COUNT_IN) {
          audio.click(i === 0, time)
          ui(time, () => setRun((r) => r && { ...r, count: i + 1 }))
          return
        }
        const k = i - COUNT_IN
        if (k < steps.length) {
          if (click) audio.click(k % 4 === 0, time)
          ui(time, () => {
            // Notes whose moment has passed without being played are misses.
            j.close(heardTime(performance.now()))
            setRun((r) => r && { ...r, phase: 'play', step: k, results: snapshot(j) })
          })
          return
        }
        // A beat after the last note: judge what's left and show how it went.
        c.stop()
        ui(time, () => {
          if (judge.current !== j) return
          j.close(Infinity)
          const summary = j.summary()
          setRun((r) => r && { ...r, phase: 'done', step: null, results: snapshot(j), summary })
          onDone(summary)
        })
      },
    })
    clock.current = c
    c.start(begin - ctx.currentTime)
  }

  useNoteEvents((e) => {
    const j = judge.current
    if (e.type !== 'on' || !j || run?.phase === 'done') return
    const mic = e.source === 'mic'
    const r = j.note(e.midi, heardTime(e.time) - (mic ? MIC_DELAY : 0), { mic })
    if (r === null) return
    setRun((cur) => cur && { ...cur, results: snapshot(j), wrongAt: r === 'wrong' ? e.midi : cur.wrongAt })
  })

  // The red flash on a wrong key fades after a moment.
  useEffect(() => {
    if (run?.wrongAt == null) return
    const t = window.setTimeout(() => setRun((r) => r && { ...r, wrongAt: null }), 450)
    return () => window.clearTimeout(t)
  }, [run?.wrongAt])

  return { run, start, stop, running: !!run && run.phase !== 'done' }
}
