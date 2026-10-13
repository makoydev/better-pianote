import { mod } from '../../lib/theory'
import { RunJudge, TempoMap, type Target } from '../../lib/timing'
import { PASSES_SHOWN } from './practice'
import type { Step, TimedNote } from './timeline'

/**
 * Play along: the music moves at your tempo and every note you play is judged early or late (the lessons' judge),
 * once through or round and round a loop. Each time round has its own notes, one after another in beats from where
 * you started, so a note played a little early across the join still finds the right pass.
 */

const EPS = 1e-6

/** Where a run starts (the top, the loop's start or a bar you chose) and the part that plays: [lo, hi) in beats. */
export interface AlongRange {
  from: number
  lo: number
  hi: number
  looping: boolean
}

/** How a note went: on the beat (green), in time but a little early or late (amber), too far off or missed (red). */
export type NoteMark = 'onBeat' | 'close' | 'off' | 'missed'

export interface AlongStats {
  /** Notes to play, and how many have been judged so far. */
  total: number
  judged: number
  onBeat: number
  /** In time, but a little early or late. */
  early: number
  late: number
  /** Played, but too far from their moment to count. */
  off: number
  missed: number
  /** Keys that were no note of the music. */
  wrong: number
  /** On the beat or a little off. */
  inTime: number
}

/** The score for a run or a pass: notes in time, with each wrong note counting against it (as in Practice). */
export const alongScore = (s: AlongStats) => (s.total + s.wrong ? s.inTime / (s.total + s.wrong) : 0)

/** 95 % in time = 3 stars, 80 % = 2, any note in time = 1. */
export const alongStars = (score: number) => (score >= 0.95 ? 3 : score >= 0.8 ? 2 : score > 0 ? 1 : 0)

/** Rushing or dragging on the whole (notes 30 ms or more early or late on average), else null. */
export const tendency = (mean: number | null): 'rushing' | 'dragging' | null =>
  mean === null ? null : mean <= -0.03 ? 'rushing' : mean >= 0.03 ? 'dragging' : null

/** Each time round: its first note, where it starts (beats from the start) and the wrong notes played in it. */
interface Pass {
  first: number
  at: number
  wrong: number
}

const keyOf = (start: number, midi: number) => Math.round(start * 1000) * 128 + midi

export class AlongSession {
  readonly range: AlongRange
  private readonly steps: Step[]
  /** The written note behind each note to play, and the time round it belongs to. */
  readonly notes: { note: TimedNote; pass: number }[] = []
  readonly passes: Pass[] = []
  /** Wrong notes in each bar (by index), every time round. */
  readonly wrongByBar: Record<number, number> = {}
  /** Judging starts with the music (`begin`), so notes during the count-in are ignored. */
  judge: RunJudge | null = null
  tempo: TempoMap | null = null
  /** Stopped or finished: how it went stays on the music, but nothing more is judged. */
  over = false
  /** The time round on screen (0 = the first). */
  shown = 0
  /** Looping: the latest passes' scores (oldest first) and clean passes in a row. */
  passScores: number[] = []
  cleanInARow = 0
  private judgedPasses = 0
  private byKey = new Map<number, number>()
  private pending: Target[] = []

  /** `steps`: what your hands play in the whole song (Practice's steps), in order. */
  constructor(steps: Step[], range: AlongRange) {
    this.steps = steps
    this.range = range
    this.addPass()
    // Looping, the next time round is ready too, for a note that comes a little early across the join.
    if (range.looping) this.addPass()
    this.show(0)
  }

  /** Where pass p starts: beats from the start, and the moment of the song. */
  private passStart(p: number) {
    const { from, lo, hi } = this.range
    return p === 0 ? { at: 0, pos: from } : { at: hi - from + (p - 1) * (hi - lo), pos: lo }
  }

