import { useSettings } from '../../state/settings'
import { hasMidiOutput, sendToKeyboard } from '../input/midi'
import { type Chord, bassFor, voiceLead } from '../theory'
import { audio } from './engine'

/**
 * Demo playback for lessons and tools. Plays through the app, or through the connected keyboard's
 * own speakers when "Play demos on my keyboard" is on.
 */

const toKeyboard = () => useSettings.getState().demoToKeyboard && hasMidiOutput()

export function playNotes(midis: number[], opts: { dur?: number; strum?: number; vel?: number; delay?: number } = {}) {
  const { dur = 1.4, strum = 0, vel = 0.7, delay = 0 } = opts
  if (toKeyboard()) {
    midis.forEach((m, i) => sendToKeyboard([m], dur * 1000, vel, delay * 1000 + i * strum * 1000))
    audio.busyUntil = audio.now + delay + dur + 0.4
    return
  }
  const when = audio.unlock().currentTime + 0.03 + delay
  audio.play(midis, { dur, strum, vel, when })
}

/** Play steps one after another; each step is a note or a chord. Returns total seconds. */
export function playSequence(steps: (number | number[])[], opts: { gap?: number; dur?: number; vel?: number } = {}): number {
  const { gap = 0.42, vel = 0.7 } = opts
  const dur = opts.dur ?? gap * 1.5
  steps.forEach((s, i) => playNotes(Array.isArray(s) ? s : [s], { dur, vel, delay: i * gap }))
  return steps.length * gap + dur
}

/** Voicing used for demos: a bass note plus a close right-hand chord around middle C. */
export function demoVoicing(chord: Chord, withBass = true): number[] {
  const rh = voiceLead(null, chord, { center: 64, low: 57, high: 79 })
  return withBass ? [bassFor(chord, 40), ...rh] : rh
}

export function playChord(chord: Chord, opts: { arpeggio?: boolean; withBass?: boolean; dur?: number } = {}) {
  const v = demoVoicing(chord, opts.withBass ?? true)
  if (opts.arpeggio) return playSequence(v, { gap: 0.16, dur: 1.6 })
  playNotes(v, { dur: opts.dur ?? 1.8, strum: 0.025 })
  return opts.dur ?? 1.8
}
