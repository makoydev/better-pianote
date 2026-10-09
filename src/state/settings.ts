import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UiScale = 'normal' | 'large' | 'xl'
export type KeyLabels = 'all' | 'c' | 'none'
export type Naming = 'letters' | 'solfege'

export interface Settings {
  uiScale: UiScale
  /** Rainbow colours per note name (C red, D orange …) on keys and notes. */
  colorNotes: boolean
  keyLabels: KeyLabels
  /** Note names printed under notes on the staff. */
  staffLabels: boolean
  naming: Naming
  volume: number
  reverb: boolean
  uiSounds: boolean
  /** Reconnect to MIDI automatically on launch (set after the first successful connect). */
  midiAuto: boolean
  /** Play the app's piano for notes from a MIDI keyboard too (off: your keyboard makes its own sound). */
  midiThru: boolean
  /** Send demo playback to the MIDI keyboard so it plays through its own speakers. */
  demoToKeyboard: boolean
  computerKeys: boolean
  /** Require the exact octave in games (off: any C counts as C). */
  strictOctave: boolean
  name: string
  onboarded: boolean
  set: (patch: Partial<Omit<Settings, 'set'>>) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      uiScale: 'large',
      colorNotes: true,
      keyLabels: 'all',
      staffLabels: true,
      naming: 'letters',
      volume: 0.85,
      reverb: true,
      uiSounds: true,
      midiAuto: false,
      midiThru: false,
      demoToKeyboard: false,
      computerKeys: true,
      strictOctave: false,
      name: '',
      onboarded: false,
      set: (patch) => set(patch),
    }),
    { name: 'tonic-settings', version: 1 },
  ),
)
