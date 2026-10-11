import { describe, expect, it } from 'vitest'
import { type Song, parseBars } from '../../content/songs'
import { carryOn, newRun, stepAt, stepsInBars } from './practice'
import { buildSteps, buildTimeline } from './timeline'

const song = (rh: string, lh: string): Song => ({
  id: 't',
  title: 'Test',
  composer: '',
  year: '',
  difficulty: 1,
  keyName: 'C major',
  keySig: 0,
  time: [4, 4],
  bpm: 90,
  tags: [],
  about: '',
  rh: parseBars(rh),
  lh: parseBars(lh),
})

describe('practice runs', () => {
  const tl = buildTimeline(song('C4:q D4 E4 F4 | G4:h r:h | A4:w', 'C3:w | G2:w | F2:h C3:h'))
  // Right hand: C4 D4 E4 F4 | G4 (rest) | A4. Both hands add a left-hand-only step at beat 10.
  const rh = buildSteps(tl, 'rh')
  const both = buildSteps(tl, 'both')

  it('finds the first step at or after a moment', () => {
    expect(stepAt(rh, 2, false)).toBe(2)
    // Paused on the rest in bar 2: carry on with the next note.
    expect(stepAt(rh, 6, false)).toBe(5)
    // Changing hands keeps the bar: G4 at beat 4 is step 4 with either hands.
    expect(both[stepAt(both, rh[4].start, false)].start).toBe(4)
    // Nothing left after the last right-hand note: stay on it (or go round, when looping).
    expect(stepAt(rh, both[6].start, false)).toBe(5)
    expect(stepAt(rh, 9, true)).toBe(0)
  })

  it('keeps only the steps in the looped bars', () => {
    expect(stepsInBars(both, [1, 2]).map((s) => s.start)).toEqual([4, 8, 10])
    expect(stepsInBars(both, null)).toBe(both)
  })

  it('counts a run as a best only when it is played from the start, in order, with the same hands', () => {
    // Starting part-way (e.g. from where Listen stopped).
    expect(carryOn(newRun('rh'), 3, 'rh').whole).toBe(false)
    const playing = { ...newRun('rh'), idx: 4, notes: 4 }
    // Back to the same step after listening, or back over steps already played: still whole.
    expect(carryOn(playing, 4, 'rh').whole).toBe(true)
    expect(carryOn(playing, 2, 'rh').whole).toBe(true)
    // Jumping ahead, or switching hands mid-way: not any more.
    expect(carryOn(playing, 5, 'rh').whole).toBe(false)
    expect(carryOn(playing, 4, 'both').whole).toBe(false)
    // The run keeps its notes and slips.
    expect(carryOn({ ...playing, mistakes: 2, ms: 900 }, 2, 'rh')).toMatchObject({ idx: 2, notes: 4, mistakes: 2, ms: 900 })
  })
})
