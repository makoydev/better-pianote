import { describe, expect, it } from 'vitest'
import { type Song, type SongEvent, parseBars } from '../../content/songs'
import { type Playhead, advance, buildCues, firstCueAt, ringingAt } from './listen'
import { buildTimeline } from './timeline'

const song = (rh: SongEvent[][] | string, lh?: string): Song => ({
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
  lh: lh ? parseBars(lh) : undefined,
})
const trip = (n: string, edge = {}): SongEvent => ({ notes: [n], dur: '8', dots: 0, tie: false, tuplet: { actual: 3, normal: 2, ...edge } })
const names = (d: { cue: { notes: { name: string }[] } }[]) => d.map((x) => x.cue.notes.map((n) => n.name).join('+'))

/** Run ticks until the music ends (or n ticks), collecting [beat, notes]. */
function run(tlSong: Song, from: number, lo: number, hi: number, looping: boolean, ticks = 200) {
  const tl = buildTimeline(tlSong)
  const cues = buildCues(tl)
  const head: Playhead = { pos: from, next: firstCueAt(cues, from) }
  const out: [number, string][] = []
  let clock = 0
  for (let i = 0; i < ticks; i++) {
    const { due, end } = advance(cues, head, 0.25, lo, hi, looping)
    for (const d of due) out.push([+(clock + d.offset).toFixed(4), d.cue.notes.map((n) => n.name).join('+')])
    if (end !== undefined) return { out, endsAt: +(clock + end).toFixed(4) }
    clock += 0.25
  }
  return { out, endsAt: null }
}

describe('listen mode timing', () => {
  it('plays triplets at exact thirds of a beat (not rounded to sixteenths)', () => {
    const s = song([[trip('C4', { start: true }), trip('D4'), trip('E4', { end: true }), { notes: ['F4'], dur: 'h', dots: 1, tie: false }]])
    expect(run(s, 0, 0, 4, false).out).toEqual([
      [0, 'C4'],
      [0.3333, 'D4'],
      [0.6667, 'E4'],
      [1, 'F4'],
    ])
  })

  it('plays 32nd notes one after another, never together', () => {
    const e = (n: string, dur: SongEvent['dur'], dots = 0): SongEvent => ({ notes: [n], dur, dots, tie: false })
    const s = song([[e('C4', '32'), e('D4', '32'), e('E4', '32'), e('F4', '32'), e('G4', '8'), e('A4', 'h', 1)]])
    expect(run(s, 0, 0, 4, false).out.map(([t]) => t)).toEqual([0, 0.125, 0.25, 0.375, 0.5, 1])
  })

  it('resumes from the middle of the song, then stops at the end', () => {
    const s = song('C4:q D4 E4 F4 | G4:q A4 B4 C5')
    const r = run(s, 5, 0, 8, false)
    expect(r.out).toEqual([
      [0, 'A4'],
      [1, 'B4'],
      [2, 'C5'],
    ])
    expect(r.endsAt).toBe(3)
  })

  it('loops the chosen bars, wrapping in the middle of a tick', () => {
    const s = song('C4:q D4 E4 F4 | G4:q A4 B4 C5 | D5:w')
    // Loop bar 2 only (beats 4–8), starting just before its end.
    const r = run(s, 7, 4, 8, true, 8)
    expect(r.out).toEqual([
      [0, 'C5'],
      [1, 'G4'],
    ])
    expect(r.endsAt).toBeNull()
  })

  it('moves the playhead through rests and left-hand notes too', () => {
    const tl = buildTimeline(song('C5:h r:h', 'C3:q E3 G3 C4'))
    const cues = buildCues(tl)
    expect(cues.map((c) => [c.t, c.col])).toEqual([
      [0, true],
      [1, true],
      [2, true],
      [3, true],
    ])
    expect(names(advance(cues, { pos: 0, next: 0 }, 0.25, 0, 4, false).due)).toEqual(['C5+C3'])
  })

  it('picks up notes still ringing where playback starts', () => {
    const tl = buildTimeline(song('C5:w', 'C3:q E3 G3 C4'))
    expect(ringingAt(tl, 2).map((n) => n.name)).toEqual(['C5'])
    expect(ringingAt(tl, 0)).toEqual([])
  })
})
