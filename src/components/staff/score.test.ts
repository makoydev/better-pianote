import { describe, expect, it } from 'vitest'
import { parseNote } from '../../lib/theory'
import { GLYPH, WIDTH, tupletDigit } from './glyphs'
import type { Duration } from './layout'
import { type ScoreBar, type ScoreEvent, type ScoreInput, type ScoreNote, colX, layoutScore } from './score'

const SP = 10
const opts = { sp: SP, labels: false, fingers: true, labelFor: () => '', measure: (t: string, size: number) => t.length * size * 0.6 }
let nid = 0
const n = (name: string, more: Partial<ScoreNote> = {}): ScoreNote => ({ id: nid++, note: parseNote(name), tie: false, cont: false, ...more })
const e = (key: string, start: number, dur: Duration, notes: (string | ScoreNote)[], more: Partial<ScoreEvent> = {}): ScoreEvent => ({
  key,
  start,
  dur,
  dots: 0,
  notes: notes.map((x) => (typeof x === 'string' ? n(x) : x)),
  ...more,
})
const bar = (start: number, keySig = 0): ScoreBar => ({ start, dur: 4, keySig, time: [4, 4] })
const treble = (...events: ScoreEvent[]) => ({ staff: 'treble' as const, events })
const bass = (...events: ScoreEvent[]) => ({ staff: 'bass' as const, events })
const lay = (input: Partial<ScoreInput>) => layoutScore({ staves: ['treble'], bars: [bar(0)], voices: [], chords: [], ...input }, opts)
const ev = (l: ReturnType<typeof lay>, key: string) => l.events.find((x) => x.key === key)!
const stemOf = (x: ReturnType<typeof ev>) => x.lines.find((l) => l.x1 === l.x2 && Math.abs(l.y2 - l.y1) > SP)!

