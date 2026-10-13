import { describe, expect, it } from 'vitest'
import { type Song, parseBars } from '../../content/songs'
import { AlongSession, alongScore, alongStars, tendency } from './along'
import { barAt, buildSteps, buildTimeline } from './timeline'

const song = (rh: string, lh: string): Song => ({
  id: 't',
  title: 'Test',
  composer: '',
  year: '',
  difficulty: 1,
  keyName: 'C major',
  keySig: 0,
  time: [4, 4],
  bpm: 60,
  tags: [],
  about: '',
  rh: parseBars(rh),
  lh: parseBars(lh),
})

// Right hand: C4 D4 E4 F4 | G4 (rest) | A4, over whole notes in the left hand. At 60 BPM a beat is a second, and the
// music starts at 10 s.
const tl = buildTimeline(song('C4:q D4 E4 F4 | G4:h r:h | A4:w', 'C3:w | G2:w | F2:w'))
const bar = (pos: number) => barAt(tl, pos)
const T0 = 10

/** A run over the whole song (or bars from–to, looping), started at T0. */
function run(hands: 'rh' | 'both', range?: { lo: number; hi: number }) {
  const s = new AlongSession(buildSteps(tl, hands), range ? { from: range.lo, ...range, looping: true } : { from: 0, lo: 0, hi: tl.total, looping: false })
  s.begin(T0, 1)
  return s
}

describe('playing along', () => {
  it('judges each note against its moment and marks it', () => {
    const s = run('rh')
    expect(s.play(60, T0 + 0.02, {}, bar)).toBe(0)
    expect(s.play(62, T0 + 1.15, {}, bar)).toBe(1)
    expect(s.play(64, T0 + 2.4, {}, bar)).toBe(2)
    // F's late window ends ¾ of a beat after it, G's not until 1.5 beats after.
    s.close(T0 + 4.5)
    expect([0, 1, 2, 3, 4].map((k) => s.mark(k))).toEqual(['onBeat', 'close', 'off', 'missed', null])
    expect(s.stats()).toMatchObject({ total: 6, judged: 4, onBeat: 1, late: 1, off: 1, missed: 1, inTime: 2 })
  })

  it('counts wrong notes by bar, but not through the mic', () => {
    const s = run('rh')
    s.play(60, T0, {}, bar)
    expect(s.play(61, T0 + 4.1, {}, bar)).toBe('wrong')
    expect(s.wrongByBar).toEqual({ 1: 1 })
    s.play(66, T0 + 4.2, { mic: true }, bar)
    expect(s.stats().wrong).toBe(1)
    expect(s.slipsByBar()[1]).toBe(1)
  })

  it('ignores the count-in and anything once stopped', () => {
    const s = run('rh')
    expect(s.play(60, T0 - 3, {}, bar)).toBeNull()
    s.play(60, T0, {}, bar)
    s.stop(T0 + 2)
    // Too late now for D: missed. E could still have come: it stays unplayed.
    expect(s.mark(1)).toBe('missed')
    expect(s.mark(2)).toBeNull()
    expect(s.play(64, T0 + 2, {}, bar)).toBeNull()
  })

  it('shows a note two voices share and the note it stands for alike', () => {
    const s = run('both')
    const c3 = tl.notes.find((n) => n.name === 'C3')!
    const k = s.noteFor(c3)!
    expect(s.notes[k].note.name).toBe('C3')
    s.play(48, T0, {}, bar)
    expect(s.mark(k)).toBe('onBeat')
  })

  it('goes round a loop, each time round with its own notes', () => {
    // Bar 1 (beats 4–8): G4, then a rest.
    const s = run('rh', { lo: 4, hi: 8 })
    expect(s.passes.map((p) => p.at)).toEqual([0, 4])
    s.play(67, T0, {}, bar)
    // The next G, a little early across the join.
    expect(s.where(3.9)).toEqual({ pass: 0, pos: 7.9 })
    expect(s.play(67, T0 + 3.9, {}, bar)).toBe(1)
    expect(s.notes[1].pass).toBe(1)
    s.addPass()
    s.show(1)
    expect(s.where(9)).toEqual({ pass: 2, pos: 5 })
    expect(s.finishedPasses()).toEqual([{ pass: 0, score: 1, clean: true, inARow: 1 }])
    expect(s.cleanInARow).toBe(1)
    // Pass 1's note came 100 ms early: not on the beat, but in time, so it's clean too (once the music moves on).
    expect(s.finishedPasses()).toEqual([])
    s.show(2)
    expect(s.finishedPasses()).toEqual([{ pass: 1, score: 1, clean: true, inARow: 2 }])
    expect(s.mark(1)).toBe('close')
    expect(s.passScores).toEqual([1, 1])
  })

  it('sees a pass as clean so far until a note goes wrong', () => {
    const s = run('rh', { lo: 0, hi: 4 })
    s.play(60, T0, {}, bar)
    s.play(62, T0 + 1, {}, bar)
    expect(s.cleanSoFar(0)).toBe(true)
    s.play(63, T0 + 2, {}, bar)
    expect(s.cleanSoFar(0)).toBe(false)
  })

  it('follows a tempo change as it plays', () => {
    const s = run('rh')
    s.play(60, T0, {}, bar)
    // Twice as fast from beat 1 (11 s): E is due at 11.5 s.
    s.tempo!.set(T0 + 1, 1, 0.5)
    s.play(62, T0 + 1, {}, bar)
    expect(s.play(64, T0 + 1.52, {}, bar)).toBe(2)
    expect(s.mark(2)).toBe('onBeat')
  })

  it('keeps the latest timing, streaks and the score', () => {
    const s = run('rh')
    s.play(60, T0 - 0.05, {}, bar)
    s.play(62, T0 + 0.95, {}, bar)
    s.play(64, T0 + 1.96, {}, bar)
    s.close(T0 + 4)
    s.play(67, T0 + 4, {}, bar)
    s.end()
    expect(s.drift()).toBeCloseTo(-0.035)
    expect(s.errors(2).map((e) => Math.round(e * 100) / 100)).toEqual([-0.04, 0])
    // C D E in time, F missed, then G: three in a row at best.
    expect(s.bestStreak()).toBe(3)
    const st = s.stats()
    expect(alongScore(st)).toBeCloseTo(4 / 6)
    expect(alongStars(alongScore(st))).toBe(1)
    expect(tendency(s.drift())).toBe('rushing')
    expect(tendency(0.01)).toBeNull()
  })
})
