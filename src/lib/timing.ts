import { mod } from './theory'

/**
 * Playing in time: notes due at set moments after a count-in (a scale with a note on each click, a lesson's
 * rhythm, a song you play along with), each judged early or late like Rhythm Tap's taps (pure). Times are on the
 * audio clock as you heard it, in seconds.
 */

export type Verdict = 'perfect' | 'good' | 'early' | 'late' | 'wrong' | 'miss' | 'oneHand'

/** Rhythm Tap's grades: within 45 ms is perfect, within 90 ms good; further off is early or late. */
export const PERFECT = 0.045
export const GOOD = 0.09

const EPS = 1e-6

export interface Target {
  /** The note's pitch class, and its exact keys (one per hand) for when octaves must match. */
  pc: number
  midis: number[]
  /**
   * When it's due, in beats after the first beat (default: a note on each beat, so its place in the list). Notes
   * due together are a chord: each is judged on its own, and the gaps around them are to the moments either side.
   */
  at?: number
  /**
   * Notes in different lanes (a song's two hands) keep their own rhythm: a note's windows are sized by the gaps to
   * the notes of its own lane, so a busy left hand doesn't squeeze the right hand's.
   */
  lane?: number
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
  /**
   * A wrong note near a note makes that note a slip (a scale, a lesson's rhythm: you played something else). Off for
   * a song, where each written note is judged on its timing alone and wrong notes are only counted (`extras`).
   */
  slips?: boolean
}

/**
 * Audio time and beats from the first beat, for a tempo that can change as the music goes (a song, where − and +
 * work while it plays): a point where each tempo starts. Before the first point the first tempo runs backwards.
 */
export class TempoMap {
  private pts: { time: number; at: number; beat: number }[]

  constructor(t0: number, beat: number) {
    this.pts = [{ time: t0, at: 0, beat }]
  }

  /** From audio time `time`, the moment it's `at` beats in, each beat lasts `beat` seconds. */
  set(time: number, at: number, beat: number) {
    if (Math.abs(this.pts[this.pts.length - 1].beat - beat) < 1e-9) return
    this.pts.push({ time, at, beat })
  }

  /** The point in force at a time (key 'time') or a beat (key 'at'). */
  private from(key: 'time' | 'at', v: number) {
    for (let i = this.pts.length - 1; i > 0; i--) if (this.pts[i][key] <= v) return this.pts[i]
    return this.pts[0]
  }

  /** Beats in, at audio time `time`. */
  beats(time: number) {
    const p = this.from('time', time)
    return p.at + (time - p.time) / p.beat
  }

  /** The audio time `at` beats in. */
  time(at: number) {
    const p = this.from('at', at)
    return p.time + (at - p.at) * p.beat
  }

  /** Seconds per beat, `at` beats in. */
  beat(at: number) {
    return this.from('at', at).beat
  }
}

/**
 * How far from its moment a note can still count for it, as a share of the gap to the neighbouring note (a beat
 * for a scale, half a beat between eighths). A rushed note can reach for the next one; a wrong one only slips on a
 * note it's near. Gaps longer than two beats don't widen the windows any more.
 */
const NEAR = 0.5
const REACH = 0.75
const MAX_GAP = 2
/** A gap longer than any that matters (no note of the lane nearby, but the run goes on). */
const FAR = 1e6

export class RunJudge {
  readonly results: StepResult[] = []
  /** Notes that belonged to no note of the run. */
  extras = 0
  private plan: RunPlan
  private targets: Target[] = []
  private tempo: TempoMap
  /** Every note before this one has been judged. */
  private open = 0

  constructor(plan: RunPlan, tempo = new TempoMap(plan.t0, plan.beat)) {
    this.plan = plan
    this.tempo = tempo
    this.add(plan.targets)
  }

  /** More notes to judge, due after the ones it has (a song's next time round a loop). */
  add(targets: Target[]) {
    for (const t of targets) {
      this.targets.push(t)
      this.results.push({ verdict: null, error: null, hits: [], slip: false, mic: false, held: null })
    }
  }

  /** Beats from the first beat to note k. */
  private pos(k: number) {
    return this.targets[k].at ?? k
  }

  timeOf(k: number) {
    return this.tempo.time(this.pos(k))
  }

  /**
   * Beats to the nearest notes of the same lane due at another moment, before and after note k: Infinity at either
   * end of the run, and FAR when its lane has none within MAX_GAP (no need to look further).
   */
  private around(k: number): [number, number] {
    const p = this.pos(k)
    const lane = this.targets[k].lane ?? 0
    const gap = (dir: 1 | -1) => {
      for (let i = k + dir; i >= 0 && i < this.targets.length; i += dir) {
        const g = dir * (this.pos(i) - p)
        if (g > MAX_GAP + EPS) return FAR
        if (g > EPS && (this.targets[i].lane ?? 0) === lane) return g
      }
      return Infinity
    }
    return [gap(-1), gap(1)]
  }

