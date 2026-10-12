import { mod } from '../../lib/theory'

/**
 * A scale played in time: one note on each click after a count-in, each judged early or late like Rhythm Tap's taps
 * (pure). Times are on the audio clock as you heard it, in seconds.
 */

export type Verdict = 'perfect' | 'good' | 'early' | 'late' | 'wrong' | 'miss' | 'oneHand'

/** Rhythm Tap's grades: within 45 ms is perfect, within 90 ms good; further off is early or late. */
export const PERFECT = 0.045
export const GOOD = 0.09

export interface Target {
  /** The note's pitch class, and its exact keys (one per hand) for when octaves must match. */
  pc: number
  midis: number[]
}

export interface StepResult {
  verdict: Verdict | null
  /** The hand furthest off the beat (seconds, minus = early); null until played. */
  error: number | null
  hits: { midi: number; error: number }[]
  /** A wrong note was played for this step. */
  slip: boolean
  /** Heard through the mic, where one note stands for both hands. */
  mic: boolean
}

export interface RunPlan {
  /** Beat of the first note. */
  t0: number
  /** Seconds per note (one per click). */
  beat: number
  targets: Target[]
  /** Keys each note needs: 2 with hands together. */
  hands: 1 | 2
  /** Only the written octave counts (Settings: exact octave). */
  strict: boolean
}

/** How far from its beat (in beats) a note can still count for it. A rushed note can reach for the next one. */
const NEAR = 0.5
const REACH = 0.75

export class RunJudge {
  readonly results: StepResult[]
  /** Notes that belonged to no note of the scale. */
  extras = 0
  private plan: RunPlan

  constructor(plan: RunPlan) {
    this.plan = plan
    this.results = plan.targets.map(() => ({ verdict: null, error: null, hits: [], slip: false, mic: false }))
  }

  timeOf(k: number) {
    return this.plan.t0 + k * this.plan.beat
  }

  private fits(k: number, midi: number, strict: boolean) {
    const t = this.plan.targets[k]
    return strict ? t.midis.includes(midi) : mod(midi, 12) === t.pc
  }

  /**
   * A note you played. Through the mic only one hand can be heard (and octaves can't be trusted), so one note does.
   * Returns the step it counted for, `'wrong'` for a wrong or stray note, or null when it's ignored (the count-in).
   */
  note(midi: number, time: number, opts: { mic?: boolean } = {}): number | 'wrong' | null {
    const { beat, targets } = this.plan
    const strict = this.plan.strict && !opts.mic
    const need = opts.mic ? 1 : this.plan.hands
    const at = (time - this.plan.t0) / beat
    if (at < -REACH || at > targets.length - 1 + REACH) return null
    const around = [Math.floor(at), Math.ceil(at)].filter((k, i, a) => k >= 0 && k < targets.length && a.indexOf(k) === i && Math.abs(at - k) <= REACH)
    // The mic can hear a note that's still ringing as a new one (after a click, say): that's not a wrong note.
    if (opts.mic && around.some((s) => this.results[s].verdict !== null && this.fits(s, midi, false))) return null
    // Still-open notes near this moment: the right one wins, even a beat early (rushing), before a wrong-note slip.
    const near = around.filter((s) => this.results[s].verdict === null).sort((a, b) => Math.abs(at - a) - Math.abs(at - b))
    const k = near.find((s) => this.fits(s, midi, strict))
    if (k === undefined) {
      const slipAt = near.find((s) => Math.abs(at - s) <= NEAR)
      if (slipAt === undefined) this.extras++
      else this.results[slipAt].slip = true
      return 'wrong'
    }
    const r = this.results[k]
    // The same key twice (or the mic hearing it again) is still one hand.
    if (r.hits.some((h) => h.midi === midi)) return null
    r.hits.push({ midi, error: time - this.timeOf(k) })
    if (opts.mic) r.mic = true
    if (r.hits.length >= need) this.finish(k)
    return k
  }

  private finish(k: number) {
    const r = this.results[k]
    const worst = r.hits.reduce<number | null>((w, h) => (w === null || Math.abs(h.error) > Math.abs(w) ? h.error : w), null)
    r.error = worst
    if (r.slip) r.verdict = 'wrong'
    else if (worst === null) r.verdict = 'miss'
    else if (r.hits.length < this.plan.hands && !r.mic) r.verdict = 'oneHand'
    else r.verdict = Math.abs(worst) <= PERFECT ? 'perfect' : Math.abs(worst) <= GOOD ? 'good' : worst < 0 ? 'early' : 'late'
  }

  /** Judge every note whose time has passed (now = the audio clock as heard). Returns the steps that just closed. */
  close(now: number): number[] {
    const closed: number[] = []
    this.results.forEach((r, k) => {
      if (r.verdict !== null || now < this.timeOf(k) + REACH * this.plan.beat) return
      this.finish(k)
      closed.push(k)
    })
    return closed
  }

  get finished() {
    return this.results.every((r) => r.verdict !== null)
  }

  summary() {
    const count = (...v: Verdict[]) => this.results.filter((r) => r.verdict !== null && v.includes(r.verdict)).length
    const onTime = count('perfect', 'good')
    const early = count('early')
    const late = count('late')
    const wrong = count('wrong')
    const missed = count('miss', 'oneHand')
    const total = this.results.length
    return {
      onTime,
      early,
      late,
      wrong,
      missed,
      total,
      clean: onTime === total && this.extras === 0,
      errors: this.results.flatMap((r) => r.hits.map((h) => h.error)),
    }
  }
}

/** Best clean tempo per scale run, kept in "scale:best-bpm": a scale, hands, octaves and direction → BPM. */
export const bestKey = (pc: number, typeId: string, hands: string, octaves: number, upDown: boolean) => `${pc}:${typeId}:${hands}:${octaves}:${upDown ? 'up-down' : 'up'}`

/** Best tempos read back from prefs: only sensible numbers survive. */
export function readBests(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, bpm] of Object.entries(v)) if (typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= 20 && bpm <= 400) out[k] = Math.round(bpm)
  return out
}
