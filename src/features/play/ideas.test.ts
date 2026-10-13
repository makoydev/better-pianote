import { describe, expect, it } from 'vitest'
import { type Idea, KEEP_MS, PEDAL, Recorder, ideaToMidi, lengthText, mergeIdeas, readIdea, soundsOf } from './ideas'

describe('the last couple of minutes', () => {
  it('takes from the first note to the last thing played, the pedal as it was', () => {
    const r = new Recorder()
    r.add(1000, PEDAL, 1)
    r.add(5000, 60, 90)
    r.add(5400, 60, 0)
    r.add(6000, 64, 70)
    r.add(6500, PEDAL, 0)
    r.add(7000, 64, 0)
    expect(r.has(8000)).toBe(true)
    expect(r.take(8000)).toEqual({
      from: 5000,
      ms: 2000,
      events: [
        [0, PEDAL, 1],
        [0, 60, 90],
        [400, 60, 0],
        [1000, 64, 70],
        [1500, PEDAL, 0],
        [2000, 64, 0],
      ],
    })
  })

  it('reaches back two minutes, leaving out a key let go that went down before', () => {
    const r = new Recorder()
    r.add(0, 48, 80)
    r.add(10_000, 60, 80)
    r.add(KEEP_MS + 5_000, 48, 0)
    r.add(KEEP_MS + 6_000, 62, 80)
    r.add(KEEP_MS + 6_500, 62, 0)
    // The C3 went down two minutes ago (outside the reach) and the C4 too: the take starts at the D.
    const t = r.take(KEEP_MS + 12_000)!
    expect(t.events).toEqual([
      [0, 62, 80],
      [500, 62, 0],
    ])
  })

  it('lets go of keys and the pedal still down when you save', () => {
    const r = new Recorder()
    r.add(100, 60, 90)
    r.add(200, PEDAL, 1)
    expect(r.take(3100)).toEqual({
      from: 100,
      ms: 3000,
      events: [
        [0, 60, 90],
        [100, PEDAL, 1],
        [3000, 60, 0],
        [3000, PEDAL, 0],
      ],
    })
  })

  it('starts the next take after the last one saved', () => {
    const r = new Recorder()
    r.add(100, 60, 90)
    r.add(500, 60, 0)
    r.saved(1000)
    expect(r.has(1500)).toBe(false)
    expect(r.take(1500)).toBeNull()
    r.add(2000, 62, 80)
    r.add(2600, 62, 0)
    expect(r.take(3000)).toEqual({ from: 2000, ms: 600, events: [[0, 62, 80], [600, 62, 0]] })
  })

  it('has nothing to take before a note is played', () => {
    const r = new Recorder()
    r.add(100, PEDAL, 1)
    expect(r.has(200)).toBe(false)
    expect(r.take(200)).toBeNull()
  })
})

describe('playing an idea back', () => {
  it('holds notes on while the pedal is down, and a key struck again ends its last sound', () => {
    const sounds = soundsOf(
      [
        [0, 60, 127],
        [100, PEDAL, 1],
        [200, 60, 0],
        [500, 64, 64],
        [600, 64, 0],
        [800, 64, 64],
        [900, PEDAL, 0],
        [1000, 64, 0],
      ],
      1200,
    )
    expect(sounds.map((s) => [s.midi, s.at, s.dur])).toEqual([
      [60, 0, 900],
      [64, 500, 300],
      [64, 800, 200],
    ])
    expect(sounds[0].vel).toBe(1)
  })

  it('writes a MIDI file a DAW can open', () => {
    const idea: Idea = { id: 1, name: 'x', ms: 1000, events: [[0, 60, 100], [500, 60, 0], [500, PEDAL, 1], [1000, PEDAL, 0]] }
    const bytes = [...ideaToMidi(idea)]
    expect(bytes.slice(0, 4)).toEqual([0x4d, 0x54, 0x68, 0x64])
    // Format 0, one track, 480 ticks a quarter note.
    expect(bytes.slice(8, 14)).toEqual([0, 0, 0, 1, 1, 0xe0])
    const track = bytes.slice(22)
    expect(bytes.slice(18, 22)).toEqual([0, 0, 0, track.length])
    // 500 ms at 120 BPM is 480 ticks: 0x83 0x60 as a variable-length number.
    expect(track.slice(10)).toEqual([0x00, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0x00, 0xb0, 64, 127, 0x83, 0x60, 0xb0, 64, 0, 0x00, 0xff, 0x2f, 0x00])
  })

  it('says how long it is', () => {
    expect(lengthText(72_400)).toBe('1:12')
    expect(lengthText(300)).toBe('0:01')
  })
})

describe('ideas from a backup', () => {
  const idea = (id: number): Idea => ({ id, name: `#${id}`, ms: 1000, events: [[0, 60, 90], [1000, 60, 0]] })

  it('keeps every idea once, newest first', () => {
    expect(mergeIdeas([idea(3), idea(1)], [idea(2), idea(1)]).map((i) => i.id)).toEqual([3, 2, 1])
  })

  it('drops what doesn’t read', () => {
    expect(readIdea({ id: 1, name: 'x', ms: 10, events: [[0, 60, 90], [5, 'C', 0], [9, 200, 1]], key: 'A', chords: ['A', 3] })).toEqual({
      id: 1,
      name: 'x',
      ms: 10,
      events: [[0, 60, 90]],
      key: 'A',
      chords: ['A'],
    })
    expect(readIdea({ id: 'x' })).toBeNull()
  })
})
