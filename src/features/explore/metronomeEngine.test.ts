import { describe, expect, it } from 'vitest'
import { DEFAULT_TRAINER, trainedBpm } from './metronomeEngine'

describe('speed trainer', () => {
  const t = { ...DEFAULT_TRAINER, on: true, step: 4, every: 4, target: 100 }

  it('adds the step every few bars', () => {
    expect(trainedBpm(80, t, 1)).toBe(80)
    expect(trainedBpm(80, t, 3)).toBe(80)
    expect(trainedBpm(80, t, 4)).toBe(84)
    expect(trainedBpm(84, t, 8)).toBe(88)
  })

  it('stops at the target, and does nothing when off', () => {
    expect(trainedBpm(98, t, 4)).toBe(100)
    expect(trainedBpm(100, t, 4)).toBe(100)
    expect(trainedBpm(80, { ...t, on: false }, 4)).toBe(80)
  })
})
