import { beforeEach, describe, expect, it } from 'vitest'
import { type RoundRecord, itemStats, resetPracticeStats, trendText, usePracticeStats, weigher } from './stats'
import { weakest } from './weak'

describe('practice stats', () => {
  beforeEach(resetPracticeStats)

  it('keeps each game’s items apart and weighs the weak ones up', () => {
    const { recordAnswers } = usePracticeStats.getState()
    recordAnswers('note-rush', [
      { id: 'treble:F5', missed: true },
      { id: 'treble:C4', missed: false, ms: 900 },
      { id: 'treble:F5', missed: true },
      { id: 'treble:C4', missed: false, ms: 800 },
    ])
    recordAnswers('key-quiz', [{ id: 'Bbm', missed: false, ms: 3000 }])
    expect(itemStats('note-rush')['treble:F5']).toMatchObject({ seen: 2, wrong: 2 })
    expect(itemStats('note-rush')['treble:C4']).toMatchObject({ seen: 2, wrong: 0 })
    expect(Object.keys(itemStats('key-quiz'))).toEqual(['Bbm'])
    const ids = ['treble:C4', 'treble:F5', 'treble:G4']
    const w = weigher('note-rush', ids)
    expect(w('treble:F5')).toBeGreaterThan(w('treble:G4'))
    expect(w('treble:G4')).toBeGreaterThan(w('treble:C4'))
    expect(weakest(itemStats('note-rush'), ids)).toEqual(['treble:F5'])
  })

  it('ignores an empty round', () => {
    usePracticeStats.getState().recordAnswers('ear', [])
    expect(usePracticeStats.getState().items).toEqual({})
  })

  it('forgets everything on a reset', () => {
    usePracticeStats.getState().recordAnswers('ear', [{ id: 'quality:min', missed: true }])
    usePracticeStats.getState().addRound('ear:quality-mm', { at: 1, score: 500, accuracy: 50 })
    resetPracticeStats()
    expect(usePracticeStats.getState()).toMatchObject({ items: {}, history: {} })
  })
})

describe('trend', () => {
  const day = 864e5
  const now = 100 * day
  const round = (daysAgo: number, accuracy: number, score = accuracy * 10): RoundRecord => ({ at: now - daysAgo * day, score, accuracy })

  it('compares the first round this week with the latest', () => {
    expect(trendText([round(20, 40), round(6, 62), round(3, 70), round(0, 88)], 'accuracy', now)).toBe('62% → 88% this week')
    expect(trendText([round(2, 42), round(0, 61)], 'score', now)).toBe('420 → 610 points this week')
  })

  it('falls back to your last round, or says there’s only one', () => {
    expect(trendText([round(30, 62), round(9, 88)], 'accuracy', now)).toBe('62% → 88% since your last round')
    expect(trendText([round(30, 62), round(0, 88)], 'accuracy', now)).toBe('62% → 88% since your last round')
    expect(trendText([round(1, 72)], 'accuracy', now)).toBe('Last round: 72%')
    expect(trendText([], 'accuracy', now)).toBeNull()
  })
})