describe('score layout', () => {
  it('lines up notes that start together on both staves', () => {
    const l = lay({
      staves: ['treble', 'bass'],
      voices: [
        treble(e('a', 0, 'h', ['E5']), e('b', 2, 'h', ['D5'])),
        bass(e('c', 0, 'q', ['C3']), e('d', 1, 'q', ['E3']), e('e', 2, 'q', ['G3']), e('f', 3, 'q', ['C4'])),
      ],
    })
    expect(ev(l, 'a').headX).toBe(ev(l, 'c').headX)
    expect(ev(l, 'b').headX).toBe(ev(l, 'e').headX)
    expect(ev(l, 'd').headX).toBeGreaterThan(ev(l, 'c').headX)
    expect(l.cols.map((c) => c.t)).toEqual([0, 1, 2, 3])
    expect(colX(l, 2.5)).toBe(ev(l, 'b').headX)
    expect(l.staffTop.bass).toBeGreaterThanOrEqual(8 * SP)
  })

  it('gives two voices on one staff opposite stems, and moves the upper one over when they are a second apart', () => {
    const l = lay({
      voices: [treble(e('u1', 0, 'h', ['E4']), e('u2', 2, 'h', ['G5'])), treble(e('d1', 0, 'h', ['D4']), e('d2', 2, 'h', ['C4']))],
    })
    expect(stemOf(ev(l, 'u2')).y2).toBeLessThan(ev(l, 'u2').notes[0].y)
    expect(stemOf(ev(l, 'd2')).y2).toBeGreaterThan(ev(l, 'd2').notes[0].y)
    expect(ev(l, 'u1').headX).toBeGreaterThan(ev(l, 'd1').headX)
    expect(ev(l, 'u2').headX).toBe(ev(l, 'd2').headX)
  })

  it('numbers a beamed triplet without a bracket', () => {
    const t = (key: string, start: number, edge: object) => e(key, start, '8', ['C5'], { tuplet: { actual: 3, normal: 2, ...edge } })
    const l = lay({ voices: [treble(t('t1', 0, { start: true }), t('t2', 1 / 3, {}), t('t3', 2 / 3, { end: true }), e('h', 1, 'h', ['C5'], { dots: 1 }))] })
    expect(l.extras.glyphs.map((g) => g.ch)).toEqual([tupletDigit(3)])
    expect(l.extras.lines).toEqual([])
    expect(l.beams.length).toBe(1)
  })

  it('brackets a triplet that is not beamed', () => {
    const t = (key: string, start: number, edge: object) => e(key, start, 'q', ['C5'], { tuplet: { actual: 3, normal: 2, ...edge } })
    const l = lay({ voices: [treble(t('t1', 0, { start: true }), t('t2', 2 / 3, {}), t('t3', 4 / 3, { end: true }), e('h', 2, 'h', ['C5']))] })
    expect(l.extras.glyphs.length).toBe(1)
    expect(l.extras.lines.length).toBe(4)
  })

  it('gives 32nd notes three beams', () => {
    const l = lay({
      voices: [
        treble(
          e('a', 0, '32', ['C5']),
          e('b', 0.125, '32', ['D5']),
          e('c', 0.25, '32', ['E5']),
          e('d', 0.375, '32', ['F5']),
          e('e', 0.5, '8', ['G5']),
          e('f', 1, 'h', ['C5'], { dots: 1 }),
        ),
      ],
    })
    // One main beam, then three segments each for the second and third beams.
    expect(l.beams.length).toBe(7)
  })

  it('centres a rest that fills a whole bar', () => {
    const l = lay({ bars: [bar(0), bar(4)], voices: [treble(e('a', 0, 'w', ['C5']), e('r', 4, 'w', []))] })
    const rest = ev(l, 'r').glyphs[0]
    expect(rest.ch).toBe(GLYPH.restWhole)
    const [mid, end] = l.bars.map((b) => b.x1)
    const centre = rest.x + (WIDTH.restWhole * SP) / 2
    expect(Math.abs(centre - (mid + end) / 2)).toBeLessThan(2 * SP)
  })

  it('shows accidentals per bar, carries them through a tie without repeating them', () => {
    const fsTie = n('F#4', { tie: true })
    const fsCont = n('F#4', { cont: true })
    const l = lay({
      bars: [bar(0), bar(4)],
      voices: [
        treble(
          e('a', 0, 'q', ['F#4']),
          e('b', 1, 'q', ['G4']),
          e('c', 2, 'q', ['F#4']),
          e('d', 3, 'q', [fsTie]),
          e('e', 4, 'q', [fsCont]),
          e('f', 5, 'q', ['F#4']),
          e('g', 6, 'q', ['F4']),
          e('h', 7, 'q', ['F4']),
        ),
      ],
    })
    const acc = (key: string) => ev(l, key).glyphs.map((g) => g.ch).filter((c) => [GLYPH.sharp, GLYPH.natural, GLYPH.flat].includes(c as never))
    expect(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => acc(k).join(''))).toEqual([GLYPH.sharp, '', '', '', '', GLYPH.sharp, GLYPH.natural, ''])
    expect(l.ties.length).toBe(1)
  })

  it('marks a key change with a double bar line and cancelling naturals', () => {
    const l = lay({ bars: [bar(0, 2), bar(4, 0)], voices: [treble(e('a', 0, 'w', ['D5']), e('b', 4, 'w', ['C5']))] })
    expect(l.header.filter((g) => g.ch === GLYPH.natural).length).toBe(2)
    const xs = l.bars.map((b) => b.x1)
    expect(xs.some((x, i) => i > 0 && Math.abs(x - xs[i - 1] - 0.5 * SP) < 1e-6)).toBe(true)
  })

  it('puts chord symbols on the column where they start', () => {
    const l = lay({ voices: [treble(e('a', 0, 'h', ['E5']), e('b', 2, 'h', ['D5']))], chords: [{ start: 2, text: 'G' }] })
    expect(l.extras.texts.map((t) => [t.text, t.x])).toEqual([['G', ev(l, 'b').headX]])
  })
})
