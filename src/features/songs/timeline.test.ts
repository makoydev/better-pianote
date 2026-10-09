import { describe, expect, it } from 'vitest'
import { type Song, type SongEvent, findSong, parseBars } from '../../content/songs'
import { barAt, buildSteps, buildTimeline, keyboardRange, songScoreInput } from './timeline'

const make = (rh: string | SongEvent[][], lh?: string | SongEvent[][], extra: Partial<Song> = {}): Song => ({
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
  rh: typeof rh === 'string' ? parseBars(rh) : rh,
  lh: lh === undefined ? undefined : typeof lh === 'string' ? parseBars(lh) : lh,
  ...extra,
})
const ev = (notes: string[], dur: SongEvent['dur'], more: Partial<SongEvent> = {}): SongEvent => ({ notes, dur, dots: 0, tie: false, ...more })
const names = (ns: { name: string }[]) => ns.map((n) => n.name).join('+')

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

  it('ties notes in the left hand too', () => {
    const tl = buildTimeline(make('C4:w | C4:w', 'C3:h~ C3:h | G2:w'))
    const c3 = tl.notes.filter((n) => n.name === 'C3')
    expect(c3.map((n) => [n.start, n.dur, n.cont])).toEqual([
      [0, 4, false],
      [2, 2, true],
    ])
    expect(buildSteps(tl, 'both').map((s) => names(s.notes))).toEqual(['C4+C3', 'C4+G2'])
  })

  it('ties just one note of a chord when only that one is held', () => {
    const tl = buildTimeline(make([[ev(['C4', 'E4'], 'h', { tieNotes: ['C4'] }), ev(['C4', 'G4'], 'h')]]))
    expect(buildSteps(tl, 'rh').map((s) => names(s.notes))).toEqual(['C4+E4', 'G4'])
    expect(tl.notes.find((n) => n.name === 'C4' && !n.cont)!.dur).toBe(4)
  })

  it('merges an extra voice into the steps and the columns', () => {
    const tl = buildTimeline(make('E5:h D5:h', undefined, { voices: [{ hand: 'rh', bars: parseBars('C4:q D4 E4 F4') }] }))
    expect(buildSteps(tl, 'rh').map((s) => names(s.notes))).toEqual(['C4+E5', 'D4', 'E4+D5', 'F4'])
    expect(tl.cols).toEqual([0, 1, 2, 3])
  })

  it("doesn't make columns for hidden filler rests", () => {
    const hidden = [[ev([], 'h', { hidden: true }), ev(['G4'], 'h')]]
    const tl = buildTimeline(make('C5:w', undefined, { voices: [{ hand: 'rh', bars: hidden }] }))
    expect(tl.cols).toEqual([0, 2])
  })

  it('times triplets in thirds of a beat', () => {
    const trip = (n: string, start?: boolean, end?: boolean) => ev([n], '8', { tuplet: { actual: 3, normal: 2, start, end } })
    const tl = buildTimeline(make([[trip('C4', true), trip('D4'), trip('E4', false, true), ev(['F4'], 'h', { dots: 1 })]]))
    expect(tl.notes.map((n) => +n.start.toFixed(4))).toEqual([0, 0.3333, 0.6667, 1])
    expect(tl.total).toBe(4)
  })

  it('finds chord symbols on any voice', () => {
    const tl = buildTimeline(make([[ev([], 'w')]], [[ev(['C3'], 'w', { chord: 'C' })]]))
    expect(tl.chords.map((c) => [c.start, c.symbol])).toEqual([[0, 'C']])
  })

  it('builds the score: one staff for the right hand, two for both, with key changes per bar', () => {
    const song = make('C5:w | C5:w | C5:w', 'C3:w | C3:w | C3:w', { changes: [{ bar: 2, keySig: 2 }] })
    const tl = buildTimeline(song)
    const rh = songScoreInput(song, tl, { hands: 'rh' })
    expect(rh.staves).toEqual(['treble'])
    expect(rh.voices.map((v) => v.staff)).toEqual(['treble'])
    const both = songScoreInput(song, tl, { hands: 'both' })
    expect(both.voices.map((v) => v.staff)).toEqual(['treble', 'bass'])
    expect(both.bars.map((b) => b.keySig)).toEqual([0, 0, 2])
    expect(both.final).toBe(true)
    const excerpt = songScoreInput(song, tl, { hands: 'both', bars: [0, 1] })
    expect(excerpt.bars.length).toBe(2)
    expect(excerpt.final).toBe(false)
    expect(barAt(tl, 4.5)).toBe(1)
  })

  it('picks a keyboard range of at least two octaves starting on C', () => {
    expect(keyboardRange([60, 67])).toEqual({ from: 60, to: 84 })
    expect(keyboardRange([43, 79])).toEqual({ from: 36, to: 84 })
  })
})
