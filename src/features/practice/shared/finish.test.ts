import { beforeEach, describe, expect, it, vi } from 'vitest'

// No sound or confetti in tests.
vi.mock('../../../lib/audio/engine', () => ({ audio: { ui: vi.fn() } }))
vi.mock('../../../lib/fx', () => ({ burst: vi.fn(), celebrate: vi.fn(), emitXp: vi.fn(), toast: vi.fn() }))

const { finishGame } = await import('./finish')
const { useProgress } = await import('../../../state/progress')
const { usePracticeStats } = await import('./stats')

describe('finishing a game', () => {
  beforeEach(() => {
    useProgress.getState().resetAll()
    usePracticeStats.setState({ items: {}, history: {} })
  })

  it('pays 5 for playing, 5 per star and 5 for beating your level best', () => {
    expect(finishGame('test', 'l1', 500, 2).xp).toBe(15)
    // Beating that best earns the bonus; a first try on a level doesn't.
    expect(finishGame('test', 'l1', 600, 3).xp).toBe(25)
    expect(finishGame('test', 'l1', 100, 1).xp).toBe(10)
    expect(finishGame('test', 'l2', 900, 1).xp).toBe(10)
    expect(useProgress.getState().xp).toBe(60)
  })

  it('pays nothing for a round with nothing right, so the streak needs real practice', () => {
    expect(finishGame('test', 'l1', 0, 0).xp).toBe(0)
    const p = useProgress.getState()
    expect(p.xp).toBe(0)
    expect(p.streak).toBe(0)
    expect(p.lastDay).toBeNull()
  })

  it('says when a round beats the level’s best, and what that was', () => {
    expect(finishGame('test', 'l1', 400, 2)).toMatchObject({ levelBest: true, levelPrevBest: 0 })
    expect(finishGame('test', 'l2', 300, 2)).toMatchObject({ isBest: false, levelBest: true, levelPrevBest: 0 })
    expect(finishGame('test', 'l2', 350, 2)).toMatchObject({ isBest: false, levelBest: true, levelPrevBest: 300 })
    expect(finishGame('test', 'l2', 200, 1)).toMatchObject({ levelBest: false, levelPrevBest: 350 })
  })

  it('keeps the last 20 rounds of a level, but not drills', () => {
    for (let i = 1; i <= 22; i++) finishGame('test', 'l1', i * 10, 1, { accuracy: 50 + i })
    finishGame('test', null, 999, 3, { accuracy: 100 })
    finishGame('rhythm', 'l1:mid', 88, 3, { accuracy: 88, bpm: 80 })
    const h = usePracticeStats.getState().history
    expect(h['test:l1']).toHaveLength(20)
    expect(h['test:l1'][0]).toMatchObject({ score: 30, accuracy: 53 })
    expect(h['test:l1'][19]).toMatchObject({ score: 220, accuracy: 72 })
    expect(h['rhythm:l1:mid'][0]).toMatchObject({ score: 88, accuracy: 88, bpm: 80 })
    expect(Object.keys(h)).toEqual(['test:l1', 'rhythm:l1:mid'])
  })

  it('pays for a drill without making it a level record', () => {
    finishGame('test', 'l1', 500, 2)
    const r = finishGame('test', null, 900, 3)
    expect(r).toMatchObject({ isBest: true, levelBest: false, xp: 20 })
    const games = useProgress.getState().games
    expect(games.test.best).toBe(900)
    expect(games['test:l1'].best).toBe(500)
    expect(Object.keys(games)).toEqual(['test', 'test:l1'])
  })

  it('records the game and the level', () => {
    finishGame('note-rush', 'treble:3', 420, 2)
    const r = finishGame('note-rush', 'bass:1', 300, 2)
    const games = useProgress.getState().games
    expect(games['note-rush']).toMatchObject({ best: 420, plays: 2, last: 300 })
    expect(games['note-rush:treble:3'].best).toBe(420)
    expect(games['note-rush:bass:1'].best).toBe(300)
    expect(r).toMatchObject({ isBest: false, levelBest: true })
  })
})
