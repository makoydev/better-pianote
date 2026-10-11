import { beforeEach, describe, expect, it } from 'vitest'
import { useProgress } from '../../state/progress'
import { accuracyOf, bestText, clockTime, handsBest, recordSongRun, songKey, starsOf } from './results'

const record = (best: number) => ({ best, plays: 1, last: best, lastPlayed: 0 })

describe('song results', () => {
  beforeEach(() => useProgress.getState().resetAll())

  it('rounds the time before splitting it into minutes and seconds', () => {
    expect(clockTime(119.6)).toBe('2:00')
    expect(clockTime(59.4)).toBe('0:59')
    expect(clockTime(61)).toBe('1:01')
  })

  it('measures accuracy over notes, so every note of a chord counts', () => {
    // Ten four-note chords with two slips: 40 of 42 right, not 10 of 12.
    expect(accuracyOf(40, 2)).toBeCloseTo(40 / 42)
    expect(starsOf(40, 2)).toBe(2)
    expect(starsOf(40, 0)).toBe(3)
    expect(starsOf(10, 5)).toBe(1)
    expect(accuracyOf(0, 0)).toBe(0)
  })

  it('keeps a best per hands, so a right-hand 100% leaves room for a both-hands best', () => {
    expect(recordSongRun('x', 'rh', 100)).toBe(true)
    expect(recordSongRun('x', 'both', 85)).toBe(true)
    expect(recordSongRun('x', 'both', 80)).toBe(false)
    const games = useProgress.getState().games
    expect(games[songKey('x')].best).toBe(100)
    expect(handsBest(games, 'x', 'both')).toBe(85)
    expect(bestText(games, 'x')).toBe('RH 100% · Both 85%')
  })

  it('still reads records saved before bests were kept per hands', () => {
    const games = { [songKey('old')]: record(90) }
    expect(handsBest(games, 'old', 'rh')).toBe(90)
    expect(handsBest(games, 'old', 'both')).toBe(90)
    expect(bestText(games, 'old')).toBe('Best 90%')
    useProgress.setState({ games })
    expect(recordSongRun('old', 'both', 85)).toBe(false)
    expect(recordSongRun('old', 'both', 95)).toBe(true)
    expect(useProgress.getState().games[songKey('old')].best).toBe(95)
  })
})
