import { useEffect } from 'react'
import { useLive } from '../../state/live'
import { useSettings } from '../../state/settings'
import { audio } from '../audio/engine'
import { noteOff, noteOn } from './bus'
import { estimatePitches } from './polyphony'

/**
 * Microphone input, for when there's no MIDI cable (or on iPad/Safari): listens to the keyboard's speakers.
 *
 * - Notes mode (default): one note at a time with the McLeod Pitch Method. Fast and exact, for reading
 *   games and melodies.
 * - Chords mode (on while a screen that needs chords calls `useMicChords()`): hears several notes at
 *   once from a high-resolution spectrum (see polyphony.ts). A little slower, as it needs a longer window.
 */

let stream: MediaStream | null = null
let small: AnalyserNode | null = null
let big: AnalyserNode | null = null
let timeBuf: Float32Array<ArrayBuffer> | null = null
let specBuf: Float32Array<ArrayBuffer> | null = null
let timer = 0
let mode: 'notes' | 'chords' = 'notes'
let chordUsers = 0
let lastRms = 0

// Notes mode
let current: number | null = null
let candidate: number | null = null
let candidateCount = 0
let silent = 0

// Chords mode
const seen = new Map<number, number>()
const missing = new Map<number, number>()
const sounding = new Set<number>()
let holdoff = 0
let testing = false

// The room's background level: drops straight to quieter readings, creeps up slowly. A note has to stand
// clearly above it, so the mic works with quiet and loud keyboards and in noisy rooms.
let floor = 0.003
const gate = () => Math.max(0.0025, floor * 2.5)
function trackFloor(rms: number) {
  if (rms < floor) floor = Math.max(0.0005, rms)
  else floor += (rms - floor) * 0.003
}

export async function startMic(): Promise<boolean> {
  if (stream) return true
  if (!navigator.mediaDevices?.getUserMedia) {
    useLive.setState({ mic: 'unsupported' })
    return false
  }
  useLive.setState({ mic: 'starting' })
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
  } catch {
    useLive.setState({ mic: 'denied' })
    return false
  }
  const ctx = audio.unlock()
  const src = ctx.createMediaStreamSource(stream)
  small = ctx.createAnalyser()
  small.fftSize = 2048
  big = ctx.createAnalyser()
  big.fftSize = 16384
  big.smoothingTimeConstant = 0
  src.connect(small)
  src.connect(big)
  timeBuf = new Float32Array(small.fftSize)
  specBuf = new Float32Array(big.frequencyBinCount)
  timer = window.setInterval(tick, 40)
  useLive.setState({ mic: 'on' })
  useSettings.getState().set({ micAuto: true })
  return true
}

export function stopMic() {
  window.clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  small = null
  big = null
  release()
  releaseChord()
  useLive.setState({ mic: 'off', micLevel: 0 })
  useSettings.getState().set({ micAuto: false })
}

/** Turn the mic back on at launch if you were using it and the browser still allows it. */
export async function autoStartMic() {
  if (!useSettings.getState().micAuto || !navigator.permissions) return
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    if (status.state === 'granted') await startMic()
  } catch {
    // Can't check the permission here; wait for the user to press Start listening.
  }
}

/** Screens that need chords (Free Play, chord steps) switch the mic to chord hearing while shown. */
export function useMicChords(active = true) {
  useEffect(() => {
    if (!active) return
    chordUsers++
    applyMode()
    return () => {
      chordUsers--
      applyMode()
    }
  }, [active])
}

function applyMode() {
  const next = chordUsers > 0 ? 'chords' : 'notes'
  if (next === mode) return
  release()
  releaseChord()
  mode = next
}

function release() {
  if (current !== null) noteOff(current, 'mic')
  current = null
  candidate = null
  candidateCount = 0
}

function releaseChord() {
  for (const m of sounding) noteOff(m, 'mic')
  sounding.clear()
  seen.clear()
  missing.clear()
}

function tick() {
  const ctx = audio.ctx
  if (!small || !timeBuf || !ctx) return
  small.getFloatTimeDomainData(timeBuf)
  let sum = 0
  for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i]
  const rms = Math.sqrt(sum / timeBuf.length)
  trackFloor(rms)
  useLive.setState({ micLevel: Math.min(1, rms * 10) })
  // Ignore the app's own sounds coming back through the mic.
  if (!testing && ctx.currentTime < audio.busyUntil) {
    release()
    releaseChord()
    lastRms = rms
    return
  }
  if (mode === 'chords') {
    tickChords(rms, ctx.sampleRate)
    return
  }
  if (rms < gate()) {
    if (++silent > 3) release()
    lastRms = rms
    return
  }
  silent = 0
  const p = detectPitch(timeBuf, ctx.sampleRate)
  const onset = rms > lastRms * 1.7 && rms > gate() * 4
  lastRms = rms
  if (!p || p.clarity < 0.82) return
  const m = Math.round(69 + 12 * Math.log2(p.freq / 440))
  if (m < 24 || m > 108) return
  const vel = Math.min(1, 0.3 + rms * 4)
  if (m === current) {
    // Same note struck again.
    if (onset) {
      noteOff(m, 'mic')
      noteOn(m, vel, 'mic')
    }
    return
  }
  if (m === candidate) candidateCount++
  else {
    candidate = m
    candidateCount = 1
  }
  if (candidateCount >= 2) {
    if (current !== null) noteOff(current, 'mic')
    current = m
    candidate = null
    candidateCount = 0
    noteOn(m, vel, 'mic')
  }
}

