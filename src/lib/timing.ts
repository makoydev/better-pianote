import { mod } from './theory'

/**
 * Playing in time: notes due at set moments after a count-in (a scale with a note on each click, a lesson's
 * rhythm), each judged early or late like Rhythm Tap's taps (pure). Times are on the audio clock as you heard it,
 * in seconds.
 */

export type Verdict = 'perfect' | 'good' | 'early' | 'late' | 'wrong' | 'miss' | 'oneHand'

/** Rhythm Tap's grades: within 45 ms is perfect, within 90 ms good; further off is early or late. */
export const PERFECT = 0.045
export const GOOD = 0.09

export interface Target {
  /** The note's pitch class, and its exact keys (one per hand) for when octaves must match. */
  pc: number
  midis: number[]
  /** When it's due, in beats after the first beat (default: a note on each beat, so its place in the list). */
  at?: number
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
  /** Seconds the key stayed down, once it's let go (null while it's still held, or when nobody can tell). */
  held: number | null
}

export interface RunPlan {
  /** Audio time of the first beat. */
  t0: number
  /** Seconds per beat. */
  beat: number
  targets: Target[]
  /** Keys each note needs: 2 with hands together. */
  hands: 1 | 2
  /** Only the written octave counts (Settings: exact octave). */
  strict: boolean
}

/**
 * How far from its moment a note can still count for it, as a share of the gap to the neighbouring note (a beat
 * for a scale, half a beat between eighths). A rushed note can reach for the next one; a wrong one only slips on a
 * note it's near. Gaps longer than two beats don't widen the windows any more.
 */
const NEAR = 0.5
const REACH = 0.75
const MAX_GAP = 2

export class RunJudge {
  readonly results: StepResult[]
  /** Notes that belonged to no note of the run. */
  extras = 0
  private plan: RunPlan

  constructor(plan: RunPlan) {
    this.plan = plan
    this.results = plan.targets.map(() => ({ verdict: null, error: null, hits: [], slip: false, mic: false, held: null }))
  }

  /** Beats from the first beat to note k. */
  private pos(k: number) {
    return this.plan.targets[k].at ?? k
  }

  timeOf(k: number) {
    return this.plan.t0 + this.pos(k) * this.plan.beat
  }

  /** Beats to the note before and after (a beat at either end of the run). */
  private gaps(k: number): [number, number] {
    const n = this.plan.targets.length
    const before = k > 0 ? this.pos(k) - this.pos(k - 1) : 1
    const after = k < n - 1 ? this.pos(k + 1) - this.pos(k) : 1
    return [Math.min(MAX_GAP, before > 0 ? before : 1), Math.min(MAX_GAP, after > 0 ? after : 1)]
  }

  /** Is a note `d` beats from note k's moment (minus = before it) within `share` of the gap on that side? */
  private within(k: number, d: number, share: number) {
    const [before, after] = this.gaps(k)
    return d < 0 ? -d <= share * before : d <= share * after
  }

  /**
   * Rhythm Tap's window for counting a note as in time: up to 200 ms off, but never more than halfway to the
   * nearest other note (so eighths get a tighter one). Seconds.
   */
  window(k: number) {
    const n = this.plan.targets.length
    const gaps = [k > 0 ? this.pos(k) - this.pos(k - 1) : Infinity, k < n - 1 ? this.pos(k + 1) - this.pos(k) : Infinity]
    return Math.min(0.2, 0.5 * Math.min(...gaps) * this.plan.beat)
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
    const { targets } = this.plan
    const strict = this.plan.strict && !opts.mic
    const need = opts.mic ? 1 : this.plan.hands
    const at = (time - this.plan.t0) / this.plan.beat
    const last = targets.length - 1
    if (!this.within(0, Math.min(0, at - this.pos(0)), REACH) || !this.within(last, Math.max(0, at - this.pos(last)), REACH)) return null
    const d = (k: number) => at - this.pos(k)
    const around = targets.map((_, k) => k).filter((k) => this.within(k, d(k), REACH))
    // The mic can hear a note that's still ringing as a new one (after a click, say): then only a note near its own
    // moment counts, so a repeated note still can.
    const ringing = !!opts.mic && around.some((s) => this.results[s].verdict !== null && this.fits(s, midi, false))
    const open = around.filter((s) => this.results[s].verdict === null && (!ringing || this.within(s, d(s), NEAR)))
    // The right note wins, even a beat early (rushing), before a wrong-note slip. Notes come in order, so of two
    // that fit (a repeated note), the earlier one is still waiting for it.
    const k = open.find((s) => this.fits(s, midi, strict))
    if (k === undefined) {
      if (ringing) return null
      const slipAt = open.filter((s) => this.within(s, d(s), NEAR)).sort((a, b) => Math.abs(d(a)) - Math.abs(d(b)))[0]
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

  /** A key let go (with the pedal up): how long the note it played was held. Returns that note, or null. */
  release(midi: number, time: number): number | null {
    for (let k = this.results.length - 1; k >= 0; k--) {
      const r = this.results[k]
      const hit = r.hits.find((h) => h.midi === midi)
      if (!hit) continue
      if (r.held !== null) return null
      const down = this.timeOf(k) + hit.error
      if (time < down) return null
      r.held = time - down
      return k
    }
    return null
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
      const d = (now - this.timeOf(k)) / this.plan.beat
      if (r.verdict !== null || d < 0 || this.within(k, d, REACH)) return
      this.finish(k)
      closed.push(k)
    })
    return closed
  }

  /** Played, on the right note, and within Rhythm Tap's window of its moment. */
  inTime(k: number) {
    const r = this.results[k]
    return r.verdict !== null && r.error !== null && !['wrong', 'miss', 'oneHand'].includes(r.verdict) && Math.abs(r.error) <= this.window(k) + 1e-9
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
      /** Notes within Rhythm Tap's window (on the beat, or a little early or late). */
      inTime: this.results.filter((_, k) => this.inTime(k)).length,
      extras: this.extras,
      clean: onTime === total && this.extras === 0,
      errors: this.results.flatMap((r) => r.hits.map((h) => h.error)),
    }
  }
}

export type RunSummary = ReturnType<RunJudge['summary']>
