import { describe, expect, it } from 'vitest'
import { type ProgressData, mergeProgress, streakOf, summarize } from './backup'

const base = (over: Partial<ProgressData>): ProgressData => ({
  xp: 0,
  lessons: {},
  games: {},
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  dayKey: '2026-10-12',
  dayXp: 0,
  dailyGoal: 40,
  chordsFound: [],
  days: [],
  ...over,
})

describe('merging progress from two devices', () => {
  const mac = base({
    xp: 500,
    lessons: { 'u1-l1': { stars: 2, completedAt: 100 }, 'u1-l2': { stars: 3, completedAt: 200 } },
    games: { 'note-rush': { best: 900, plays: 10, last: 400, lastPlayed: 50 } },
    days: ['2026-10-09', '2026-10-10'],
    lastDay: '2026-10-10',
    chordsFound: ['C', 'Am'],
    dailyGoal: 60,
  })
  const ipad = base({
    xp: 320,
    lessons: { 'u1-l1': { stars: 3, completedAt: 300 }, 'u2-l1': { stars: 1, completedAt: 150 } },
    games: { 'note-rush': { best: 700, plays: 4, last: 650, lastPlayed: 80 }, 'chord-trainer': { best: 300, plays: 1, last: 300, lastPlayed: 70 } },
    days: ['2026-10-11', '2026-10-12'],
    lastDay: '2026-10-12',
    dayXp: 25,
    chordsFound: ['Am', 'F'],
  })
  const m = mergeProgress(mac, ipad)

  it('keeps every lesson at its best', () => {
    expect(m.lessons['u1-l1']).toEqual({ stars: 3, completedAt: 300 })
    expect(Object.keys(m.lessons).sort()).toEqual(['u1-l1', 'u1-l2', 'u2-l1'])
  })

  it('keeps every game at its best, with the latest round as "last"', () => {
    expect(m.games['note-rush']).toEqual({ best: 900, plays: 10, last: 650, lastPlayed: 80 })
    expect(m.games['chord-trainer'].best).toBe(300)
  })

  it('joins practice days into one streak', () => {
    expect(m.days).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'])
    expect(m.lastDay).toBe('2026-10-12')
    expect(m.streak).toBe(4)
    expect(m.bestStreak).toBe(4)
  })

  it("takes the higher XP (not the sum), all chords, and this device's goal", () => {
    expect(m.xp).toBe(500)
    expect(m.chordsFound.sort()).toEqual(['Am', 'C', 'F'])
    expect(m.dailyGoal).toBe(60)
  })

  it('counts a streak back from the last day', () => {
    expect(streakOf(['2026-10-01', '2026-10-03', '2026-10-04'], '2026-10-04')).toBe(2)
    expect(streakOf([], null)).toBe(0)
  })

  it('summarises a device for the import preview', () => {
    expect(summarize(mac, 2)).toEqual({ xp: 500, lessons: 2, stars: 5, songs: 2, lastDay: '2026-10-10' })
  })
})
