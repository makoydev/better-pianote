import { describe, expect, it } from 'vitest'
import { chordPcs, parseChord } from '../../lib/theory'
import { ChordJudge, ON_TIME, type Span, earlyGrace, neededTones, timingOf } from './playAlong'

const C4 = 60
const E4 = 64
const G4 = 67
const A3 = 57

function span(symbol: string, loop: number, index: number, start: number): Span {
  const c = parseChord(symbol)
  return { loop, index, start, need: neededTones(c, false), needMic: neededTones(c, true), tones: chordPcs(c) }
}

/** C – Am – F – G, a chord every 2 s, starting at 10 s. */
function band(loops = 1) {
  const j = new ChordJudge(0.2)
  for (let l = 0; l < loops; l++) ['C', 'Am', 'F', 'G'].forEach((s, i) => j.add(span(s, l, i, 10 + (l * 4 + i) * 2)))
  return j
}
const keys = { mic: false, timed: true }

describe('what a chord needs', () => {
  it('needs every note of a triad, from a keyboard', () => {
    expect(neededTones(parseChord('C'), false)).toEqual([0, 4, 7])
    expect(neededTones(parseChord('Bdim'), false)).toEqual([11, 2, 5])
  })

  it('lets a seventh chord leave out its 5th', () => {
    expect(neededTones(parseChord('G7'), false)).toEqual([7, 11, 5])
    expect(neededTones(parseChord('Cmaj7'), false)).toEqual([0, 4, 11])
  })

  it('never needs a perfect 5th through the mic, but keeps a diminished one', () => {
    expect(neededTones(parseChord('C'), true)).toEqual([0, 4])
    expect(neededTones(parseChord('Bdim'), true)).toEqual([11, 2, 5])
    expect(neededTones(parseChord('Csus4'), true)).toEqual([0, 5])
  })

  it('ignores a slash bass (the band plays it)', () => {
    expect(neededTones(parseChord('C/E'), false)).toEqual([0, 4, 7])
  })
})

describe('ticking off chords', () => {
  it('ticks a chord played on the beat', () => {
    const j = band()
    expect(j.note(C4, 10.01, [C4], keys)).toBeNull()
    expect(j.note(E4, 10.02, [C4, E4], keys)).toBeNull()
    const p = j.note(G4, 10.03, [C4, E4, G4], keys)
    expect(p).toMatchObject({ loop: 0, index: 0, timing: 'on' })
    expect(p!.error).toBeCloseTo(0.01)
    // Once is enough.
    expect(j.note(C4, 10.5, [C4], keys)).toBeNull()
  })

  it('times the chord from your first chord tone, early or late', () => {
    const j = band()
    // Coming in 150 ms before the change still counts for the new chord, as early.
    j.note(A3, 11.85, [A3], keys)
    j.note(C4, 11.86, [A3, C4], keys)
    expect(j.note(E4, 11.87, [A3, C4, E4], keys)).toMatchObject({ index: 1, timing: 'early' })
    j.note(65, 14.3, [65], keys)
    j.note(69, 14.31, [65, 69], keys)
    const f = j.note(72, 14.32, [65, 69, 72], keys)
    expect(f).toMatchObject({ index: 2, timing: 'late' })
    expect(f!.error).toBeCloseTo(0.3)
  })

  it('counts notes held on from the chord before, once you play something new', () => {
    const j = band()
    j.note(C4, 10, [C4], keys)
    j.note(E4, 10, [C4, E4], keys)
    j.note(G4, 10, [C4, E4, G4], keys)
    // C → Am: keep C and E, move G up to A.
    expect(j.note(69, 12.02, [C4, E4, 69], keys)).toMatchObject({ index: 1, timing: 'on' })
  })

  it('doesn’t tick a wrong chord, and a note too early belongs to the chord before', () => {
    const j = band()
    j.note(64, 12, [64], keys)
    j.note(67, 12, [64, 67], keys)
    expect(j.note(71, 12, [64, 67, 71], keys)).toBeNull() // Em over Am
    // 300 ms before the change is still the old chord.
    expect(j.note(65, 13.7, [65, 69, 72], keys)).toBeNull()
    expect(j.score(0).played).toBe(0)
  })

  it('needs a repeated chord played again', () => {
    const j = new ChordJudge(0.2)
    j.add(span('A7', 0, 0, 0))
    j.add(span('A7', 0, 1, 2))
    const A7 = [57, 61, 67]
    j.note(57, 0, [57], keys)
    j.note(61, 0, [57, 61], keys)
    expect(j.note(67, 0, A7, keys)).toMatchObject({ index: 0 })
    // Still holding through the next bar: nothing new struck, nothing ticked.
    expect(j.score(0).played).toBe(1)
    expect(j.note(61, 2.05, A7, keys)).toMatchObject({ index: 1, timing: 'on' })
  })

  it('through the mic ticks the chord without judging the beat, 5th or not', () => {
    const j = band()
    j.note(C4, 10.3, [C4], { mic: true, timed: false })
    expect(j.note(E4, 10.35, [C4, E4], { mic: true, timed: false })).toMatchObject({ index: 0, timing: null, error: null })
  })

  it('scores each pass through the progression', () => {
    const j = band(2)
    const play = (notes: number[], at: number) => notes.forEach((m, k) => j.note(m, at + k * 0.01, notes.slice(0, k + 1), keys))
    play([C4, E4, G4], 10)
    play([57, 60, 64], 12.2) // late
    play([53, 57, 60], 14)
    expect(j.score(0)).toEqual({ played: 3, onTime: 2, total: 4 })
    play([C4, E4, G4], 18)
    expect(j.score(1)).toEqual({ played: 1, onTime: 1, total: 4 })
  })
})

describe('timing words', () => {
  it('calls it on the beat within the window', () => {
    expect(timingOf(0)).toBe('on')
    expect(timingOf(ON_TIME)).toBe('on')
    expect(timingOf(-0.12)).toBe('early')
    expect(timingOf(0.12)).toBe('late')
  })

  it('lets you come in a little early, never more than 200 ms', () => {
    expect(earlyGrace(0.4)).toBeCloseTo(0.16)
    expect(earlyGrace(1)).toBe(0.2)
  })
})
