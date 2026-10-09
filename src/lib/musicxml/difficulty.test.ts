import { describe, expect, it } from 'vitest'
import { SONGS, findSong } from '../../content/songs'
import { estimateDifficulty } from './convert'

describe('difficulty estimate', () => {
  it('agrees with the built-in songs at both ends and never overshoots', () => {
    for (const s of SONGS) {
      const est = estimateDifficulty(s)
      if (s.difficulty === 1) expect(est, s.title).toBe(1)
      expect(est, s.title).toBeLessThanOrEqual(s.difficulty)
    }
    expect(estimateDifficulty(findSong('prelude-in-c')!)).toBe(3)
  })

  it('rates faster, busier writing higher', () => {
    const base = findSong('twinkle')!
    expect(estimateDifficulty(base)).toBe(1)
    // The same notes as sixteenths with plenty of accidentals and a key with four sharps.
    const hard = {
      ...base,
      keySig: 4,
      rh: base.rh.map((bar) => bar.map((e) => ({ ...e, dur: '16' as const, notes: e.notes.map((n) => n.replace(/^([CF])/, '$1b')) }))),
    }
    expect(estimateDifficulty({ ...hard, bpm: 120 })).toBeGreaterThan(1)
  })
})
