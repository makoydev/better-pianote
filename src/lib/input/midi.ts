import { toast } from '../fx'
import { useLive } from '../../state/live'
import { useSettings } from '../../state/settings'
import { noteOff, noteOn, releaseAll, setSustain } from './bus'

/**
 * Web MIDI: listens to every connected keyboard (e.g. a Casio CT-S1 over USB, which shows up as
 * "CASIO USB-MIDI"). Works in Chrome, Edge and Firefox; Safari and iOS don't support Web MIDI.
 */

let access: MIDIAccess | null = null

export const midiSupported = () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

export async function connectMidi(): Promise<boolean> {
  if (!midiSupported()) {
    useLive.setState({ midi: 'unsupported' })
    return false
  }
  if (access) {
    bind()
    return true
  }
  useLive.setState({ midi: 'requesting' })
  try {
    access = await navigator.requestMIDIAccess({ sysex: false })
  } catch {
    useLive.setState({ midi: 'denied' })
    return false
  }
  access.onstatechange = () => bind()
  bind()
  useSettings.getState().set({ midiAuto: true })
  return true
}

/** Reconnect silently on launch if the user already granted access before. */
export async function autoConnectMidi() {
  if (!midiSupported() || !useSettings.getState().midiAuto) return
  try {
    const status = await navigator.permissions.query({ name: 'midi' as PermissionName })
    if (status.state === 'granted') await connectMidi()
  } catch {
    // Some browsers can't query the MIDI permission; wait for the user to press Connect.
  }
}

// Keyboards seen at the last check (null until the first one), to tell plugging in from unplugging.
let known: string[] | null = null

function bind() {
  if (!access) return
  const names: string[] = []
  for (const input of access.inputs.values()) {
    if (input.state !== 'connected') continue
    input.onmidimessage = handle
    names.push(prettyName(input.name ?? 'MIDI keyboard'))
  }
  const before = known
  known = names
  if (names.length === 0) {
    releaseAll('midi')
    // A pedal held down while the cable came out would otherwise stay "down" forever.
    if (useLive.getState().sustain) setSustain(false)
  } else if (!before?.length) {
    // The keyboard takes over from the mic (see micPaused in bus.ts).
    releaseAll('mic')
  }
  useLive.setState({ midi: 'ready', midiDevices: names })
  if (!before) return
  if (names.length > before.length) toast({ kind: 'connected', title: `${names.find((n) => !before.includes(n)) ?? names[0]} connected`, detail: 'Play away!' })
  else if (names.length < before.length && names.length === 0) toast({ kind: 'disconnected', title: 'Keyboard disconnected', detail: 'Plug it back in: it reconnects by itself.' })
}

function prettyName(name: string) {
  return name.replace(/\s+/g, ' ').trim()
}

function handle(e: MIDIMessageEvent) {
  const d = e.data
  if (!d || d.length < 2) return
  const status = d[0] & 0xf0
  const n = d[1]
  const v = d[2] ?? 0
  if (status === 0x90 && v > 0) noteOn(n, v / 127, 'midi')
  else if (status === 0x80 || (status === 0x90 && v === 0)) noteOff(n, 'midi')
  else if (status === 0xb0 && n === 64) setSustain(v >= 64)
  else if (status === 0xb0 && (n === 120 || n === 123)) releaseAll('midi')
}

/** Play notes through the keyboard's own speakers (when "Play demos on my keyboard" is on). */
export function sendToKeyboard(notes: number[], durMs: number, velocity = 0.7, delayMs = 0) {
  if (!access) return false
  const outs = [...access.outputs.values()].filter((o) => o.state === 'connected')
  if (outs.length === 0) return false
  const t0 = performance.now() + delayMs
  for (const out of outs) {
    for (const n of notes) {
      out.send([0x90, n, Math.round(velocity * 127)], t0)
      out.send([0x80, n, 0], t0 + durMs)
    }
  }
  return true
}

/** Silence the keyboard's own speakers (All Notes Off), e.g. when a demo it was playing is stopped. */
export function silenceKeyboard() {
  if (!access) return
  for (const out of access.outputs.values()) {
    if (out.state !== 'connected') continue
    for (let ch = 0; ch < 16; ch++) out.send([0xb0 | ch, 123, 0])
  }
}

export function hasMidiOutput() {
  return !!access && [...access.outputs.values()].some((o) => o.state === 'connected')
}
