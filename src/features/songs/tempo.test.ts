import { describe, expect, it } from 'vitest'
import { MAX_PCT, MIN_PCT, bpmAt, clampTempo, loopSpeedUp, stepTempo, tempoPct } from './tempo'

describe('song tempo', () => {
  it('shows the tempo as a % of the song’s tempo', () => {
    expect(bpmAt(96, 75)).toBe(72)
    expect(tempoPct(72, 96)).toBe(75)
    // Unrounded, so the % stays exact: 55 % of 66 BPM.
    expect(tempoPct(bpmAt(66, 55), 66)).toBe(55)
  })

  it('steps in 5 % of the song’s tempo, onto the 5 % grid', () => {
    expect(tempoPct(stepTempo(72, 96, 1), 96)).toBe(80)
    expect(tempoPct(stepTempo(72, 96, -1), 96)).toBe(70)
    // 74 % (e.g. a tempo from elsewhere) snaps to 75 % or 70 %.
    expect(tempoPct(stepTempo(bpmAt(96, 74), 96, 1), 96)).toBe(75)
    expect(tempoPct(stepTempo(bpmAt(96, 74), 96, -1), 96)).toBe(70)
    // Every step of a slow song lands exactly, with no drift from rounding.
    let bpm = bpmAt(66, 50)
    for (let i = 0; i < 10; i++) bpm = stepTempo(bpm, 66, 1)
    expect(bpm).toBeCloseTo(66)
  })

  it('stays between the slowest and fastest tempo', () => {
    expect(tempoPct(stepTempo(bpmAt(80, MIN_PCT), 80, -1), 80)).toBe(MIN_PCT)
    expect(tempoPct(stepTempo(bpmAt(80, MAX_PCT), 80, 1), 80)).toBe(MAX_PCT)
    expect(clampTempo(500, 80)).toBe(bpmAt(80, MAX_PCT))
    expect(clampTempo(60, 80)).toBe(60)
  })

  it('speeds up each loop by 5 % of the song’s tempo, up to 100 %', () => {
    let bpm = bpmAt(96, 60)
    const pcts = []
    for (let i = 0; i < 10; i++) pcts.push(tempoPct((bpm = loopSpeedUp(bpm, 96)), 96))
    expect(pcts).toEqual([65, 70, 75, 80, 85, 90, 95, 100, 100, 100])
    expect(loopSpeedUp(110, 96)).toBe(110)
  })
})
