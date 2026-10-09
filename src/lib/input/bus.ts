import { useEffect, useEffectEvent } from 'react'
import { type NoteSource, useLive } from '../../state/live'
import { useSettings } from '../../state/settings'
import { audio } from '../audio/engine'

export type { NoteSource }

export interface NoteEvent {
  type: 'on' | 'off'
  midi: number
  velocity: number
  source: NoteSource
  /** performance.now() when it happened. */
  time: number
}

type Listener = (e: NoteEvent) => void
const listeners = new Set<Listener>()
const recent: { midi: number; time: number }[] = []

/** Notes from these sources are silent devices, so the app plays the sound for them. */
function makesSound(source: NoteSource) {
  if (source === 'screen' || source === 'keys') return true
  return source === 'midi' && useSettings.getState().midiThru
}

export function noteOn(midi: number, velocity = 0.75, source: NoteSource = 'screen') {
  const time = performance.now()
  if (makesSound(source)) audio.noteOn(midi, velocity)
  useLive.setState((s) => ({ held: { ...s.held, [midi]: source }, lastSource: source }))
  recent.push({ midi, time })
  while (recent.length && time - recent[0].time > 4000) recent.shift()
  const e: NoteEvent = { type: 'on', midi, velocity, source, time }
  listeners.forEach((l) => l(e))
}

export function noteOff(midi: number, source: NoteSource = 'screen') {
  if (makesSound(source)) audio.noteOff(midi)
  const held = useLive.getState().held
  if (midi in held) {
    const next = { ...held }
    delete next[midi]
    useLive.setState({ held: next })
  }
  const e: NoteEvent = { type: 'off', midi, velocity: 0, source, time: performance.now() }
  listeners.forEach((l) => l(e))
}

export function setSustain(down: boolean) {
  useLive.setState({ sustain: down })
  if (useSettings.getState().midiThru) audio.setSustain(down)
}

/** Release everything from one source (e.g. when the window loses focus). */
export function releaseAll(source?: NoteSource) {
  for (const [m, s] of Object.entries(useLive.getState().held)) {
    if (!source || s === source) noteOff(Number(m), s)
  }
}

export function onNote(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** MIDI numbers played within the last `ms` milliseconds (for rolled chords from the mic). */
export function recentNotes(ms = 1500): number[] {
  const now = performance.now()
  return recent.filter((r) => now - r.time <= ms).map((r) => r.midi)
}

export function heldNow(): number[] {
  return Object.keys(useLive.getState().held)
    .map(Number)
    .sort((a, b) => a - b)
}

/** Subscribe a component to note events. The handler always sees fresh props/state. */
export function useNoteEvents(handler: (e: NoteEvent) => void) {
  const onEvent = useEffectEvent(handler)
  useEffect(() => onNote((e) => onEvent(e)), [])
}
