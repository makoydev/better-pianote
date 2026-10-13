import { useMemo, useState } from 'react'
import type { PlayStep } from '../../../content/types'
import { useHandsFree } from '../../../hooks/useHandsFree'
import { type TimedPlan, useTimedRun } from '../../../hooks/useTimedRun'
import { useNoteEvents } from '../../../lib/input/bus'
import { nameNote } from '../../../lib/naming'
import { mod, parseNote } from '../../../lib/theory'
import { usePref } from '../../../state/prefs'
import { useSettings } from '../../../state/settings'
import { type RunReport, type StepRhythm, reportRun } from '../rhythm'

export const MIN_BPM = 40
export const MAX_BPM = 160

export type TimedStep = ReturnType<typeof useTimedStep>

/**
 * A play step in time (rhythm lessons): Start counts in a bar of clicks, then the notes are judged against the beat
 * as written. A run that's in time solves the step (`onPass`); one that isn't is a slip (`onFail`). Runs can go on
 * after that, to play it better. Enter, a pedal tap or the top C start one when `handsFree` (they don't continue
 * the lesson at the same time).
 */
export function useTimedStep({
  step,
  rhythm,
  handsFree,
  solved,
  onPass,
  onFail,
}: {
  step: PlayStep
  rhythm: StepRhythm | null
  handsFree: boolean
  solved: boolean
  onPass: () => void
  onFail: () => void
}) {
  const on = !!step.timed && !!rhythm
  const naming = useSettings((s) => s.naming)
  const [bpm, setBpm] = useState(step.timed?.bpm ?? 80)
  const [click, setClick] = usePref('lesson:click', true)
  const [report, setReport] = useState<RunReport | null>(null)
  const [fails, setFails] = useState(0)
  // You played before pressing Start: say how to begin.
  const [nudge, setNudge] = useState(false)
  const names = useMemo(() => step.target.notes.map((n) => nameNote(parseNote(n), naming)), [step.target.notes, naming])

  const plan = useMemo<TimedPlan>(
    () => ({
      targets: (rhythm?.notes ?? []).map((n) => ({ pc: mod(n.midi, 12), midis: [n.midi], at: n.at, len: n.len })),
      meter: rhythm?.meter ?? 4,
      beats: rhythm?.beats,
      hands: 1,
      strict: !step.target.anyOctave,
    }),
    [rhythm, step.target.anyOctave],
  )
  const timed = useTimedRun({
    plan,
    bpm,
    click,
    onDone: ({ summary, results, inTime, bpm: tempo }) => {
      if (!rhythm) return
      const r = reportRun(summary, results, inTime, rhythm, 60 / tempo, names)
      setReport(r)
      if (r.passed) onPass()
      else {
        setFails((f) => f + 1)
        onFail()
      }
    },
  })

  const start = (tempo = bpm) => {
    setReport(null)
    setNudge(false)
    setBpm(tempo)
    timed.start({ tempo })
  }
  const demo = () => {
    setReport(null)
    setNudge(false)
    timed.start({ demo: true })
  }

  useNoteEvents((e) => {
    if (on && !solved && e.type === 'on' && !timed.running) setNudge(true)
  })
  useHandsFree(on && handsFree && !timed.running ? () => start() : null)

  return { on, timed, bpm, setBpm, click, setClick, report, fails, nudge, names, start, demo, meter: plan.meter }
}
