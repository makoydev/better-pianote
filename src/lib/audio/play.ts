import { useSettings } from '../../state/settings'
import { hasMidiOutput, sendToKeyboard, silenceKeyboard } from '../input/midi'
import { type Chord, bassFor, voiceLead } from '../theory'
import { audio } from './engine'

/**
 * Demo playback for lessons and tools. Plays through the app, or through the connected keyboard's
 * own speakers when "Play demos on my keyboard" is on.
 */

const toKeyboard = () => useSettings.getState().demoToKeyboard && hasMidiOutput()

// Keyboard demo notes not sent yet: they go out just before they're due, so a stop can still cancel them.
const pending = new Set<number>()

function sendSoon(midi: number, durMs: number, vel: number, delayMs: number) {
  if (delayMs < 80) return void sendToKeyboard([midi], durMs, vel, delayMs)
  const id = window.setTimeout(() => {
    pending.delete(id)
    sendToKeyboard([midi], durMs, vel, 50)
  }, delayMs - 50)
  pending.add(id)
}

export function playNotes(midis: number[], opts: { dur?: number; strum?: number; vel?: number; delay?: number } = {}) {
  const { dur = 1.4, strum = 0, vel = 0.7, delay = 0 } = opts
  if (toKeyboard()) {
    midis.forEach((m, i) => sendSoon(m, dur * 1000, vel, delay * 1000 + i * strum * 1000))
    // The mic hears the keyboard's speakers: it ignores these pitches while they ring.
    audio.markSounding(midis, audio.now + delay + dur + 0.4)
    return
  }
  const when = audio.unlock().currentTime + 0.03 + delay
  audio.play(midis, { dur, strum, vel, when })
}

/**
 * Play steps one after another; each step is a note or a chord. Returns total seconds. Starting a new sequence
 * stops the previous demo, so a double tap or a quick "Listen" on another scale doesn't play two at once.
 */
export function playSequence(steps: (number | number[])[], opts: { gap?: number; dur?: number; vel?: number } = {}): number {
  const { gap = 0.42, vel = 0.7 } = opts
  const dur = opts.dur ?? gap * 1.5
  stopDemos()
  steps.forEach((s, i) => playNotes(Array.isArray(s) ? s : [s], { dur, vel, delay: i * gap }))
  return steps.length * gap + dur
}

/** Stop every demo: the app's own sound and anything still to come from the keyboard's speakers. */
export function stopDemos() {
  audio.stopDemos()
  if (pending.size === 0) return
  for (const id of pending) window.clearTimeout(id)
  pending.clear()
  silenceKeyboard()
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
