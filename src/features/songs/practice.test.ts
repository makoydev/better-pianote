import { describe, expect, it } from 'vitest'
import { type Song, parseBars } from '../../content/songs'
import {
  CLEAN_GOAL,
  LOOP_XP,
  LOOP_XP_MAX,
  PASSES_SHOWN,
  aroundBar,
  carryOn,
  endPass,
  firstStepIn,
  newRun,
  runFrom,
  stepAt,
  stepsInBars,
  tally,
  worstStretch,
} from './practice'
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

  it('starts from a bar you choose, as a run that says where it started but is not a best', () => {
    expect(firstStepIn(rh, 1)).toBe(4)
    expect(firstStepIn(both, 2)).toBe(5)
    expect(firstStepIn(both, 9)).toBe(6)
    expect(runFrom('rh', 4, 1)).toMatchObject({ idx: 4, whole: false, fromBar: 1 })
    // From the first step it's a normal run.
    expect(runFrom('rh', 0, 0)).toMatchObject({ idx: 0, whole: true })
    expect(runFrom('rh', 0, 0).fromBar).toBeUndefined()
    // Loop around here: the bar with one either side, inside the song.
    expect(aroundBar(5, 16)).toEqual([4, 6])
    expect(aroundBar(0, 16)).toEqual([0, 1])
    expect(aroundBar(15, 16)).toEqual([14, 15])
  })

  it('keeps only the steps in the looped bars', () => {
    expect(stepsInBars(both, [1, 2]).map((s) => s.start)).toEqual([4, 8, 10])
    expect(stepsInBars(both, null)).toBe(both)
  })

  it('counts a run as a best only when it is played straight through, with the same hands', () => {
    // Starting part-way (e.g. from where Listen stopped): a fresh run that can't be a best.
    expect(carryOn(newRun('rh'), 3, 'rh', false)).toMatchObject({ idx: 3, whole: false, notes: 0 })
    const playing = { ...newRun('rh'), idx: 4, notes: 6, sat: new Set([7]) }
    // Back on the same step after listening: nothing changes, not even a half-played chord.
    expect(carryOn(playing, 4, 'rh', false)).toBe(playing)
    // Jumping ahead, going back (the notes played again would count twice) or switching hands: not a best any more,
    // but the run carries on with its notes, slips and time.
    for (const moved of [carryOn(playing, 5, 'rh', false), carryOn(playing, 2, 'rh', false), carryOn(playing, 4, 'both', false)]) {
      expect(moved).toMatchObject({ whole: false, notes: 6 })
      expect(moved.sat.size).toBe(0)
    }
    expect(carryOn({ ...playing, mistakes: 2, ms: 900 }, 2, 'rh', false)).toMatchObject({ idx: 2, notes: 6, mistakes: 2, ms: 900 })
    // Back at the top of the song, or after finishing: a fresh run.
    expect(carryOn(playing, 0, 'rh', false)).toMatchObject({ idx: 0, whole: true, notes: 0 })
    expect(carryOn({ ...playing, done: true }, 4, 'rh', false)).toMatchObject({ idx: 4, whole: false, notes: 0 })
  })

  it('keeps a looping run going when Listen brings you back to the first bar of the loop', () => {
    const looping = { ...newRun('rh'), idx: 3, notes: 9, loops: 2, pass: { notes: 3, mistakes: 0, whole: true } }
    // A new pass starts there, and the loop count stays.
    expect(carryOn(looping, 0, 'rh', true)).toMatchObject({ idx: 0, notes: 9, loops: 2, pass: { notes: 0, mistakes: 0, whole: true } })
  })

  it('gives a little XP for each clean pass round a loop, up to a cap per visit', () => {
    const r = newRun('rh')
    tally(r, 'note')
    tally(r, 'note')
    expect(endPass(r, 0)).toBe(LOOP_XP)
    expect(r).toMatchObject({ idx: 0, loops: 1, notes: 2, pass: { notes: 0, mistakes: 0, whole: true } })
    // A wrong note or a skip on the way round: nothing for that pass.
    tally(r, 'note')
    tally(r, 'slip')
    expect(endPass(r, LOOP_XP)).toBe(0)
    expect(r.mistakes).toBe(1)
    // At most LOOP_XP_MAX in all.
    tally(r, 'note')
    expect(endPass(r, LOOP_XP_MAX - 1)).toBe(1)
    tally(r, 'note')
    expect(endPass(r, LOOP_XP_MAX)).toBe(0)
  })

  it('counts slips per bar, and finds the stretch with the most', () => {
    const r = newRun('rh')
    tally(r, 'slip', 12)
    tally(r, 'slip', 12)
    tally(r, 'note')
    tally(r, 'slip', 3)
    expect(r.barSlips).toEqual({ 3: 1, 12: 2 })
    expect(r.mistakes).toBe(3)
    // Bars 12, 13 and 15 together beat bar 3 alone (and stay within four bars).
    expect(worstStretch({ 3: 1, 12: 3, 13: 2, 15: 1 })).toEqual([12, 15])
    // A tie: the shorter stretch, then the earlier one.
    expect(worstStretch({ 2: 2, 9: 2 })).toEqual([2, 2])
    expect(worstStretch({ 4: 1, 5: 1, 20: 2 })).toEqual([20, 20])
    expect(worstStretch({ 1: 0 })).toBe(null)
  })

  it('keeps how each pass round the loop went, and clean passes in a row', () => {
    const r = newRun('rh')
    const pass = (notes: number, slips: number) => {
      for (let k = 0; k < notes; k++) tally(r, 'note')
      for (let k = 0; k < slips; k++) tally(r, 'slip', 0)
      endPass(r, 0)
    }
    pass(9, 1)
    pass(10, 0)
    pass(10, 0)
    expect(r.passes).toEqual([0.9, 1, 1])
    expect(r.cleanInARow).toBe(2)
    pass(10, 0)
    expect(r.cleanInARow).toBe(CLEAN_GOAL)
    pass(8, 2)
    expect(r.cleanInARow).toBe(0)
    pass(10, 0)
    pass(10, 0)
    expect(r.passes.length).toBe(PASSES_SHOWN)
    // A pass joined part-way doesn't count either way.
    const joined = carryOn({ ...r, notes: 5 }, 2, 'rh', true)
    tally(joined, 'note')
    endPass(joined, 0)
    expect(joined.cleanInARow).toBe(2)
  })

  it('only pays for a pass played all the way round', () => {
    // Joined part-way round (e.g. from where Listen stopped): that pass doesn't count, the next one does.
    const r = carryOn(newRun('rh'), 3, 'rh', true)
    tally(r, 'note')
    expect(endPass(r, 0)).toBe(0)
    tally(r, 'note')
    expect(endPass(r, 0)).toBe(LOOP_XP)
    // Jumping ahead during a pass spoils it too.
    tally(r, 'note')
    const jumped = carryOn({ ...r, idx: 1 }, 2, 'rh', true)
    expect(endPass(jumped, 0)).toBe(0)
  })
})
