import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../../content'
import { numberValue, optionOrder } from './quizOrder'

describe('quiz option order', () => {
  it('reads numbers, fractions and counts', () => {
    expect(numberValue('60')).toBe(60)
    expect(numberValue('½')).toBe(0.5)
    expect(numberValue('2½ beats')).toBe(2.5)
    expect(numberValue('1 (the thumb, tucked under)')).toBe(1)
    expect(numberValue('3/4')).toBeNull()
    expect(numberValue('5th')).toBeNull()
    expect(numberValue('C')).toBeNull()
  })

  it('shows numbers smallest first', () => {
    const options = ['3', '2', '4', '1']
    expect(optionOrder(options).map((i) => options[i])).toEqual(['1', '2', '3', '4'])
  })

  it('keeps two-option and ordered questions as written', () => {
    expect(optionOrder(['Major', 'Minor'])).toEqual([0, 1])
    expect(optionOrder(['Higher', 'Lower', 'The same'], true)).toEqual([0, 1, 2])
  })

  it('shuffles the rest, keeping every option', () => {
    const options = ['C', 'F', 'D', 'B']
    let seed = 0.37
    const rng = () => (seed = (seed * 9301 + 49297) % 233280 / 233280)
    const order = optionOrder(options, false, rng)
    expect([...order].sort()).toEqual([0, 1, 2, 3])
  })

  it('no longer puts the right answer first in most lessons', () => {
    let first = 0
    let total = 0
    for (const { lesson } of ALL_LESSONS) {
      for (const s of lesson.steps) {
        if (s.kind !== 'quiz') continue
        total++
        // Average over many shuffles: how often does the answer land in the first place?
        let hits = 0
        for (let k = 0; k < 40; k++) if (optionOrder(s.options, s.ordered)[0] === s.answer) hits++
        first += hits / 40
      }
    }
    expect(first / total).toBeLessThan(0.45)
  })
})
