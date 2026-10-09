/**
 * Hearing chords through a microphone: which piano notes are sounding in a magnitude spectrum.
 *
 * Harmonic summation with iterative cancellation: every candidate note collects the energy at its
 * harmonics; the strongest candidate is accepted, its harmonics are removed from the spectrum, and
 * the search repeats until what's left is too weak. Two guards stop "phantom" notes: a candidate
 * needs real energy at its own fundamental (or, for bass notes small speakers can't reproduce,
 * its 2nd harmonic), and partial amplitudes are smoothed so one strong peak that belongs to
 * another note can't carry a candidate on its own.
 */

export interface DetectedPitch {
  midi: number
  salience: number
}

export interface PolyOptions {
  minMidi: number
  maxMidi: number
  maxNotes: number
  /** A further note must be at least this fraction as strong as the first one. */
  relThreshold: number
  /** Magnitude compression exponent (quieter partials count more). */
  compress: number
  /** Harmonic weight falloff: w(h) = 1 / h^falloff. */
  falloff: number
  maxHarmonics: number
  /** Below this frequency a missing fundamental is tolerated (small speakers). */
  bassHz: number
  /** How much energy the fundamental needs relative to the candidate's strongest partial. */
  fundamental: number
  /** The same for bass notes (below bassHz), whose fundamentals small speakers weaken but rarely remove. */
  fundamentalBass: number
  /** Odd harmonics (3rd, 5th) a missing-fundamental bass note needs, relative to the found note's peak. */
  subOctave: number
  /**
   * How much of a found note's partial to remove: its smooth-envelope prediction times this factor.
   * Large values remove everything (fewer phantom notes); small values leave shared peaks for other notes.
   */
  cancelEnvelope: number
  /** Also require the 7th harmonic before preferring a missing-fundamental bass note. */
  subOctaveH7: boolean
  /** After a bass note (below G3), further notes only need this fraction of the usual threshold. */
  bassRel: number
  /** Developer aid: report partials and salience for these notes into debugOut. */
  debug?: number[]
  debugOut?: { midi: number; amps: number[]; salience: number }[]
}

/** Tuned on real piano recordings (Salamander samples, chords and single notes, with and without a small-speaker filter). */
export const POLY_DEFAULTS: PolyOptions = {
  minMidi: 36,
  maxMidi: 96,
  maxNotes: 6,
  relThreshold: 0.22,
  compress: 0.6,
  falloff: 0.25,
  maxHarmonics: 10,
  bassHz: 140,
  fundamental: 0.15,
  fundamentalBass: 0.04,
  subOctave: 0.35,
  cancelEnvelope: 8,
  subOctaveH7: true,
  bassRel: 1,
}

const freqOf = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
/** Piano strings are slightly inharmonic: partials run a little sharp. */
const partialFreq = (f0: number, h: number) => h * f0 * Math.sqrt(1 + 0.0002 * h * h)

