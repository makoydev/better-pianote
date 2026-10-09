import { describe, expect, it } from 'vitest'
import { findSong } from '../../content/songs'
import { buildSteps, buildTimeline, keyboardRange, songStaffItems } from './timeline'

describe('song timeline', () => {
  it('merges tied notes and skips the held half in wait mode', () => {
    const tl = buildTimeline(findSong('amazing-grace')!)
    const d5 = tl.notes.filter((n) => n.name === 'D5' && n.hand === 'rh' && n.start >= 18 && n.start < 24)
    expect(d5.map((n) => [n.start, n.dur, n.cont])).toEqual([
      [19, 5, false],
      [22, 2, true],
    ])
    const steps = buildSteps(tl, 'rh')
    expect(steps.length).toBe(tl.notes.filter((n) => !n.cont).length)
    expect(tl.total).toBe(1 + 15 * 3 + 2)
  })

  it('combines both hands into one step when they start together', () => {
    const tl = buildTimeline(findSong('ode-to-joy')!)
    const both = buildSteps(tl, 'both')
    expect(both[0].notes.map((n) => `${n.hand}:${n.name}`)).toEqual(['rh:E4', 'lh:C3'])
    expect(both[0].chord?.symbol).toBe('C')
    // Bar 12: C (1 beat) then G2 held for three beats under D G
    const bar12 = both.filter((s) => s.bar === 11).map((s) => s.notes.map((n) => n.name).join('+'))
    expect(bar12).toEqual(['C4+C3', 'D4+G2', 'G3'])
  })

  it('never makes a step out of a rest', () => {
    const tl = buildTimeline(findSong('fur-elise')!)
    const steps = buildSteps(tl, 'rh')
    expect(steps.every((s) => s.notes.length > 0)).toBe(true)
    expect(steps.slice(0, 4).map((s) => s.notes[0].name)).toEqual(['E5', 'D#5', 'E5', 'D#5'])
  })

  it('makes staff items with bar lines and a final bar', () => {
    const song = findSong('mary')!
    const { items, eventOf } = songStaffItems(song)
    expect(items.filter((i) => 'bar' in i).length).toBe(8)
    expect(items[items.length - 1]).toEqual({ bar: 'final', key: 'bar7' })
    expect(eventOf.filter((e) => e >= 0).length).toBe(song.rh.flat().length)
  })

  it('picks a keyboard range of at least two octaves starting on C', () => {
    expect(keyboardRange([60, 67])).toEqual({ from: 60, to: 84 })
    expect(keyboardRange([43, 79])).toEqual({ from: 36, to: 84 })
  })
})
