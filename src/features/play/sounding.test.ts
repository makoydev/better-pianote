import { describe, expect, it } from 'vitest'
import { detectChord, midi, noteName, parseChord, parseKey } from '../../lib/theory'
import { BROKEN_MS, Sounding, nameSounding, respelled, sameVoicing, withinChord } from './sounding'

/** Play notes one after another, each released just before the next (like fingers moving on), `gap` ms apart. */
function broken(s: Sounding, notes: string[], start: number, gap = 400): number {
  let t = start
  for (const n of notes) {
    s.noteOn(midi(n), t)
    s.noteOff(midi(n), t + gap - 20)
    t += gap
  }
  return t - gap + 1
}

const chordAt = (s: Sounding, t: number) => nameSounding(s.notes(t), s.heldNotes(), { pedal: s.pedalDown })?.det.symbol ?? null

describe('what is sounding', () => {
  it('names a chord you hold', () => {
    const s = new Sounding()
    for (const n of ['C4', 'E4', 'G4']) s.noteOn(midi(n), 0)
    expect(chordAt(s, 10)).toBe('C')
  })

  it('names a left-hand pattern played under the pedal (River Flows style: A–E–A–C♯)', () => {
    const s = new Sounding()
    s.setPedal(true)
    const t = broken(s, ['A2', 'E3', 'A3', 'C#4'], 0)
    expect(s.heldNotes()).toEqual([])
    expect(chordAt(s, t)).toBe('A')
    // Going back down to the 5th of the same chord doesn't start a new one: still A in root position.
    const t2 = broken(s, ['E3', 'A3'], t + 400)
    expect(chordAt(s, t2)).toBe('A')
  })

  it('starts the next chord at its bass note, even before you change the pedal', () => {
    const s = new Sounding()
    s.setPedal(true)
    let t = broken(s, ['A2', 'E3', 'A3', 'C#4'], 0)
    // Legato pedalling: the new bass goes down while the pedal is still holding the A chord…
    s.noteOn(midi('F#2'), t + 400)
    expect(s.notes(t + 410)).toEqual([midi('F#2')])
    // …then the pedal changes and the pattern carries on.
    s.setPedal(false)
    s.setPedal(true)
    s.noteOff(midi('F#2'), t + 700)
    t = broken(s, ['C#3', 'F#3', 'A3'], t + 800)
    expect(chordAt(s, t)).toBe('F♯m')
  })

  it('starts a new chord when a pattern drops to a bass above the last one', () => {
    const s = new Sounding()
    let t = broken(s, ['E2', 'B2', 'E3', 'G#3'], 0)
    expect(chordAt(s, t)).toBe('E')
    t = broken(s, ['F#2', 'C#3', 'F#3', 'A3'], t + 400)
    expect(chordAt(s, t)).toBe('F♯m')
  })

  it('names a broken chord without the pedal, until you stop playing', () => {
    const s = new Sounding()
    const t = broken(s, ['C3', 'E3', 'G3'], 0)
    expect(chordAt(s, t)).toBe('C')
    expect(chordAt(s, t + 1000)).toBe('C')
    expect(s.notes(t + BROKEN_MS + 500)).toEqual([])
  })

  it('treats notes struck together as one chord, whatever their order', () => {
    const s = new Sounding()
    s.noteOn(midi('E3'), 0)
    s.noteOn(midi('G3'), 20)
    s.noteOn(midi('C3'), 40)
    for (const n of ['E3', 'G3', 'C3']) s.noteOff(midi(n), 500)
    expect(chordAt(s, 600)).toBe('C')
  })

  it('stops what was ringing when you lift the pedal', () => {
    const s = new Sounding()
    s.setPedal(true)
    const t = broken(s, ['A2', 'E3', 'A3', 'C#4'], 0)
    s.noteOn(midi('A4'), t + 100)
    s.setPedal(false)
    expect(s.notes(t + 200)).toEqual([midi('A4')])
  })

  it('looks past a melody over a pedalled chord', () => {
    const s = new Sounding()
    s.setPedal(true)
    const t = broken(s, ['A2', 'E3', 'A3', 'C#4'], 0)
    // D5 doesn't fit A major, but it's a melody note high above the left hand.
    s.noteOn(midi('D5'), t + 50)
    expect(chordAt(s, t + 60)).toBe('A')
  })

  it('names the chord you hold before a broken one that is fading out', () => {
    const s = new Sounding()
    const t = broken(s, ['C4', 'D4', 'E4'], 0, 150)
    for (const n of ['G4', 'B4', 'D5']) s.noteOn(midi(n), t + 100)
    expect(chordAt(s, t + 120)).toBe('G')
  })

  it('keeps the bass of a long pattern but lets old notes go', () => {
    const s = new Sounding()
    s.noteOn(midi('C3'), 0)
    s.noteOff(midi('C3'), 300)
    s.noteOn(midi('G3'), 300)
    s.noteOff(midi('G3'), 600)
    // A long held top note keeps the pattern going.
    s.noteOn(midi('E4'), 600)
    expect(s.notes(5000)).toEqual([midi('C3'), midi('E4')])
  })

  it('says when a broken chord will run out, so the screen can look again', () => {
    const s = new Sounding()
    const t = broken(s, ['C3', 'E3', 'G3'], 0)
    expect(s.nextExpiry(t)).toBe(800 + BROKEN_MS)
    // Under the pedal they ring on (until each note's own time runs out).
    s.setPedal(true)
    expect(s.nextExpiry(t)).toBeGreaterThan(t + BROKEN_MS)
    expect(s.notes(t + BROKEN_MS + 500)).toHaveLength(3)
  })
})