  /** The next time round: its notes, from where it starts to the end of the part. */
  addPass() {
    const p = this.passes.length
    const { at, pos } = this.passStart(p)
    const targets: Target[] = []
    this.passes.push({ first: this.notes.length, at, wrong: 0 })
    for (const s of this.steps) {
      if (s.start < pos - EPS || s.start >= this.range.hi - EPS) continue
      for (const n of s.notes) {
        targets.push({ pc: mod(n.midi, 12), midis: [n.midi], at: at + s.start - pos, lane: n.hand === 'lh' ? 1 : 0 })
        this.notes.push({ note: n, pass: p })
      }
    }
    if (this.judge) this.judge.add(targets)
    else this.pending.push(...targets)
  }

  /** The music starts at audio time t0, with a beat lasting `beat` seconds: judging begins. */
  begin(t0: number, beat: number) {
    this.tempo = new TempoMap(t0, beat)
    this.judge = new RunJudge({ t0, beat, hands: 1, strict: true, slips: false, targets: this.pending }, this.tempo)
    this.pending = []
  }

  /** Beats from the start → the time round it is and the moment of the song. */
  where(at: number): { pass: number; pos: number } {
    const { from, lo, hi, looping } = this.range
    const first = hi - from
    if (!looping || at < first || hi - lo < EPS) return { pass: 0, pos: Math.min(hi, from + Math.max(0, at)) }
    const k = Math.floor((at - first) / (hi - lo))
    return { pass: k + 1, pos: lo + (at - first - k * (hi - lo)) }
  }

  /**
   * A key you played, heard at audio time `time`: the note it counted for (index), 'wrong', or null when it's
   * ignored (the count-in, after the end, or stopped). Wrong notes are counted by bar (`barOf` a moment), except
   * through the mic, where a stray note is more likely an overtone or a note still ringing.
   */
  play(midi: number, time: number, opts: { mic?: boolean; exact?: boolean }, barOf: (pos: number) => number): number | 'wrong' | null {
    if (this.over || !this.judge || !this.tempo) return null
    const r = this.judge.note(midi, time, opts)
    if (r === 'wrong' && !opts.mic) {
      const { pass, pos } = this.where(this.tempo.beats(time))
      const bar = barOf(pos)
      this.wrongByBar[bar] = (this.wrongByBar[bar] ?? 0) + 1
      if (this.passes[pass]) this.passes[pass].wrong++
    }
    return r
  }

  /** Judge the notes whose moment has passed (`now` as heard); true when any just closed. */
  close(now: number): boolean {
    return !this.over && !!this.judge && this.judge.close(now).length > 0
  }

  /** Stop: notes it's too late to play now are missed; the rest stay unplayed. */
  stop(now: number) {
    if (this.judge && !this.over) this.judge.close(now)
    this.over = true
  }

  /** The end of the run: every note is judged. */
  end() {
    this.judge?.close(Infinity)
    this.over = true
  }

  /** Show time round p on the music. */
  show(p: number) {
    this.shown = p
    this.byKey.clear()
    const pass = this.passes[p]
    if (!pass) return
    const end = this.passes[p + 1]?.first ?? this.notes.length
    for (let k = pass.first; k < end; k++) this.byKey.set(keyOf(this.notes[k].note.start, this.notes[k].note.midi), k)
  }

  /** The note on screen that a written note is (two voices sharing a key are one note). */
  noteFor(n: TimedNote): number | undefined {
    return this.byKey.get(keyOf(n.start, n.midi))
  }

  mark(k: number): NoteMark | null {
    const j = this.judge
    const r = j?.results[k]
    if (!j || !r || r.verdict === null) return null
    if (r.verdict === 'miss' || r.verdict === 'oneHand' || r.verdict === 'wrong') return 'missed'
    if (!j.inTime(k)) return 'off'
    return r.verdict === 'perfect' || r.verdict === 'good' ? 'onBeat' : 'close'
  }

  /** Has note k been judged? */
  judged(k: number) {
    return this.mark(k) !== null
  }

