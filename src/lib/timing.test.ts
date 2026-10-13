import { describe, expect, it } from 'vitest'
import { RunJudge, TempoMap } from './timing'

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

// "Hot Cross Buns" bar 3 at 60 BPM: C C C C D D D D in eighths, then a half-note E on beat 4 (of a longer bar).
const EIGHTHS = [60, 60, 60, 60, 62, 62, 62, 62]
const rhythm = () =>
  new RunJudge({
    t0: 10,
    beat: 1,
    hands: 1,
    strict: true,
    targets: [...EIGHTHS.map((m, k) => ({ pc: m % 12, midis: [m], at: k / 2 })), { pc: 4, midis: [64], at: 4 }],
  })

describe('a rhythm in time', () => {
  it('times each note at its own moment', () => {
    const j = rhythm()
    EIGHTHS.forEach((m, k) => expect(j.note(m, 10 + k / 2 + 0.01)).toBe(k))
    expect(j.note(64, 14.03)).toBe(8)
    expect(j.summary()).toMatchObject({ onTime: 9, inTime: 9, clean: true })
  })

  it('gives a repeated note to the earlier one still waiting', () => {
    const j = rhythm()
    // The first C comes 0.3 beats late: closer to the second C's moment, but the first one is still waiting.
    expect(j.note(60, 10.3)).toBe(0)
    expect(j.results[0].verdict).toBe('late')
    expect(j.note(60, 10.5)).toBe(1)
    expect(j.results[1].verdict).toBe('perfect')
  })

  it('keeps eighth-note windows tighter than quarter-note ones', () => {
    const j = rhythm()
    expect(j.window(0)).toBeCloseTo(0.2)
    j.note(60, 10)
    // Half a beat between notes: within a quarter beat counts, as in Rhythm Tap.
    expect(j.window(1)).toBeCloseTo(0.2)
    j.note(60, 10.5 + 0.19)
    expect(j.inTime(1)).toBe(true)
    const slow = new RunJudge({ t0: 0, beat: 0.6, hands: 1, strict: true, targets: EIGHTHS.map((m, k) => ({ pc: m % 12, midis: [m], at: k / 2 })) })
    expect(slow.window(3)).toBeCloseTo(0.15)
    slow.note(60, 0)
    slow.note(60, 0.3)
    slow.note(60, 0.6)
    // 170 ms late: past the 150 ms window, so late and not in time.
    expect(slow.note(60, 0.9 + 0.17)).toBe(3)
    expect(slow.results[3].verdict).toBe('late')
    expect(slow.inTime(3)).toBe(false)
  })

  it('counts a note a whole beat late between half notes as late, not missed', () => {
    // Half notes C and D, then a whole-note E.
    const j = new RunJudge({ t0: 0, beat: 1, hands: 1, strict: true, targets: [60, 62, 64].map((m, k) => ({ pc: m % 12, midis: [m], at: k * 2 })) })
    j.note(60, 0)
    expect(j.note(62, 3)).toBe(1)
    expect(j.results[1]).toMatchObject({ verdict: 'late', error: 1 })
    expect(j.inTime(1)).toBe(false)
    expect(j.summary()).toMatchObject({ onTime: 1, late: 1, inTime: 1 })
  })

  it('times how long each note was held', () => {
    const j = new RunJudge({ t0: 0, beat: 1, hands: 1, strict: true, targets: [60, 62, 60].map((m, k) => ({ pc: m % 12, midis: [m], at: k * 2 })) })
    j.note(60, 0.05)
    expect(j.release(60, 1.05)).toBe(0)
    expect(j.results[0].held).toBeCloseTo(1)
    // A second let-go of the same key belongs to nothing.
    expect(j.release(60, 1.5)).toBeNull()
    j.note(62, 2)
    j.note(60, 4)
    expect(j.release(60, 7.9)).toBe(2)
    expect(j.results[2].held).toBeCloseTo(3.9)
    // D was never let go during the run.
    expect(j.results[1].held).toBeNull()
  })

  it('still hears a repeated note through the mic, but not one that is ringing', () => {
    const j = rhythm()
    j.note(60, 10, { mic: true })
    // Heard again a moment later: the C is still ringing.
    expect(j.note(60, 10.15, { mic: true })).toBeNull()
    // Struck again on its own moment: the second C.
    expect(j.note(60, 10.5, { mic: true })).toBe(1)
  })
})

// A song's bar at 60 BPM: a C major chord with the melody's E on top (C3 + C4 E4 G4) on beat 1, then D4 and E4.
const chordBar = (slips?: boolean) =>
  new RunJudge({
    t0: 0,
    beat: 1,
    hands: 1,
    strict: true,
    slips,
    targets: [
      ...[48, 60, 64, 67].map((m) => ({ pc: m % 12, midis: [m], at: 0 })),
      { pc: 2, midis: [62], at: 1 },
      { pc: 4, midis: [64], at: 2 },
    ],
  })