function tickChords(rms: number, sampleRate: number) {
  const onset = rms > lastRms * 1.7 && rms > gate() * 4
  lastRms = rms
  if (onset) {
    // A new strike: drop the old chord and give the long analysis window a moment to fill with the new one.
    releaseChord()
    holdoff = 4
    return
  }
  if (holdoff > 0) {
    holdoff--
    return
  }
  let heard: number[] = []
  if (rms >= gate() && big && specBuf) {
    big.getFloatFrequencyData(specBuf)
    const mag = new Float32Array(specBuf.length)
    for (let k = 0; k < specBuf.length; k++) mag[k] = Number.isFinite(specBuf[k]) ? Math.pow(10, specBuf[k] / 20) : 0
    heard = estimatePitches(mag, sampleRate).map((d) => d.midi)
  }
  const now = new Set(heard)
  for (const m of now) {
    seen.set(m, (seen.get(m) ?? 0) + 1)
    missing.delete(m)
  }
  for (const m of [...seen.keys()]) if (!now.has(m)) seen.delete(m)
  // A note turns on once it's been heard twice in a row, and off after three misses.
  for (const [m, n] of seen) {
    if (n >= 2 && !sounding.has(m)) {
      sounding.add(m)
      noteOn(m, 0.6, 'mic')
    }
  }
  for (const m of [...sounding]) {
    if (now.has(m)) continue
    const n = (missing.get(m) ?? 0) + 1
    missing.set(m, n)
    if (n >= 3) {
      sounding.delete(m)
      missing.delete(m)
      noteOff(m, 'mic')
    }
  }
}

/** McLeod Pitch Method: normalised square difference, first strong peak, parabolic refinement. */
export function detectPitch(buf: Float32Array, sampleRate: number): { freq: number; clarity: number } | null {
  const n = buf.length
  const maxLag = Math.min(Math.floor(sampleRate / 55), Math.floor(n / 2))
  const minLag = Math.floor(sampleRate / 2200)
  const nsdf = new Float32Array(maxLag)
  for (let tau = 0; tau < maxLag; tau++) {
    let acf = 0
    let m = 0
    for (let i = 0; i < n - tau; i++) {
      const a = buf[i]
      const b = buf[i + tau]
      acf += a * b
      m += a * a + b * b
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0
  }
  const peaks: number[] = []
  let inPositive = false
  let bestIdx = -1
  for (let tau = 1; tau < maxLag - 1; tau++) {
    if (nsdf[tau - 1] <= 0 && nsdf[tau] > 0) {
      inPositive = true
      bestIdx = -1
    } else if (nsdf[tau - 1] > 0 && nsdf[tau] <= 0) {
      if (inPositive && bestIdx > 0) peaks.push(bestIdx)
      inPositive = false
    }
    if (inPositive && tau >= minLag && (bestIdx < 0 || nsdf[tau] > nsdf[bestIdx])) bestIdx = tau
  }
  // Low notes: the last peak may still be rising when the window ends.
  if (inPositive && bestIdx > 0) peaks.push(bestIdx)
  if (!peaks.length) return null
  const highest = Math.max(...peaks.map((p) => nsdf[p]))
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * highest) ?? peaks[0]
  const x0 = nsdf[chosen - 1]
  const x1 = nsdf[chosen]
  const x2 = nsdf[chosen + 1]
  const denom = x0 - 2 * x1 + x2
  const shift = denom !== 0 ? (x0 - x2) / (2 * denom) : 0
  return { freq: sampleRate / (chosen + shift), clarity: x1 }
}

/**
 * Developer test only (#/dev/mic): analyse an audio node instead of the microphone. Returns a function that
 * runs one analysis step, so tests don't depend on timers (which background tabs slow down).
 */
export function attachTestInput(node: AudioNode): () => void {
  const ctx = node.context
  small = ctx.createAnalyser()
  small.fftSize = 2048
  big = ctx.createAnalyser()
  big.fftSize = 16384
  big.smoothingTimeConstant = 0
  node.connect(small)
  node.connect(big)
  timeBuf = new Float32Array(small.fftSize)
  specBuf = new Float32Array(big.frequencyBinCount)
  testing = true
  useLive.setState({ mic: 'on' })
  return tick
}