  /** Note indexes of time round p (all of them when p is left out). */
  private span(p?: number): [number, number] {
    if (p === undefined) return [0, this.notes.length]
    return [this.passes[p]?.first ?? this.notes.length, this.passes[p + 1]?.first ?? this.notes.length]
  }

  /** How time round p went (the whole run when p is left out). */
  stats(p?: number): AlongStats {
    const s: AlongStats = { total: 0, judged: 0, onBeat: 0, early: 0, late: 0, off: 0, missed: 0, wrong: 0, inTime: 0 }
    const [a, b] = this.span(p)
    for (let k = a; k < b; k++) {
      s.total++
      const m = this.mark(k)
      if (!m) continue
      s.judged++
      if (m === 'onBeat') s.onBeat++
      else if (m === 'close') {
        if ((this.judge?.results[k].error ?? 0) < 0) s.early++
        else s.late++
      } else if (m === 'off') s.off++
      else s.missed++
    }
    s.inTime = s.onBeat + s.early + s.late
    s.wrong = p === undefined ? this.passes.reduce((n, x) => n + x.wrong, 0) : (this.passes[p]?.wrong ?? 0)
    return s
  }

  /** How far off the notes you played were (seconds, minus = early): the latest `last` of them, or all. */
  errors(last = Infinity): number[] {
    const out: number[] = []
    const results = this.judge?.results ?? []
    for (let k = results.length - 1; k >= 0 && out.length < last; k--) {
      const r = results[k]
      if (r.error !== null && r.verdict !== 'miss') out.push(r.error)
    }
    return out.reverse()
  }

  /** On average, how early (minus) or late your latest notes were, in seconds (each counted up to 300 ms off). */
  drift(last = 8): number | null {
    const e = this.errors(last)
    return e.length ? e.reduce((n, x) => n + Math.max(-0.3, Math.min(0.3, x)), 0) / e.length : null
  }

  /** The most notes in a row played in time. */
  bestStreak(): number {
    let best = 0
    let run = 0
    for (let k = 0; k < this.notes.length; k++) {
      const m = this.mark(k)
      if (!m) continue
      run = m === 'onBeat' || m === 'close' ? run + 1 : 0
      best = Math.max(best, run)
    }
    return best
  }

  /** Notes off the beat or missed, and wrong notes, in each bar (by index): where the run went wrong. */
  slipsByBar(): Record<number, number> {
    const out: Record<number, number> = { ...this.wrongByBar }
    this.notes.forEach(({ note }, k) => {
      const m = this.mark(k)
      if (m === 'off' || m === 'missed') out[note.bar] = (out[note.bar] ?? 0) + 1
    })
    return out
  }

  /**
   * Looping: so far this time round, every note judged is in time and nothing wrong was played (notes still to come
   * are given the benefit of the doubt). Speeding up after a clean pass asks this as the pass ends.
   */
  cleanSoFar(p: number): boolean {
    const s = this.stats(p)
    return s.judged > 0 && s.inTime === s.judged && s.wrong === 0
  }

  /**
   * Looping: the passes now judged all the way round since last asked (each once, oldest first), with their scores.
   * Only passes whose every note has been judged, and that the music has left.
   */
  finishedPasses(): { pass: number; score: number; clean: boolean; inARow: number }[] {
    const out: { pass: number; score: number; clean: boolean; inARow: number }[] = []
    while (this.judgedPasses < this.shown) {
      const p = this.judgedPasses
      const [a, b] = this.span(p)
      for (let k = a; k < b; k++) if (!this.judged(k)) return out
      this.judgedPasses++
      const s = this.stats(p)
      const score = alongScore(s)
      const clean = s.total > 0 && s.inTime === s.total && s.wrong === 0
      this.passScores = [...this.passScores, score].slice(-PASSES_SHOWN)
      this.cleanInARow = clean ? this.cleanInARow + 1 : 0
      out.push({ pass: p, score, clean, inARow: this.cleanInARow })
    }
    return out
  }
}
