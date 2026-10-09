import { describe, expect, it } from 'vitest'
import { frac, toNum } from './frac'
import { notate, soundingLength, splitPlain, writtenLength } from './notate'
import { type RepeatMarks, playOrder } from './repeats'

const show = (ps: { dur: string; dots: number; tuplet?: { actual: number; normal: number } }[]) =>
  ps.map((p) => p.dur + '.'.repeat(p.dots) + (p.tuplet ? `(${p.tuplet.actual}:${p.tuplet.normal})` : '')).join(' ')

describe('note values', () => {
  it('knows written lengths, dots included', () => {
    expect(toNum(writtenLength('q', 0))).toBe(1)
    expect(toNum(writtenLength('q', 1))).toBe(1.5)
    expect(toNum(writtenLength('h', 2))).toBe(3.5)
    expect(toNum(writtenLength('64', 0))).toBe(1 / 16)
    expect(toNum(soundingLength({ dur: '8', dots: 0, tuplet: { actual: 3, normal: 2 } }))).toBeCloseTo(1 / 3)
  })

  it('splits lengths into as few values as possible', () => {
    expect(show(splitPlain(frac(3))!)).toBe('h.')
    expect(show(splitPlain(frac(7, 2))!)).toBe('h..')
    expect(show(splitPlain(frac(8))!)).toBe('w w')
    expect(show(splitPlain(frac(5))!)).toBe('w q')
    expect(show(splitPlain(frac(5, 8))!)).toBe('8 32')
    expect(splitPlain(frac(1, 3))).toBeNull()
    expect(splitPlain(frac(1, 32))).toBeNull()
  })

  it('keeps the written value when it fits, and tuplets when it must', () => {
    expect(show(notate(frac(1, 3), { dur: '8', dots: 0, tuplet: { actual: 3, normal: 2 } }).pieces)).toBe('8(3:2)')
    // A triplet passage cut short stays a triplet.
    expect(show(notate(frac(2, 3), { dur: 'q', dots: 0, tuplet: { actual: 3, normal: 2 } }).pieces)).toBe('q(3:2)')
    expect(show(notate(frac(1, 3)).pieces)).toBe('8(3:2)')
    expect(show(notate(frac(1, 5)).pieces)).toBe('16(5:4)')
    expect(show(notate(frac(3, 2)).pieces)).toBe('q.')
  })

  it('falls back to an exact stand-in for impossible lengths', () => {
    const r = notate(frac(1, 32))
    expect(r.exact).toBe(false)
    expect(toNum(soundingLength(r.pieces[0]))).toBe(1 / 32)
  })
})

const marks = (n: number, set: Record<number, Partial<RepeatMarks>> = {}): RepeatMarks[] =>
  Array.from({ length: n }, (_, i) => ({
    forward: false,
    backward: 0,
    endingStart: null,
    endingStop: false,
    segno: false,
    coda: false,
    tocoda: false,
    dacapo: false,
    dalsegno: false,
    fine: false,
    ...set[i],
  }))

describe('play order', () => {
  it('plays straight through without repeats', () => {
    expect(playOrder(marks(3)).order).toEqual([0, 1, 2])
  })

  it('repeats a section, from the start or from a forward repeat', () => {
    expect(playOrder(marks(3, { 1: { backward: 2 } })).order).toEqual([0, 1, 0, 1, 2])
    expect(playOrder(marks(4, { 1: { forward: true }, 2: { backward: 2 } })).order).toEqual([0, 1, 2, 1, 2, 3])
    expect(playOrder(marks(2, { 0: { backward: 3 } })).order).toEqual([0, 0, 0, 1])
  })

  it('takes first and second endings', () => {
    const ms = marks(5, {
      0: { forward: true },
      2: { endingStart: [1], endingStop: true, backward: 2 },
      3: { endingStart: [2], endingStop: true },
    })
    expect(playOrder(ms).order).toEqual([0, 1, 2, 0, 1, 3, 4])
  })

  it('handles an ending shared by two passes', () => {
    const ms = marks(3, {
      0: { forward: true },
      1: { endingStart: [1, 2], endingStop: true, backward: 3 },
      2: { endingStart: [3], endingStop: true },
    })
    expect(playOrder(ms).order).toEqual([0, 1, 0, 1, 0, 2])
  })

  it('plays back-to-back repeated sections', () => {
    const ms = marks(2, { 0: { forward: true, backward: 2 }, 1: { forward: true, backward: 2 } })
    expect(playOrder(ms).order).toEqual([0, 0, 1, 1])
  })

  it('follows D.C. al Fine without taking repeats again', () => {
    const ms = marks(4, { 0: { backward: 2 }, 1: { fine: true }, 3: { dacapo: true } })
    expect(playOrder(ms).order).toEqual([0, 0, 1, 2, 3, 0, 1])
  })

  it('follows D.S. al Coda', () => {
    const ms = marks(6, { 1: { segno: true }, 2: { tocoda: true }, 3: { dalsegno: true }, 4: { coda: true } })
    expect(playOrder(ms).order).toEqual([0, 1, 2, 3, 1, 2, 4, 5])
  })

  it('plays only the last ending after a jump', () => {
    const ms = marks(5, {
      0: { forward: true },
      1: { endingStart: [1], endingStop: true, backward: 2 },
      2: { endingStart: [2], endingStop: true },
      3: { dacapo: true },
    })
    expect(playOrder(ms).order).toEqual([0, 1, 0, 2, 3, 0, 2, 3, 4])
  })
})
