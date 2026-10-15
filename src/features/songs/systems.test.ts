import { describe, expect, it } from 'vitest'
import { layoutScore } from '../../components/staff/score'
import { findSong } from '../../content/songs'
import { keyboardHeight, layoutLines, lineAt, linesThatFit, topLine } from './systems'
import { barAt, buildTimeline, songScoreInput } from './timeline'

const opts = { sp: 16, labels: true, fingers: true, labelFor: () => 'C', measure: (t: string, size: number) => t.length * size * 0.6 }

describe('lines of music', () => {
  const song = findSong('ode-to-joy')!
  const tl = buildTimeline(song)
  const inputFor = (from: number, to: number) => songScoreInput(song, tl, { hands: 'both', bars: [from, to] })

  it('squeezes the spacing (as engravers do) to fit more bars on a line', () => {
    // An iPad held upright: at its natural spacing only one bar of Ode to Joy fits a line after the clef.
    const width = 743
    const two = layoutScore(inputFor(0, 1), opts)
    expect(two.width).toBeGreaterThan(width)
    const lines = layoutLines(inputFor, tl.bars.length, width, opts)
    expect(lines[0].to - lines[0].from + 1).toBeGreaterThanOrEqual(2)
    // Squeezed, but never so the notes collide: still wider than the bare minimum.
    const squeezed = layoutScore(inputFor(0, 1), { ...opts, spacing: 0.7 })
    expect(squeezed.width).toBeLessThan(two.width)
    expect(layoutScore(inputFor(0, 1), { ...opts, spacing: 0.01 }).width).toBeLessThan(squeezed.width)
  })

  it('breaks the music into whole bars that fill the width', () => {
    const lines = layoutLines(inputFor, tl.bars.length, 800, opts)
    expect(lines.length).toBeGreaterThan(2)
    // Every bar once, in order.
    expect(lines.flatMap((l) => Array.from({ length: l.to - l.from + 1 }, (_, k) => l.from + k))).toEqual(tl.bars.map((_, i) => i))
    for (const l of lines) expect(l.layout.width).toBeLessThanOrEqual(800 + 0.5)
    // Lines before the last are spread out to the full width.
    for (const l of lines.slice(0, -1)) expect(l.layout.width).toBeCloseTo(800, 0)
    // Only the first line shows the time signature.
    expect(inputFor(0, 1).timeSig).toBe(true)
    expect(inputFor(4, 5).timeSig).toBe(false)
  })

  it('gives a bar too wide for the screen a line of its own', () => {
    const lines = layoutLines(inputFor, tl.bars.length, 200, opts)
    expect(lines.length).toBe(tl.bars.length)
  })

  it('fits as many lines as there is room for, each with the tallest one’s room', () => {
    const lines = layoutLines(inputFor, tl.bars.length, 800, opts)
    const tallest = Math.max(...lines.map((l) => l.layout.height))
    expect(linesThatFit(lines, tallest * 2.5)).toBe(2)
    expect(linesThatFit(lines, tallest * 1.9)).toBe(1)
    expect(linesThatFit(lines, tallest * 9)).toBe(4)
    expect(linesThatFit(lines.slice(0, 1), 5000)).toBe(1)
    expect(lineAt(lines, (t) => barAt(tl, t), tl.bars[lines[1].from].start)).toBe(1)
  })

  it('keeps the lines still while you read down them, then moves the last one shown to the top', () => {
    // Three lines shown out of ten.
    expect(topLine(0, 1, 3, 10)).toBe(0)
    expect(topLine(0, 2, 3, 10)).toBe(2)
    // Two shown: the line you're on is always the top one.
    expect(topLine(0, 1, 2, 10)).toBe(1)
    // Near the end the last lines stay on screen; a loop going back jumps there.
    expect(topLine(6, 9, 3, 10)).toBe(7)
    expect(topLine(7, 2, 3, 10)).toBe(2)
  })
})

describe('keyboard size', () => {
  it('keeps keys in proportion, within a share of the screen', () => {
    // A 13" MacBook, both hands over four octaves: a fifth of the height wins.
    expect(keyboardHeight(1395, 29, 757, true)).toBe(136)
    // iPad portrait: narrow keys make a shorter keyboard (more room for the music).
    expect(keyboardHeight(775, 29, 1180, true)).toBe(174)
    // Keys never get narrower than the scrolling width, and the keyboard never gets tiny.
    expect(keyboardHeight(366, 36, 700, false)).toBe(143)
    expect(keyboardHeight(1000, 15, 400, false)).toBe(110)
  })

  it('is shorter in Focus view, so the music gets the room', () => {
    expect(keyboardHeight(1395, 29, 757, true, true)).toBe(98)
    expect(keyboardHeight(775, 29, 1180, true, true)).toBe(120)
    // A small window: the keys stay big enough to play on.
    expect(keyboardHeight(1000, 29, 550, true, true)).toBe(80)
  })
})
