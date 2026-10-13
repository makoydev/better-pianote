import { describe, expect, it } from 'vitest'
import { bestKey, readBests } from './scaleTiming'

describe('best clean tempos', () => {
  it('keys a run by scale, hands, octaves and direction', () => {
    expect(bestKey(7, 'major', 'both', 2, true)).toBe('7:major:both:2:up-down')
    expect(bestKey(7, 'major', 'rh', 1, false)).toBe('7:major:rh:1:up')
  })

  it('reads back only sensible tempos', () => {
    expect(readBests({ a: 92, b: '100', c: Number.NaN, d: 1000, e: 71.6 })).toEqual({ a: 92, e: 72 })
    expect(readBests(null)).toEqual({})
    expect(readBests([90])).toEqual({})
  })
})
