import { describe, expect, it } from 'vitest'
import { WORKOUT_BONUS, partXp, workoutTotals } from './workout'

const part = (score: number, stars: number) => ({ score, stars, detail: '' })

describe('the daily workout', () => {
  it('pays XP per part, more per star, and nothing for a part with nothing right', () => {
    expect(partXp(part(1, 3))).toBe(9)
    expect(partXp(part(0.5, 1))).toBe(5)
    expect(partXp(part(0, 0))).toBe(0)
  })

  it('averages the parts, and adds the bonus once every part is done', () => {
    const parts = [part(1, 3), part(0.8, 2), part(0.6, 1), part(1, 3)]
    expect(workoutTotals(parts, 4)).toEqual({ pct: 85, stars: 2, xp: 9 + 7 + 5 + 9 + WORKOUT_BONUS })
    // Left part-way: no bonus.
    expect(workoutTotals(parts.slice(0, 2), 4)).toEqual({ pct: 90, stars: 3, xp: 16 })
    expect(workoutTotals([part(0, 0), part(0, 0)], 2)).toEqual({ pct: 0, stars: 0, xp: 0 })
  })
})