/** `mag` holds linear magnitudes for bins 0 … fftSize/2 − 1. */
export function estimatePitches(mag: Float32Array, sampleRate: number, options: Partial<PolyOptions> = {}): DetectedPitch[] {
  const o = { ...POLY_DEFAULTS, ...options }
  const n = mag.length
  const binHz = sampleRate / (2 * n)
  const fMax = Math.min(5000, sampleRate / 2 - 200)
  const kMax = Math.min(n - 1, Math.ceil(fMax / binHz) + 8)

  // Compress, then subtract a local noise floor (about ±1 semitone) to keep only peaks.
  const comp = new Float32Array(kMax + 1)
  let top = 0
  for (let k = 1; k <= kMax; k++) {
    comp[k] = Math.pow(mag[k], o.compress)
    if (comp[k] > top) top = comp[k]
  }
  if (top <= 0) return []
  const spec = new Float32Array(kMax + 1)
  const prefix = new Float64Array(kMax + 2)
  for (let k = 0; k <= kMax; k++) prefix[k + 1] = prefix[k] + comp[k]
  for (let k = 1; k <= kMax; k++) {
    const w = Math.max(4, Math.round(k * 0.06))
    const a = Math.max(1, k - w)
    const b = Math.min(kMax, k + w)
    const floor = (prefix[b + 1] - prefix[a]) / (b - a + 1)
    spec[k] = Math.max(0, comp[k] - 1.3 * floor) / top
  }

  // The spectrum as it was before any notes were removed (for the octave check below).
  const original = spec.slice()

  const peakNear = (f: number, from: Float32Array = spec) => {
    const k = f / binHz
    const span = Math.max(1, k * 0.012)
    let best = 0
    for (let i = Math.max(1, Math.floor(k - span)); i <= Math.min(kMax, Math.ceil(k + span)); i++) if (from[i] > best) best = from[i]
    return best
  }

  const fundamentalNeeded = (f0: number) => {
    if (f0 <= o.bassHz) return o.fundamentalBass
    const t = Math.min(1, (f0 - o.bassHz) / (330 - o.bassHz))
    return o.fundamentalBass + (o.fundamental - o.fundamentalBass) * t
  }

  const partials = (m: number, from: Float32Array = spec) => {
    const f0 = freqOf(m)
    const amps: number[] = []
    for (let h = 1; h <= o.maxHarmonics; h++) {
      const f = partialFreq(f0, h)
      if (f > fMax) break
      amps.push(peakNear(f, from))
    }
    return amps
  }

  const salienceOf = (m: number) => {
    const f0 = freqOf(m)
    const amps = partials(m)
    if (amps.length < 2) return 0
    const strongest = Math.max(...amps)
    if (strongest <= 0) return 0
    // The note's own fundamental must be there: a chord's harmonics can add up to a "phantom" low note,
    // but that phantom has nothing at its fundamental. Lower piano notes naturally have weaker
    // fundamentals (and small speakers weaken them more), so the requirement eases off below ~330 Hz.
    if (amps[0] < fundamentalNeeded(f0) * strongest) return 0
    // Spectral smoothness: a partial can't be much louder than its neighbours' average.
    let s = 0
    for (let i = 0; i < amps.length; i++) {
      const prev = i > 0 ? amps[i - 1] : amps[i]
      const next = i < amps.length - 1 ? amps[i + 1] : amps[i]
      const smooth = Math.min(amps[i], ((prev + amps[i] + next) / 3) * 1.6)
      s += smooth / Math.pow(i + 1, o.falloff)
    }
    return s
  }

  // Remove a found note's partials, but only as much as its smooth harmonic envelope predicts:
  // a peak shared with another note keeps the extra energy that belongs to that note.
  const cancel = (m: number) => {
    const f0 = freqOf(m)
    const amps = partials(m)
    amps.forEach((a, i) => {
      if (a <= 0) return
      const prev = i > 0 ? amps[i - 1] : amps[i + 1] ?? a
      const next = i < amps.length - 1 ? amps[i + 1] : prev
      const own = Math.min(a, Math.max(prev, next) * o.cancelEnvelope)
      const keep = Math.max(0.05, 1 - own / a)
      const k = partialFreq(f0, i + 1) / binHz
      const span = Math.max(2.5, k * 0.02)
      for (let j = Math.max(1, Math.floor(k - span)); j <= Math.min(kMax, Math.ceil(k + span)); j++) spec[j] *= keep
    })
  }

  // A note with a weak fundamental looks like the note an octave up (its strong 2nd harmonic) plus
  // ghosts at its odd harmonics. If the lower note's own fundamental and odd harmonics are there,
  // the lower note is the real one.
  const preferSubOctave = (m: number) => {
    const low = m - 12
    if (low < o.minMidi) return m
    // Judge on the original spectrum: notes found earlier may share (and have removed) these harmonics.
    const amps = partials(m, original)
    const lowAmps = partials(low, original)
    const ref = Math.max(...amps)
    const odd = (h: number) => (lowAmps[h - 1] ?? 0) >= o.subOctave * ref
    const hasFundamental = (lowAmps[0] ?? 0) >= o.fundamentalBass * ref
    return hasFundamental && odd(3) && odd(5) && (!o.subOctaveH7 || odd(7)) ? low : m
  }

  if (o.debug) for (const m of o.debug) o.debugOut?.push({ midi: m, amps: partials(m).map((a) => Number(a.toFixed(3))), salience: Number(salienceOf(m).toFixed(3)) })

  const found: DetectedPitch[] = []
  let first = 0
  for (let iter = 0; iter < o.maxNotes; iter++) {
    let best = -1
    let bestS = 0
    for (let m = o.minMidi; m <= o.maxMidi; m++) {
      if (found.some((x) => x.midi === m)) continue
      const s = salienceOf(m)
      if (s > bestS) {
        bestS = s
        best = m
      }
    }
    if (best < 0 || bestS <= 0) break
    best = preferSubOctave(best)
    if (iter === 0) first = bestS
    else if (bestS < o.relThreshold * (found[0].midi < 55 ? o.bassRel : 1) * first) break
    found.push({ midi: best, salience: bestS })
    cancel(best)
  }
  return found.sort((a, b) => a.midi - b.midi)
}
