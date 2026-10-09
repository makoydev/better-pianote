import { describe, expect, it } from 'vitest'
import { midi } from '../theory'
import { estimatePitches } from './polyphony'

const SR = 48000
const BINS = 8192 // a 16384-point FFT

/** A piano-like magnitude spectrum: each note's harmonics as narrow peaks, slightly stretched and decaying. */
function spectrum(notes: string[], opts: { weakBass?: number } = {}) {
  const mag = new Float32Array(BINS)
  const binHz = SR / (2 * BINS)
  for (const n of notes) {
    const f0 = 440 * Math.pow(2, (midi(n) - 69) / 12)
    for (let h = 1; h <= 12; h++) {
      const f = h * f0 * Math.sqrt(1 + 0.0002 * h * h)
      const k = f / binHz
      // Small speakers weaken bass fundamentals (but don't remove them entirely).
      const amp = (1 / Math.pow(h, 1.1)) * (h === 1 && f0 < 110 && opts.weakBass !== undefined ? opts.weakBass : 1)
      for (let i = Math.floor(k - 3); i <= Math.ceil(k + 3); i++) {
        if (i > 0 && i < BINS) mag[i] += amp * Math.exp(-((i - k) ** 2) / 1.2)
      }
    }
  }
  return mag
}

const pcs = (ms: number[]) => [...new Set(ms.map((m) => m % 12))].sort((a, b) => a - b)
const heard = (notes: string[], opts?: { weakBass?: number }) => estimatePitches(spectrum(notes, opts), SR).map((d) => d.midi)

describe('hearing notes and chords from the mic', () => {
  it.each(['C3', 'G3', 'C4', 'E4', 'A4', 'C5', 'G5', 'C6'])('hears a single %s, octave included', (n) => {
    expect(heard([n])).toEqual([midi(n)])
  })

  it.each([
    ['C major', ['C4', 'E4', 'G4']],
    ['A minor', ['A3', 'C4', 'E4']],
    ['F major', ['F3', 'A3', 'C4']],
    ['G7', ['G3', 'B3', 'D4', 'F4']],
  ])('hears %s without inventing notes', (_, notes) => {
    const got = pcs(heard(notes))
    const want = pcs(notes.map(midi))
    // Every heard note belongs to the chord, and at most one chord tone (usually the 5th) is missed.
    expect(got.every((p) => want.includes(p))).toBe(true)
    expect(want.length - got.length).toBeLessThanOrEqual(1)
  })

  it('finds a bass note even when the speaker weakens its fundamental', () => {
    expect(heard(['C2'], { weakBass: 0.05 })).toContain(midi('C2'))
  })

  it("doesn't invent a low 'phantom' root under a chord", () => {
    // G3 B3 D4 are harmonics 2, 5/2, 3 of G2, but G2 itself isn't sounding.
    expect(Math.min(...heard(['G3', 'B3', 'D4']))).toBe(midi('G3'))
  })

  it('hears nothing in silence', () => {
    expect(estimatePitches(new Float32Array(BINS), SR)).toEqual([])
  })
})
