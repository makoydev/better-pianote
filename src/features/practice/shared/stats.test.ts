import { beforeEach, describe, expect, it } from 'vitest'
import { itemStats, usePracticeStats, weigher } from './stats'
import { weakest } from './weak'

describe('practice stats', () => {
  beforeEach(() => usePracticeStats.setState({ items: {} }))

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
})
