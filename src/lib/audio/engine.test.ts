import { describe, expect, it } from 'vitest'
import { audio } from './engine'

describe('the mic ignores the app', () => {
  it("ignores the app's notes, their octaves and twelfths, while they ring", () => {
    audio.markSounding([60], 5)
    expect(audio.isAppPitch(60, 1)).toBe(true)
    expect(audio.isAppPitch(72, 1)).toBe(true)
    expect(audio.isAppPitch(79, 1)).toBe(true)
    expect(audio.isAppPitch(62, 1)).toBe(false)
    expect(audio.isAppPitch(64, 1)).toBe(false)
    // Rung out: your C is yours again.
    expect(audio.isAppPitch(60, 6)).toBe(false)
  })
})
