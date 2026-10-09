import { audio } from '../../lib/audio/engine'
import { useSettings } from '../../state/settings'

/** A tiny synthesized drum kit for the Progression Jam, plus a soft tick for metronome subdivisions. */

let out: GainNode | null = null
let noise: AudioBuffer | null = null

function bus(ctx: AudioContext): GainNode {
  if (!out) {
    out = ctx.createGain()
    out.connect(ctx.destination)
  }
  out.gain.value = 0.55 * useSettings.getState().volume
  return out
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

function hush(time: number, len: number) {
  // The microphone input ignores sounds the app makes.
  audio.busyUntil = Math.max(audio.busyUntil, time + len)
}

export function kick(time: number, vel = 1) {
  const ctx = audio.unlock()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.setValueAtTime(140, time)
  o.frequency.exponentialRampToValueAtTime(42, time + 0.14)
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(0.95 * vel, time + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.34)
  o.connect(g).connect(bus(ctx))
  o.start(time)
  o.stop(time + 0.36)
  hush(time, 0.36)
}

export function snare(time: number, vel = 1) {
  const ctx = audio.unlock()
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1900
  bp.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(0.45 * vel, time + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.17)
  src.connect(bp).connect(g).connect(bus(ctx))
  src.start(time)
  src.stop(time + 0.2)
  const body = ctx.createOscillator()
  const bg = ctx.createGain()
  body.type = 'triangle'
  body.frequency.value = 190
  bg.gain.setValueAtTime(0.0001, time)
  bg.gain.exponentialRampToValueAtTime(0.25 * vel, time + 0.003)
  bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.09)
  body.connect(bg).connect(bus(ctx))
  body.start(time)
  body.stop(time + 0.1)
  hush(time, 0.2)
}

export function hat(time: number, vel = 1) {
  const ctx = audio.unlock()
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(0.16 * vel, time + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
  src.connect(hp).connect(g).connect(bus(ctx))
  src.start(time)
  src.stop(time + 0.06)
  hush(time, 0.06)
}

/** Quiet metronome tick for subdivisions between the main beats. */
export function softTick(time: number) {
  const ctx = audio.unlock()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = 2400
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(0.16, time + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.035)
  o.connect(g).connect(bus(ctx))
  o.start(time)
  o.stop(time + 0.05)
  hush(time, 0.05)
}
