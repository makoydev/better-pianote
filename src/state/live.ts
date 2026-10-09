import { create } from 'zustand'

export type NoteSource = 'midi' | 'screen' | 'keys' | 'mic'
export type MidiStatus = 'unsupported' | 'idle' | 'requesting' | 'denied' | 'ready'
export type MicStatus = 'off' | 'starting' | 'on' | 'denied' | 'unsupported'

/** What's happening right now (not saved): held notes, pedal, device status. */
export interface LiveState {
  held: Record<number, NoteSource>
  sustain: boolean
  midi: MidiStatus
  midiDevices: string[]
  mic: MicStatus
  micLevel: number
  lastSource: NoteSource | null
  /** Base octave for computer-keyboard playing (A key = C of this octave). */
  keysOctave: number
}

export const useLive = create<LiveState>()(() => ({
  held: {},
  sustain: false,
  midi: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator ? 'idle' : 'unsupported',
  midiDevices: [],
  mic: typeof navigator !== 'undefined' && !!navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices ? 'off' : 'unsupported',
  micLevel: 0,
  lastSource: null,
  keysOctave: 4,
}))

export const heldMidis = (held: Record<number, NoteSource>) =>
  Object.keys(held)
    .map(Number)
    .sort((a, b) => a - b)
