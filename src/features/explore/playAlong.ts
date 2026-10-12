import { type Chord, chordPcs, mod } from '../../lib/theory'

/** Playing along with the Jam: which chords you played in time, and how close to beat 1 you came in (pure). */

export type Timing = 'early' | 'on' | 'late'

/** Within this of beat 1 (seconds) counts as on the beat: Rhythm Tap's "good". */
export const ON_TIME = 0.09

/** A chord as the band plays it. Times are on the audio clock, in seconds. */
export interface Span {
  /** Which pass through the progression (0 = the first), and which chord in it. */
  loop: number
  index: number
  /** Beat 1 of the chord. */
  start: number
  /** Pitch classes you need to play, from a keyboard (`need`) or through the mic (`needMic`). */
  need: number[]
  needMic: number[]
  /** All its chord tones: the first of these you play is when you came in. */
  tones: number[]
}

export interface Played {
  loop: number
  index: number
  /** Seconds from beat 1 to your first chord tone (minus = early); null when timing isn't judged. */
  error: number | null
  timing: Timing | null
}

/**
 * What a chord needs before it counts as played: every tone, except the perfect 5th of a seventh chord
 * (pianists leave it out). Through the mic a perfect 5th may also go unheard, so it's never needed there.
 */
export function neededTones(chord: Chord, mic: boolean): number[] {
  const ivs = chord.type.ivs.slice(0, 4)
  const tones = chordPcs({ ...chord, bass: undefined }).slice(0, 4)
  const fifth = ivs.findIndex((iv) => iv.num === 5 && iv.semis === 7)
  if (fifth < 0 || (tones.length < 4 && !mic)) return tones
  return tones.filter((_, i) => i !== fifth)
}

/** Notes this long before a chord comes in already count for it: you see it coming and move early. */
export const earlyGrace = (beatSec: number) => Math.min(0.2, beatSec * 0.4)

export const timingOf = (error: number): Timing => (Math.abs(error) <= ON_TIME ? 'on' : error < 0 ? 'early' : 'late')

/**
 * Follows the band chord by chord and your notes as they come. Like the lessons' progression player, a chord counts
 * once the keys you hold at one moment make it; a key held on from the chord before can help (C → Am keeping C and
 * E), but something has to be struck during the chord, so a repeated chord has to be played again.
 */
export class ChordJudge {
  private spans: Span[] = []
  private done = new Map<Span, Played>()
  /** When each key (MIDI) was last struck. */
  private lastOn = new Map<number, number>()
  private grace: number

  constructor(grace = 0.2) {
    this.grace = grace
  }

  /** The band reached a new chord (scheduled a little ahead, so it can arrive before its beat). */
  add(span: Span) {
    this.spans.push(span)
    if (this.spans.length > 64) this.done.delete(this.spans.shift()!)
  }

  setGrace(seconds: number) {
    this.grace = seconds
  }

  /** The chord a note at `time` belongs to. */
  private spanAt(time: number): Span | null {
    for (let i = this.spans.length - 1; i >= 0; i--) if (time >= this.spans[i].start - this.grace) return this.spans[i]
    return null
  }

  /**
   * A note you played at `time` (the audio clock as you heard it) while `held` (MIDI) were down. `timed` is false
   * through the mic, which hears notes too late to judge the beat. Returns the chord this completed, if any.
   */
  note(midi: number, time: number, held: number[], opts: { mic: boolean; timed: boolean }): Played | null {
    this.lastOn.set(midi, time)
    const span = this.spanAt(time)
    if (!span || this.done.has(span)) return null
    const have = new Set(held.map((m) => mod(m, 12)))
    const need = opts.mic ? span.needMic : span.need
    if (!need.every((p) => have.has(p))) return null
    // You came in with the first chord tone you struck for this chord (not one held on from before).
    const from = span.start - this.grace
    const struck = held
      .filter((m) => span.tones.includes(mod(m, 12)))
      .map((m) => this.lastOn.get(m) ?? time)
      .filter((t) => t >= from)
    if (!struck.length) return null
    const error = Math.min(...struck) - span.start
    const played: Played = { loop: span.loop, index: span.index, error: opts.timed ? error : null, timing: opts.timed ? timingOf(error) : null }
    this.done.set(span, played)
    return played
  }

  /** How a pass through the progression went: chords played, and how many came in on the beat. */
  score(loop: number): { played: number; onTime: number; total: number } {
    const spans = this.spans.filter((s) => s.loop === loop)
    const results = spans.map((s) => this.done.get(s)).filter((p): p is Played => !!p)
    return { played: results.length, onTime: results.filter((p) => p.timing === 'on').length, total: spans.length }
  }

  reset() {
    this.spans = []
    this.done.clear()
    this.lastOn.clear()
  }
}
