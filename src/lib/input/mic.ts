import { useLive } from '../../state/live'
import { audio } from '../audio/engine'
import { noteOff, noteOn } from './bus'

/**
 * Microphone input for devices without Web MIDI (iPad, Safari): listens to your keyboard's speakers
 * and detects one note at a time with the McLeod Pitch Method. Chords can be played one note at a time.
 */

let stream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let buf: Float32Array<ArrayBuffer> | null = null
let timer = 0
let current: number | null = null
let candidate: number | null = null
let candidateCount = 0
let silent = 0
let lastRms = 0

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
  analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  src.connect(analyser)
  buf = new Float32Array(analyser.fftSize)
  timer = window.setInterval(tick, 35)
  useLive.setState({ mic: 'on' })
  return true
}

export function stopMic() {
  window.clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  analyser = null
  release()
  useLive.setState({ mic: 'off', micLevel: 0 })
}

function release() {
  if (current !== null) noteOff(current, 'mic')
  current = null
  candidate = null
  candidateCount = 0
}

function tick() {
  const ctx = audio.ctx
  if (!analyser || !buf || !ctx) return
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  const rms = Math.sqrt(sum / buf.length)
  useLive.setState({ micLevel: Math.min(1, rms * 10) })
  // Ignore the app's own sounds coming back through the mic.
  if (ctx.currentTime < audio.busyUntil) {
    release()
    lastRms = rms
    return
  }
  if (rms < 0.01) {
    if (++silent > 3) release()
    lastRms = rms
    return
  }
  silent = 0
  const p = detectPitch(buf, ctx.sampleRate)
  const onset = rms > lastRms * 1.7 && rms > 0.03
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
