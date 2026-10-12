import { describe, expect, it } from 'vitest'
import { RunJudge, bestKey, readBests } from './scaleTiming'

// C D E F G at 60 BPM (a note a second), the first on the beat at 10 s.
const C_MAJOR = [60, 62, 64, 65, 67]
const plan = (hands: 1 | 2 = 1, strict = false) =>
  new RunJudge({
    t0: 10,
    beat: 1,
    hands,
    strict,
    targets: C_MAJOR.map((m) => ({ pc: m % 12, midis: hands === 2 ? [m, m - 12] : [m] })),
  })

describe('a scale in time', () => {
  it('grades every note on the beat as clean', () => {
    const j = plan()
    C_MAJOR.forEach((m, k) => expect(j.note(m, 10 + k + 0.02)).toBe(k))
    expect(j.results.map((r) => r.verdict)).toEqual(['perfect', 'perfect', 'perfect', 'perfect', 'perfect'])
    expect(j.summary()).toMatchObject({ onTime: 5, clean: true })
    expect(j.finished).toBe(true)
  })

  it('says early and late like Rhythm Tap', () => {
    const j = plan()
    j.note(60, 10.06) // good
    j.note(62, 10.85) // 150 ms early
    j.note(64, 12.2) // 200 ms late
    expect(j.results.slice(0, 3).map((r) => r.verdict)).toEqual(['good', 'early', 'late'])
    expect(j.results[1].error).toBeCloseTo(-0.15)
    expect(j.summary()).toMatchObject({ onTime: 1, early: 1, late: 1, clean: false })
  })

  it('counts a rushed note for the note it was meant to be', () => {
    const j = plan()
    j.note(60, 10)
    // D played 0.4 s after C's beat: nearest to C's beat, but C is done and this is D, early.
    expect(j.note(62, 10.4)).toBe(1)
    expect(j.results[1]).toMatchObject({ verdict: 'early' })
    expect(j.results[1].error).toBeCloseTo(-0.6)
  })

  it('takes any octave unless the exact octave is asked for', () => {
    expect(plan().note(72, 10)).toBe(0)
    const strict = plan(1, true)
    expect(strict.note(72, 10)).toBe('wrong')
    expect(strict.results[0].slip).toBe(true)
    expect(strict.note(60, 10.05)).toBe(0)
    expect(strict.results[0].verdict).toBe('wrong')
  })

  it('marks a wrong note and a missed one', () => {
    const j = plan()
    j.note(60, 10)
    j.note(63, 11) // E♭ instead of D
    j.note(62, 11.05) // then D
    expect(j.results[1].verdict).toBe('wrong')
    expect(j.close(12)).toEqual([])
    // E never comes: once its moment has passed, it's missed.
    expect(j.close(12.8)).toEqual([2])
    expect(j.results[2].verdict).toBe('miss')
    expect(j.summary()).toMatchObject({ wrong: 1, missed: 1, clean: false })
  })

  it('ignores the count-in, and counts stray notes against a clean run', () => {
    const j = plan()
    expect(j.note(55, 8.5)).toBeNull()
    expect(j.extras).toBe(0)
    j.note(60, 10)
    // C again, between the beats: no open note is near enough to slip on, so it's an extra.
    expect(j.note(60, 10.3)).toBe('wrong')
    expect(j.extras).toBe(1)
    // A G on D's beat is a slip on D.
    expect(j.note(67, 11)).toBe('wrong')
    expect(j.results[1].slip).toBe(true)
    C_MAJOR.slice(1).forEach((m, k) => j.note(m, 11 + k))
    expect(j.summary().clean).toBe(false)
  })

  it('needs both hands together, on two different keys', () => {
    const j = plan(2)
    j.note(60, 10.01)
    expect(j.results[0].verdict).toBeNull()
    j.note(60, 10.02) // the same key again is still one hand
    expect(j.results[0].verdict).toBeNull()
    j.note(48, 10.12) // the left hand, 120 ms late
    expect(j.results[0]).toMatchObject({ verdict: 'late' })
    expect(j.results[0].error).toBeCloseTo(0.12)
    j.note(62, 11)
    j.close(11.8)
    expect(j.results[1].verdict).toBe('oneHand')
  })

  it('lets one note stand for both hands through the mic', () => {
    const j = plan(2)
    expect(j.note(60, 10.03, { mic: true })).toBe(0)
    expect(j.results[0].verdict).toBe('perfect')
    j.note(62, 11.01, { mic: true })
    j.close(20)
    expect(j.results[1].verdict).toBe('perfect')
  })

  it('doesn’t count the mic hearing a ringing note again as a wrong note', () => {
    const j = plan()
    j.note(60, 10, { mic: true })
    expect(j.note(60, 10.4, { mic: true })).toBeNull()
    expect(j.extras).toBe(0)
    // From a keyboard, a second strike is a real (stray) note.
    expect(j.note(60, 10.4)).toBe('wrong')
  })
})

describe('best clean tempos', () => {
  it('keys a run by scale, hands, octaves and direction', () => {
    expect(bestKey(7, 'major', 'both', 2, true)).toBe('7:major:both:2:up-down')
    expect(bestKey(7, 'major', 'rh', 1, false)).toBe('7:major:rh:1:up')
  })

  it('reads back only sensible tempos', () => {
    expect(readBests({ a: 92, b: '100', c: Number.NaN, d: 1000, e: 71.6 })).toEqual({ a: 92, e: 72 })
    expect(readBests(null)).toEqual({})
    expect(readBests([90])).toEqual({})
  })
})