describe('naming what is sounding', () => {
  it('reads a root and 3rd as the full chord through the mic', () => {
    const n = nameSounding([midi('A3'), midi('C4')], [midi('A3'), midi('C4')], { pedal: false, mic: true })
    expect(n?.det.symbol).toBe('Am')
    expect(n?.fifthGuessed).toBe(true)
  })

  it('names nothing for a single note', () => {
    expect(nameSounding([60], [60], { pedal: false })).toBeNull()
  })

  it('doesn’t make chords out of two notes you’ve let go of', () => {
    // A melody under the pedal: E5 then A5 ring together, but that's not an A power chord.
    expect(nameSounding([midi('E5'), midi('A5')], [], { pedal: true })).toBeNull()
    // Two keys you hold are, though.
    expect(nameSounding([midi('E2'), midi('B2')], [midi('E2'), midi('B2')], { pedal: false })?.det.symbol).toBe('E5')
  })

  it('spells a chord named before the key was known the way the key does', () => {
    const det = detectChord([midi('Eb4'), midi('Gb4'), midi('Bb4')])!
    expect(det.symbol).toBe('E♭m')
    const r = respelled(det, parseKey('B'))
    expect(r.symbol).toBe('D♯m')
    expect(r.name).toBe('D♯ minor')
    expect(r.notes.map((n) => noteName(n))).toEqual(['D♯4', 'F♯4', 'A♯4'])
    expect(respelled(det, parseKey('Gb'))).toBe(det)
    expect(respelled(det, null)).toBe(det)
  })

  it('tells a chord played another way from the same voicing', () => {
    const close = detectChord([midi('C4'), midi('E4'), midi('G4')])!
    expect(sameVoicing(close, detectChord([midi('C4'), midi('E4'), midi('G4')])!)).toBe(true)
    expect(sameVoicing(close, detectChord([midi('C3'), midi('G3'), midi('E4')])!)).toBe(false)
    expect(sameVoicing(close, detectChord([midi('C3'), midi('E3'), midi('G3')])!)).toBe(false)
  })

  it('knows notes that are still the same chord', () => {
    expect(withinChord([midi('A2'), midi('E3')], parseChord('A'))).toBe(true)
    expect(withinChord([midi('A2'), midi('D3')], parseChord('A'))).toBe(false)
    expect(withinChord([], parseChord('A'))).toBe(false)
  })
})