describe('a song played along with', () => {
  it('judges each note of a chord on its own', () => {
    const j = chordBar(false)
    expect(j.note(60, 0.01)).toBe(1)
    expect(j.note(48, -0.02)).toBe(0)
    expect(j.note(67, 0.12)).toBe(3)
    // The E is never played; D and the next E are.
    j.note(62, 1)
    j.note(64, 2)
    j.close(10)
    expect(j.results.map((r) => r.verdict)).toEqual(['perfect', 'perfect', 'miss', 'late', 'perfect', 'perfect'])
  })

  it('times a chord against the moments either side, not its other notes', () => {
    const j = chordBar()
    // A beat to D: the usual 200 ms window, not none at all.
    expect(j.window(0)).toBeCloseTo(0.2)
    expect(j.window(3)).toBeCloseTo(0.2)
    // Half a beat early still reaches the chord.
    expect(j.note(67, -0.5)).toBe(3)
    expect(j.results[3].verdict).toBe('early')
  })

  it('only counts wrong notes when they make no note a slip', () => {
    const lesson = chordBar()
    expect(lesson.note(61, 1)).toBe('wrong')
    expect(lesson.results[4].slip).toBe(true)
    const song = chordBar(false)
    expect(song.note(61, 1)).toBe('wrong')
    expect(song.results[4].slip).toBe(false)
    expect(song.extras).toBe(1)
    song.note(62, 1.02)
    expect(song.results[4].verdict).toBe('perfect')
  })

  it('lets the mic hear a chord from one of its notes', () => {
    const j = chordBar(false)
    expect(j.note(64, 0.03, { mic: true })).toBe(2)
    expect(j.results.slice(0, 4).map((r) => r.verdict)).toEqual(['perfect', 'perfect', 'perfect', 'perfect'])
    // Hearing another note of it a moment later is the chord still ringing.
    expect(j.note(67, 0.2, { mic: true })).toBeNull()
    expect(j.extras).toBe(0)
  })

  it('asks for the written octave note by note', () => {
    const j = chordBar(false)
    // C5 for C4: wrong from a USB keyboard, fine from computer keys set to any octave.
    expect(j.note(72, 0, { exact: true })).toBe('wrong')
    expect(j.note(72, 0.01, { exact: false })).toBe(0)
  })

  it('follows the tempo when it changes as it plays', () => {
    // 60 BPM for the first two beats, then 120 BPM.
    const tempo = new TempoMap(0, 1)
    tempo.set(2, 2, 0.5)
    expect(tempo.beats(3)).toBeCloseTo(4)
    expect(tempo.time(5)).toBeCloseTo(3.5)
    expect(tempo.beat(1)).toBe(1)
    expect(tempo.beat(4)).toBe(0.5)
    // A beat before the first one, at the first tempo.
    expect(tempo.beats(-1)).toBeCloseTo(-1)
    const j = new RunJudge({ t0: 0, beat: 1, hands: 1, strict: true, targets: [0, 1, 2, 3, 4].map((at) => ({ pc: 0, midis: [60], at })) }, tempo)
    j.note(60, 0)
    j.note(60, 1)
    j.note(60, 2)
    // Beat 3 is at 2.5 s now: 40 ms late, not a whole half second early.
    expect(j.note(60, 2.54)).toBe(3)
    expect(j.results[3]).toMatchObject({ verdict: 'perfect' })
    expect(j.results[3].error).toBeCloseTo(0.04)
    // Quarter notes at 120 BPM are 500 ms apart: a 200 ms window still.
    expect(j.window(4)).toBeCloseTo(0.2)
    expect(j.close(3.3)).toEqual([])
    expect(j.close(3.5)).toEqual([4])
  })

  it('sizes each hand’s windows by its own rhythm', () => {
    // A right-hand half note over left-hand eighths, at 60 BPM.
    const j = new RunJudge({
      t0: 0,
      beat: 1,
      hands: 1,
      strict: true,
      slips: false,
      targets: [
        { pc: 4, midis: [64], at: 0, lane: 0 },
        ...[48, 55, 52, 55].map((m, k) => ({ pc: m % 12, midis: [m], at: k / 2, lane: 1 })),
        { pc: 2, midis: [62], at: 2, lane: 0 },
      ],
    })
    // The left hand's eighths: 200 ms. The right hand's half notes: 200 ms too, not squeezed to a quarter beat.
    expect(j.window(2)).toBeCloseTo(0.2)
    expect(j.window(0)).toBeCloseTo(0.2)
    // The E 0.4 beats late still reaches its note (a quarter beat would have been the limit otherwise).
    expect(j.note(64, 0.4)).toBe(0)
    expect(j.results[0].verdict).toBe('late')
  })

  it('takes more notes as the music goes round again', () => {
    const j = new RunJudge({ t0: 0, beat: 1, hands: 1, strict: true, slips: false, targets: [{ pc: 0, midis: [60], at: 0 }, { pc: 7, midis: [67], at: 1 }] })
    j.add([{ pc: 0, midis: [60], at: 2 }, { pc: 7, midis: [67], at: 3 }])
    // The second time round's C, a little early across the join.
    j.note(60, 0)
    j.note(67, 1)
    expect(j.note(60, 1.9)).toBe(2)
    expect(j.results[2].verdict).toBe('early')
    j.close(10)
    expect(j.summary()).toMatchObject({ total: 4, onTime: 2, early: 1, missed: 1 })
  })
})
