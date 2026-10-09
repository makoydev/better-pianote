import { describe, expect, it } from 'vitest'
import { detectPitch } from './mic'

/** A piano-ish tone: fundamental plus decaying harmonics. */
function tone(freq: number, sampleRate = 48000, n = 2048) {
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    let v = 0
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * freq * h * t + h) / (h * 1.4)
    buf[i] = v * 0.3
  }
  return buf
}

const toMidi = (f: number) => Math.round(69 + 12 * Math.log2(f / 440))

describe('pitch detection', () => {
  it.each([
    ['A4', 440, 69],
    ['Middle C', 261.63, 60],
    ['C2 (lowest CT-S1 key)', 65.41, 36],
    ['G5', 783.99, 79],
    ['C7 (highest CT-S1 key)', 2093, 96],
  ])('hears %s', (_, freq, midi) => {
    const p = detectPitch(tone(freq as number), 48000)
    expect(p).not.toBeNull()
    expect(toMidi(p!.freq)).toBe(midi)
  })
})
