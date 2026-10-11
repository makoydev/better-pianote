import { describe, expect, it } from 'vitest'
import { type Song, type SongEvent, parseBars } from '../../content/songs'
import { type Playhead, advance, beatClicks, buildCues, countIn, firstCueAt, ringingAt } from './listen'
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

  it('plays a pitch two voices start together once, for as long as the longer note', () => {
    const shared: Song = { ...song('C5:h E5:h'), voices: [{ hand: 'rh', bars: parseBars('C5:q D5 E5:h') }] }
    const cues = buildCues(buildTimeline(shared))
    expect(cues.map((c) => c.notes.map((n) => `${n.name}/${n.dur}`).join('+'))).toEqual(['C5/2', 'D5/1', 'E5/2'])
    expect(run(shared, 0, 0, 4, false).out).toEqual([
      [0, 'C5'],
      [1, 'D5'],
      [2, 'E5'],
    ])
    // Starting in the middle brings the shared note back once too.
    const held: Song = { ...song('C5:w'), voices: [{ hand: 'rh', bars: parseBars('C5:h D5:h') }] }
    expect(ringingAt(buildTimeline(held), 1).map((n) => `${n.name}/${n.dur}`)).toEqual(['C5/4'])
  })
})

describe('metronome and count-in', () => {
  const clicks = (s: Song) => beatClicks(s, buildTimeline(s)).map((c) => `${c.t}${c.accent ? '!' : ''}`)
  const time = (beats: number, unit: number): [number, number] => [beats, unit]

  it('clicks every beat, accenting the first of each bar', () => {
    expect(clicks(song('C4:h E4 | G4:w'))).toEqual(['0!', '1', '2', '3', '4!', '5', '6', '7'])
  })

  it('clicks dotted quarters in 6/8, and eighths in 3/8 (counting a pickup back from the bar line)', () => {
    expect(clicks({ ...song('C4:q. E4:q. | G4:h.'), time: time(6, 8) })).toEqual(['0!', '1.5', '3!', '4.5'])
    expect(clicks({ ...song('E5:8 | D5:8 C5 B4 | A4:q.'), time: time(3, 8), pickup: 0.5 })).toEqual(['0', '0.5!', '1', '1.5', '2!', '2.5', '3'])
  })

  it('puts the clicks in the cues without moving the playhead', () => {
    const s = song('C4:h E4:h')
    const tl = buildTimeline(s)
    expect(buildCues(tl, beatClicks(s, tl)).map((c) => [c.t, c.click, c.col, c.notes.length])).toEqual([
      [0, 'bar', true, 1],
      [1, 'beat', false, 0],
      [2, 'beat', true, 1],
      [3, 'beat', false, 0],
    ])
  })

  it('counts in a bar, or up to the beat where the music starts', () => {
    const s = song('C4:q D4 E4 F4 | G4:q A4 B4 C5')
    const tl = buildTimeline(s)
    const top = countIn(s, tl, 0)
    expect(top.beats).toBe(4)
    expect(top.clicks.map((c) => `${c.at}:${c.beat}`)).toEqual(['0:1', '1:2', '2:3', '3:4'])
    // Starting on beat 3 of bar 2: "1 2 3 4 1 2", then the music.
    const mid = countIn(s, tl, 6)
    expect(mid.beats).toBe(6)
    expect(mid.clicks.map((c) => c.beat)).toEqual([1, 2, 3, 4, 1, 2])
  })

  it('counts a pickup in on its beat', () => {
    // 3/4 with a one-beat pickup (like Amazing Grace): "1 2 3 1 2", and the pickup comes on 3.
    const s = { ...song('G4:q | C5:h E5:q | D5:h.'), time: time(3, 4), pickup: 1 }
    const c = countIn(s, buildTimeline(s), 0)
    expect(c.beats).toBe(5)
    expect(c.clicks.map((x) => x.beat)).toEqual([1, 2, 3, 1, 2])
  })

  it('counts two bars when a bar has fewer than three beats (6/8 felt in two)', () => {
    const s = { ...song('C4:q. E4:q. | G4:h.'), time: time(6, 8) }
    const c = countIn(s, buildTimeline(s), 0)
    expect(c.beats).toBe(6)
    expect(c.clicks.map((x) => `${x.at}:${x.beat}`)).toEqual(['0:1', '1.5:2', '3:1', '4.5:2'])
  })

  it('reports where it wraps round the loop (to speed up each pass)', () => {
    const tl = buildTimeline(song('C4:q D4 E4 F4 | G4:q A4 B4 C5'))
    const cues = buildCues(tl)
    const head: Playhead = { pos: 7.875, next: firstCueAt(cues, 7.875) }
    const { due, wraps } = advance(cues, head, 0.25, 4, 8, true)
    expect(wraps).toEqual([0.125])
    expect(names(due)).toEqual(['G4'])
    expect(advance(cues, head, 0.25, 4, 8, true).wraps).toEqual([])
  })
})
