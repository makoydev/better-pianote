import { beforeEach, describe, expect, it } from 'vitest'
import { RUNS_KEPT, trendRuns, useSongRuns } from './history'

const run = (accuracy: number, hands: 'rh' | 'both' = 'rh') => ({ at: accuracy, hands, accuracy, bpm: 72, pct: 75 })

describe('run history', () => {
  beforeEach(() => useSongRuns.setState({ runs: {} }))

  it('keeps the last runs of each song', () => {
    const { addRun } = useSongRuns.getState()
    for (let i = 0; i < RUNS_KEPT + 5; i++) addRun('a', run(i))
    addRun('b', run(90))
    const runs = useSongRuns.getState().runs
    expect(runs.a.length).toBe(RUNS_KEPT)
    expect(runs.a[0].accuracy).toBe(5)
    expect(runs.b.map((r) => r.accuracy)).toEqual([90])
  })

  it('draws a trend from runs with the same hands', () => {
    const runs = [run(70), run(80, 'both'), run(85), run(95)]
    expect(trendRuns(runs, 'rh').map((r) => r.accuracy)).toEqual([70, 85, 95])
    expect(trendRuns(runs, 'rh', 2).map((r) => r.accuracy)).toEqual([85, 95])
    expect(trendRuns(undefined, 'both')).toEqual([])
  })
})
