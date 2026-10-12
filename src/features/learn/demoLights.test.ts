import { describe, expect, it } from 'vitest'
import { demoSchedule } from './demoLights'

describe('demo key lights', () => {
  it('lights each note of a sequence as it sounds, out just before the next', () => {
    const s = demoSchedule([60, 62, 64], { gap: 0.5, dur: 0.75 })
    expect(s.map((x) => x.midi)).toEqual([60, 62, 64])
    expect(s.map((x) => x.on)).toEqual([0, 0.5, 1])
    expect(s[0].off).toBeCloseTo(0.425)
    expect(s[0].off).toBeLessThan(s[1].on)
    // The last note stays lit while it rings.
    expect(s[2].off).toBeCloseTo(1.75)
  })

  it('blinks a repeated note', () => {
    const [a, b] = demoSchedule([64, 64], { gap: 0.45, dur: 0.675 })
    expect(a.off).toBeLessThan(b.on)
  })

  it('lights a chord together, or note by note when it rolls', () => {
    expect(demoSchedule([[60, 64, 67]], { gap: 0, dur: 1.6 }).map((x) => [x.on, x.off])).toEqual([
      [0, 1.6],
      [0, 1.6],
      [0, 1.6],
    ])
    const rolled = demoSchedule([[60, 64, 67]], { gap: 0, dur: 1.6, strum: 0.04 })
    expect(rolled.map((x) => x.on)).toEqual([0, 0.04, 0.08])
  })

  it('keeps short notes short', () => {
    const [a] = demoSchedule([60, 62], { gap: 1, dur: 0.3 })
    expect(a.off).toBeCloseTo(0.3)
  })
})
