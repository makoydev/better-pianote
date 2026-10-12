import { nameHeardChord } from '../../lib/input/micMatch'
import {
  type Chord,
  type DetectedChord,
  type Key,
  chordLongName,
  chordPcs,
  chordSymbol,
  chordTones,
  detectChord,
  midiOf,
  mod,
  pcOf,
  placeAtMidi,
  spellChordInKey,
} from '../../lib/theory'

/** Without the pedal, a broken chord's notes count until nothing new has been played for this long. */
export const BROKEN_MS = 1500
/** Each released note counts at most this long after it was played (the bass note excepted)… */
const NOTE_MS = 4000
/** …or this long while the pedal holds it. */
const PEDAL_MS = 8000
/** Notes this close together are one attack (a chord struck or rolled), in whatever order they come. */
const ATTACK_MS = 90

interface Played {
  midi: number
  on: number
  off: number | null
}

/**
 * What you're playing right now, for naming chords: the keys held down, plus notes you've let go of that still
 * belong to the chord, because the sustain pedal keeps them ringing or because you're playing it broken (rolled or
 * arpeggiated, like a left-hand pattern).
 *
 * A new bass note starts the next chord, so the last chord's notes don't mix into it: a note below the chord's
 * second-lowest note, as when a left-hand pattern drops back down for its next chord (going back to the 5th of
 * the same chord doesn't count). Lifting the pedal clears what was ringing. Times are in ms (performance.now()).
 */
export class Sounding {
  private held = new Map<number, number>()
  /** The notes since the chord's bass note, bass first. */
  private group: Played[] = []
  private pedal = false
  private lastOn = Number.NEGATIVE_INFINITY

  noteOn(midi: number, time: number) {
    this.prune(time)
    if (this.isNewBass(midi, time)) this.group = []
    this.group = this.group.filter((n) => n.midi !== midi)
    this.group.push({ midi, on: time, off: null })
    this.held.set(midi, time)
    this.lastOn = time
    this.settle()
  }

  noteOff(midi: number, time: number) {
    this.held.delete(midi)
    const n = this.group.find((x) => x.midi === midi)
    if (n) n.off = time
    this.settle()
  }

  /**
   * Without the pedal, keys held down that make a chord on their own (three or more note names) are the chord:
   * notes let go of before them have stopped sounding, so they don't add to it. Block chords D then A mustn't read
   * as Dmaj9 once you let go. (A broken chord holds a key or two at a time, so its notes still add up.)
   */
  private settle() {
    if (this.pedal || new Set([...this.held.keys()].map((m) => mod(m, 12))).size < 3) return
    this.group = this.group.filter((n) => this.held.has(n.midi))
  }

  setPedal(down: boolean) {
    this.pedal = down
    // Lifting the pedal stops everything you'd already let go of.
    if (!down) this.group = this.group.filter((n) => this.held.has(n.midi))
  }

  get pedalDown() {
    return this.pedal
  }

  /** The keys held down, low to high. */
  heldNotes(): number[] {
    return [...this.held.keys()].sort((a, b) => a - b)
  }

  /** Everything that's part of what you're playing at `time`, low to high. */
  notes(time: number): number[] {
    this.prune(time)
    return [...new Set([...this.held.keys(), ...this.group.map((n) => n.midi)])].sort((a, b) => a - b)
  }

  /** When the notes might next change without any input (a broken chord running out), or null. */
  nextExpiry(time: number): number | null {
    if (!this.group.some((n) => n.off !== null)) return null
    const times = [this.pedal || this.held.size ? Number.POSITIVE_INFINITY : this.lastOn + BROKEN_MS]
    const life = this.pedal ? PEDAL_MS : NOTE_MS
    this.group.forEach((n, i) => {
      if (i > 0 && n.off !== null) times.push(n.on + life)
    })
    const t = Math.min(...times)
    return Number.isFinite(t) && t > time ? t : null
  }

  private isNewBass(midi: number, time: number): boolean {
    if (!this.group.length || time - this.group[0].on <= ATTACK_MS) return false
    const lows = this.group.map((n) => n.midi).sort((a, b) => a - b)
    return midi < (lows[1] ?? lows[0])
  }

  private prune(time: number) {
    // A broken chord is over once nothing has been played for a while (and nothing is held or pedalled).
    if (!this.pedal && !this.held.size && time - this.lastOn > BROKEN_MS) {
      this.group = []
      return
    }
    const life = this.pedal ? PEDAL_MS : NOTE_MS
    this.group = this.group.filter((n, i) => i === 0 || n.off === null || time - n.on <= life)
  }
}

export interface Named {
  det: DetectedChord
  /** Through the mic: a root and 3rd were read as the full chord (the 5th often goes unheard). */
  fifthGuessed: boolean
}

/** A melody above a chord: notes more than an octave and a 5th above the bass. */
const MELODY_ABOVE = 19

/**
 * Name what's sounding. With the pedal down, everything ringing counts. Without it, the keys you hold come first
 * when they make a chord on their own, then the broken chord. When the lot isn't a chord, a melody may be in the
 * way, so the notes near the bass get a try, and then the held keys alone. Notes you've let go of only count
 * towards a chord of three or more notes, so a melody under the pedal doesn't read as intervals and power chords.
 */
export function nameSounding(all: number[], held: number[], opts: { pedal: boolean; prefer?: 'sharp' | 'flat'; mic?: boolean }): Named | null {
  const pcs = (midis: number[]) => new Set(midis.map((m) => mod(m, 12))).size
  const name = (midis: number[]): Named | null => {
    if (pcs(midis) < 2) return null
    if (opts.mic) return nameHeardChord(midis, opts.prefer)
    const det = detectChord(midis, opts.prefer)
    return det ? { det, fifthGuessed: false } : null
  }
  const chordOnly = (midis: number[]) => (pcs(midis) >= 3 ? midis : [])
  const low = all.filter((m) => m - all[0] <= MELODY_ABOVE)
  const tries = opts.pedal ? [chordOnly(all), chordOnly(low), held] : [chordOnly(held), chordOnly(all), chordOnly(low), held]
  for (const t of tries) {
    const n = name(t)
    if (n) return n
  }
  return null
}

/**
 * A named chord spelled for the key (D♯m, not E♭m, in B major), its name and notes following the new letters. A
 * chord named before the key was known keeps up this way.
 */
export function respelled(det: DetectedChord, key: Key | null): DetectedChord {
  const chord = spellChordInKey(det.chord, key)
  if (chord === det.chord) return det
  const tones = chordTones(chord.root, chord.type)
  const notes = det.notes.map((n) => {
    const m = midiOf(n)
    const t = tones.find((x) => pcOf(x) === mod(m, 12))
    return t ? placeAtMidi(t.letter, t.acc, m) : n
  })
  return { ...det, chord, symbol: chordSymbol(chord), name: chordLongName(chord), notes }
}

/** The same chord played the same way: same name and the same keys (C in another octave or voicing isn't). */
export function sameVoicing(a: DetectedChord, b: DetectedChord): boolean {
  return a.symbol === b.symbol && a.notes.length === b.notes.length && a.notes.every((n, i) => midiOf(n) === midiOf(b.notes[i]))
}

/** Every note is one of the chord's tones: a partial arpeggio of it, or its bass struck again. */
export function withinChord(midis: number[], chord: Chord): boolean {
  const pcs = new Set(chordPcs(chord))
  return midis.length > 0 && midis.every((m) => pcs.has(mod(m, 12)))
}