  /** Beats to the note before and after (a beat at either end of the run). */
  private gaps(k: number): [number, number] {
    const [before, after] = this.around(k)
    return [Math.min(MAX_GAP, Number.isFinite(before) ? before : 1), Math.min(MAX_GAP, Number.isFinite(after) ? after : 1)]
  }

  /** Is a note `d` beats from note k's moment (minus = before it) within `share` of the gap on that side? */
  private within(k: number, d: number, share: number) {
    const [before, after] = this.gaps(k)
    return d < 0 ? -d <= share * before : d <= share * after
  }

  /** The notes a note played `at` beats in could be for (the furthest any reaches is REACH × MAX_GAP). */
  private near(at: number): number[] {
    const reach = REACH * MAX_GAP + EPS
    let lo = 0
    let hi = this.targets.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.pos(mid) < at - reach) lo = mid + 1
      else hi = mid
    }
    const out: number[] = []
    for (let k = lo; k < this.targets.length && this.pos(k) <= at + reach; k++) out.push(k)
    return out
  }

  /**
   * Rhythm Tap's window for counting a note as in time: up to 200 ms off, but never more than halfway to the
   * nearest other note (so eighths get a tighter one). Seconds.
   */
  window(k: number) {
    const [before, after] = this.around(k)
    return Math.min(0.2, 0.5 * Math.min(before, after) * this.tempo.beat(this.pos(k)))
  }

  private fits(k: number, midi: number, strict: boolean) {
    const t = this.targets[k]
    return strict ? t.midis.includes(midi) : mod(midi, 12) === t.pc
  }

  /**
   * A note you played. Through the mic only one hand can be heard (and octaves can't be trusted), so one note does,
   * and one note of a chord stands for all of it. `exact` says whether this note must be in the written octave
   * (default: the plan's `strict`). Returns the note it counted for, `'wrong'` for a wrong or stray note, or null
   * when it's ignored (the count-in).
   */
  note(midi: number, time: number, opts: { mic?: boolean; exact?: boolean } = {}): number | 'wrong' | null {
    const n = this.targets.length
    if (!n) return null
    const strict = !opts.mic && (opts.exact ?? this.plan.strict)
    const need = opts.mic ? 1 : this.plan.hands
    const at = this.tempo.beats(time)
    const last = n - 1
    if (!this.within(0, Math.min(0, at - this.pos(0)), REACH) || !this.within(last, Math.max(0, at - this.pos(last)), REACH)) return null
    const d = (k: number) => at - this.pos(k)
    const around = this.near(at).filter((k) => this.within(k, d(k), REACH))
    // The mic can hear a note that's still ringing as a new one (after a click, say): then only a note near its own
    // moment counts, so a repeated note still can.
    const ringing = !!opts.mic && around.some((s) => this.results[s].verdict !== null && this.fits(s, midi, false))
    const open = around.filter((s) => this.results[s].verdict === null && (!ringing || this.within(s, d(s), NEAR)))
    // The right note wins, even a beat early (rushing), before a wrong-note slip. Notes come in order, so of two
    // that fit (a repeated note), the earlier one is still waiting for it.
    const k = open.find((s) => this.fits(s, midi, strict))
    if (k === undefined) {
      if (ringing) return null
      const slipAt = this.plan.slips === false ? undefined : open.filter((s) => this.within(s, d(s), NEAR)).sort((a, b) => Math.abs(d(a)) - Math.abs(d(b)))[0]
      if (slipAt === undefined) this.extras++
      else this.results[slipAt].slip = true
      return 'wrong'
    }
    const r = this.results[k]
    // The same key twice (or the mic hearing it again) is still one hand.
    if (r.hits.some((h) => h.midi === midi)) return null
    const error = time - this.timeOf(k)
    r.hits.push({ midi, error })
    if (opts.mic) r.mic = true
    if (r.hits.length >= need) this.finish(k)
    if (opts.mic) {
      for (const s of open) {
        if (s === k || Math.abs(this.pos(s) - this.pos(k)) > EPS) continue
        this.results[s].hits.push({ midi: this.targets[s].midis[0], error })
        this.results[s].mic = true
        this.finish(s)
      }
    }
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
    const at = this.tempo.beats(now)
    for (let k = this.open; k < this.targets.length; k++) {
      const p = this.pos(k)
      // Not due yet, and nor is anything after it.
      if (p > at) break
      if (this.results[k].verdict !== null || this.within(k, at - p, REACH)) continue
      this.finish(k)
      closed.push(k)
    }
    while (this.open < this.targets.length && this.results[this.open].verdict !== null) this.open++
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
