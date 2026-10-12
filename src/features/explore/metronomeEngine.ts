import { create } from 'zustand'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { getPref, setPref } from '../../state/prefs'
import { softTick } from './drums'
import { METERS, clampBpm } from './tempo'

/**
 * The metronome runs app-wide: start it on the Metronome page and it keeps clicking while you practise a scale
 * in Scale Explorer or play in Free Play (a chip in the header shows the beat and stops it). Its settings are the
 * Metronome page's prefs, read on every tick, so changes apply straight away.
 */

const SUBS = [1, 2, 3, 4]

export interface Trainer {
  on: boolean
  /** BPM added each time… */
  step: number
  /** …this many bars have passed… */
  every: number
  /** …until this tempo. */
  target: number
}
export const DEFAULT_TRAINER: Trainer = { on: false, step: 4, every: 4, target: 120 }

export function trainerPref(): Trainer {
  const t = getPref<Trainer | null>('metronome:trainer', null)
  if (!t || typeof t !== 'object') return DEFAULT_TRAINER
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return { on: t.on === true, step: num(t.step, 4), every: Math.max(1, Math.round(num(t.every, 4))), target: clampBpm(num(t.target, 120)) }
}

/** The next tempo for the speed trainer once `bars` more bars have gone by (pure, for tests). */
export function trainedBpm(bpm: number, t: Trainer, barsDone: number): number {
  if (!t.on || barsDone === 0 || barsDone % t.every !== 0) return bpm
  return bpm >= t.target ? bpm : Math.min(t.target, bpm + t.step)
}

function settings() {
  const meter = METERS.find((m) => m.id === getPref('metronome:meter', '4/4', METERS.map((x) => x.id))) ?? METERS[2]
  return {
    bpm: clampBpm(getPref('metronome:bpm', 90)),
    meter,
    sub: getPref('metronome:sub', 1, SUBS),
    accent: getPref('metronome:accent', true),
  }
}

interface MetronomeState {
  running: boolean
  /** Beat in the bar (0-based), -1 when stopped. */
  beat: number
  /** Beats since starting (drives the pendulum and the flash). */
  count: number
}

export const useMetronome = create<MetronomeState>(() => ({ running: false, beat: -1, count: 0 }))

let clock: Clock | null = null
let timers: number[] = []

export function stopMetronome() {
  clock?.stop()
  clock = null
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
  useMetronome.setState({ running: false, beat: -1 })
}

export function startMetronome() {
  stopMetronome()
  let bars = 0
  const c = new Clock({
    interval: () => {
      const s = settings()
      return 60 / s.bpm / s.sub
    },
    onTick: (i, time) => {
      const s = settings()
      if (i % s.sub !== 0) {
        softTick(time)
        return
      }
      const n = Math.floor(i / s.sub)
      const b = n % s.meter.beats
      // The speed trainer: a little faster every few bars, up to the target.
      if (b === 0 && n > 0) {
        bars++
        const next = trainedBpm(s.bpm, trainerPref(), bars)
        if (next !== s.bpm) setPref('metronome:bpm', next)
      }
      audio.click(s.accent && s.meter.accents.includes(b), time)
      timers = [...timers.slice(-16), audio.at(time, () => useMetronome.setState({ beat: b, count: n }))]
    },
  })
  clock = c
  c.start(0.08)
  useMetronome.setState({ running: true })
}

export function toggleMetronome() {
  if (clock) stopMetronome()
  else startMetronome()
}

/** Metre or clicks-per-beat changed: start again from beat 1 (if it's running). */
export function restartMetronome() {
  if (clock) window.setTimeout(startMetronome, 0)
}
