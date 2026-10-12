import { useEffect, useRef, useState } from 'react'
import { audio } from '../../lib/audio/engine'

export interface DemoTiming {
  /** Seconds between steps (0 for a single note or chord). */
  gap: number
  /** How long each step rings. */
  dur: number
  /** Seconds between a chord's notes, when it's rolled. */
  strum?: number
}

/**
 * When each key of a demo lights and goes out, in seconds from its start. A key goes out a little before the next
 * step (so a repeated note blinks); the last step stays lit while it rings.
 */
export function demoSchedule(steps: (number | number[])[], { gap, dur, strum = 0 }: DemoTiming): { midi: number; on: number; off: number }[] {
  return steps.flatMap((s, i) => {
    const hold = i === steps.length - 1 ? dur : Math.min(dur, gap * 0.85)
    return (Array.isArray(s) ? s : [s]).map((midi, k) => {
      const on = i * gap + k * strum
      return { midi, on, off: on + hold }
    })
  })
}

/**
 * Lights the keys a demo plays, in time with its sound, so you see what you hear. Call `show` right after starting
 * the sound with the same steps and timing (playNotes and playSequence start 30 ms ahead on the audio clock).
 * Lit keys are a plain colour change: nothing moves, so it's fine with reduced motion.
 */
export function useDemoLights() {
  // How many times each key is lit right now (a repeated note can overlap itself).
  const [lit, setLit] = useState<Record<number, number>>({})
  const timers = useRef<number[]>([])
  const stop = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => stop, [])

  const bump = (m: number, by: number) =>
    setLit((l) => {
      const n = (l[m] ?? 0) + by
      const next = { ...l }
      if (n > 0) next[m] = n
      else delete next[m]
      return next
    })

  const show = (steps: (number | number[])[], timing: DemoTiming) => {
    stop()
    setLit({})
    const t0 = audio.unlock().currentTime + 0.03
    for (const { midi, on, off } of demoSchedule(steps, timing)) {
      timers.current.push(
        audio.at(t0 + on, () => bump(midi, 1)),
        audio.at(t0 + off, () => bump(midi, -1)),
      )
    }
  }

  return { lit: Object.keys(lit).map(Number), show }
}
