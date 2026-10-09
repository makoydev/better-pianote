import { type Chord, chordPcs, detectChord, fromMidi, midiOf, mod, pcOf } from '../theory'

/**
 * Is this the chord, as heard through the mic? Microphones often miss a chord's perfect 5th (it hides in
 * the root's own overtones), so that one tone may be missing. Nothing outside the chord is allowed, and
 * octaves don't matter. Diminished and augmented chords stay strict: their 5th is what makes them.
 */
export function micHearsChord(midis: number[], chord: Chord): boolean {
  if (midis.length === 0) return false
  const tones = chordPcs(chord)
  const want = new Set(tones)
  const heard = new Set(midis.map((m) => mod(m, 12)))
  for (const p of heard) if (!want.has(p)) return false
  const missing = tones.filter((p) => !heard.has(p))
  const fifth = mod(pcOf(chord.root) + 7, 12)
  if (missing.length > 1 || (missing.length === 1 && missing[0] !== fifth)) return false
  // Inversions: the lowest heard note must be the bass note asked for.
  if (chord.bass && mod(Math.min(...midis), 12) !== pcOf(chord.bass)) return false
  return true
}

/** The same check for a lesson target given as MIDI notes (any octave). */
export function micHearsNotes(midis: number[], targetMidis: number[], bassMidi?: number): boolean {
  if (midis.length === 0 || targetMidis.length === 0) return false
  const det = detectChord(targetMidis)
  if (det) return micHearsChord(midis, { ...det.chord, bass: bassMidi === undefined ? undefined : fromMidi(bassMidi) })
  // Not a named chord (e.g. two notes): every note name must be heard, and nothing else.
  const want = new Set(targetMidis.map((m) => mod(m, 12)))
  const heard = new Set(midis.map((m) => mod(m, 12)))
  return want.size === heard.size && [...want].every((p) => heard.has(p))
}

/**
 * Name a chord heard through the mic. Like detectChord, but a root plus its 3rd (the mic often misses
 * the 5th) is read as the full major or minor chord. `fifthGuessed` says when that happened.
 */
export function nameHeardChord(midis: number[], prefer?: 'sharp' | 'flat') {
  const sorted = [...new Set(midis)].sort((a, b) => a - b)
  const det = sorted.length >= 2 ? detectChord(sorted, prefer) : null
  if (det || new Set(sorted.map((m) => mod(m, 12))).size !== 2) return det ? { det, fifthGuessed: false } : null
  const third = mod(sorted[sorted.length - 1] - sorted[0], 12)
  if (third !== 3 && third !== 4) return null
  const guess = detectChord([...sorted, sorted[0] + 7], prefer)
  if (!guess) return null
  // Report only the notes actually heard.
  return { det: { ...guess, notes: guess.notes.filter((n) => sorted.includes(midiOf(n))) }, fifthGuessed: true }
}
