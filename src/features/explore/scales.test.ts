import { describe, expect, it } from 'vitest'
import { SCALE_TYPE, SCALE_TYPES, midiOf, mod, noteName, parseNote, pcOf } from '../../lib/theory'
import { type Hands, type Octaves, noteId, runFingering, runScore, scaleRun, startOctaves, stepOfId } from './scales'

const f = (s: string) => s.split(' ').map(Number)
const two = (tonic: string, type = 'major') => runFingering(parseNote(`${tonic}4`), SCALE_TYPE[type], 2)

// Two-octave fingerings as scale books print them (ascending; the left hand reads left to right too).
const C_RH = '1 2 3 1 2 3 4 1 2 3 1 2 3 4 5'
const C_LH = '5 4 3 2 1 3 2 1 4 3 2 1 3 2 1'
const FLAT_LH = '3 2 1 4 3 2 1 3 2 1 4 3 2 1 3'
const MAJORS: [string, string, string][] = [
  ['C', C_RH, C_LH],
  ['G', C_RH, C_LH],
  ['D', C_RH, C_LH],
  ['A', C_RH, C_LH],
  ['E', C_RH, C_LH],
  ['B', C_RH, '4 3 2 1 4 3 2 1 3 2 1 4 3 2 1'],
  ['F#', '2 3 4 1 2 3 1 2 3 4 1 2 3 1 2', '4 3 2 1 3 2 1 4 3 2 1 3 2 1 4'],
  ['Db', '2 3 1 2 3 4 1 2 3 1 2 3 4 1 2', FLAT_LH],
  ['Ab', '3 4 1 2 3 1 2 3 4 1 2 3 1 2 3', FLAT_LH],
  ['Eb', '3 1 2 3 4 1 2 3 1 2 3 4 1 2 3', FLAT_LH],
  ['Bb', '2 1 2 3 1 2 3 4 1 2 3 1 2 3 4', FLAT_LH],
  ['F', '1 2 3 4 1 2 3 1 2 3 4 1 2 3 4', C_LH],
]
const MINORS: [string, string, string][] = [
  ['A', C_RH, C_LH],
  ['E', C_RH, C_LH],
  ['D', C_RH, C_LH],
  ['G', C_RH, C_LH],
  ['C', C_RH, C_LH],
  ['B', C_RH, '4 3 2 1 4 3 2 1 3 2 1 4 3 2 1'],
  ['F', '1 2 3 4 1 2 3 1 2 3 4 1 2 3 4', C_LH],
]

describe('two-octave fingering', () => {
  it.each(MAJORS)('%s major', (tonic, rh, lh) => {
    expect(two(tonic)).toEqual({ rh: f(rh), lh: f(lh) })
  })

  it.each(MINORS)('%s minor, natural and harmonic', (tonic, rh, lh) => {
    expect(two(tonic, 'minor')).toEqual({ rh: f(rh), lh: f(lh) })
    expect(two(tonic, 'harmonic-minor')).toEqual({ rh: f(rh), lh: f(lh) })
  })

  it('keeps one octave as the library has it, and has none where there’s no trusted one', () => {
    expect(runFingering(parseNote('C4'), SCALE_TYPE.major, 1)).toEqual({ rh: f('1 2 3 1 2 3 4 5'), lh: f('5 4 3 2 1 3 2 1') })
    expect(runFingering(parseNote('C4'), SCALE_TYPE['major-pentatonic'], 2)).toBeNull()
    expect(runFingering(parseNote('F#4'), SCALE_TYPE.minor, 2)).toBeNull()
  })

  it('puts the thumb on a white key and never two thumbs in a row', () => {
    for (const [tonic] of MAJORS) {
      const run = scaleRun(parseNote(`${tonic}4`), SCALE_TYPE.major, 'both', 2, false)
      for (const hand of ['rh', 'lh'] as const) {
        const notes = run[hand]
        const fingers = run.fingering![hand]
        fingers.forEach((finger, i) => {
          if (finger === 1) expect([1, 3, 6, 8, 10], `${tonic} ${hand} ${noteName(notes[i])}`).not.toContain(pcOf(notes[i]))
          if (i > 0) expect(finger === 1 && fingers[i - 1] === 1, `${tonic} ${hand} at ${i}`).toBe(false)
        })
      }
    }
  })
})

describe('where each hand plays', () => {
  it('keeps one octave where it was: right hand from octave 4, left from 3', () => {
    expect(startOctaves(parseNote('B4'), 'both', 1)).toEqual({ rh: 4, lh: 3 })
  })

  it('places two octaves to keep ledger lines down', () => {
    expect(startOctaves(parseNote('C4'), 'rh', 2).rh).toBe(4)
    expect(startOctaves(parseNote('F4'), 'rh', 2).rh).toBe(4)
    expect(startOctaves(parseNote('G4'), 'rh', 2).rh).toBe(3)
    expect(startOctaves(parseNote('Bb4'), 'rh', 2).rh).toBe(3)
    expect(startOctaves(parseNote('A4'), 'lh', 2).lh).toBe(2)
    expect(startOctaves(parseNote('C4'), 'both', 2)).toEqual({ rh: 4, lh: 3 })
    expect(startOctaves(parseNote('D4'), 'both', 2)).toEqual({ rh: 3, lh: 2 })
  })

  it('stays on a 61-key keyboard (C2–C7), with the hands an octave apart', () => {
    const tonics = ['C', 'Db', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'G#', 'A', 'Bb', 'B']
    for (const t of tonics) {
      for (const type of SCALE_TYPES) {
        for (const hands of ['rh', 'lh', 'both'] as Hands[]) {
          for (const octaves of [1, 2] as Octaves[]) {
            const run = scaleRun(parseNote(`${t}4`), type, hands, octaves, true)
            for (const s of run.steps) {
              for (const h of [s.rh, s.lh]) if (h) expect(h.midi, `${t} ${type.id} ${hands} ${octaves}`).toBeGreaterThanOrEqual(36)
              for (const h of [s.rh, s.lh]) if (h) expect(h.midi, `${t} ${type.id} ${hands} ${octaves}`).toBeLessThanOrEqual(96)
              if (s.rh && s.lh) expect(s.rh.midi - s.lh.midi).toBe(12)
            }
          }
        }
      }
    }
  })
})

describe('the run', () => {
  it('goes up and back down with the fingers for each note', () => {
    const run = scaleRun(parseNote('C4'), SCALE_TYPE.major, 'rh', 1, true)
    expect(run.steps.map((s) => s.pos)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0])
    expect(run.steps.map((s) => s.rh!.finger)).toEqual(f('1 2 3 1 2 3 4 5 4 3 2 1 3 2 1'))
    expect(run.steps[7].rh!.note).toEqual(parseNote('C5'))
    expect(run.steps.every((s) => !s.lh)).toBe(true)
  })

  it('plays the same note names in both hands', () => {
    const run = scaleRun(parseNote('Eb4'), SCALE_TYPE.major, 'both', 2, true)
    expect(run.steps).toHaveLength(29)
    for (const s of run.steps) expect(mod(pcOf(s.rh!.note), 12)).toBe(pcOf(s.lh!.note))
    expect(noteName(run.steps[0].rh!.note)).toBe('E♭3')
    expect(noteName(run.steps[14].rh!.note)).toBe('E♭5')
    expect(run.steps[0].lh!.finger).toBe(3)
    expect(run.steps[14].lh!.finger).toBe(3)
  })

  it('spells the notes from the scale (no enharmonic surprises)', () => {
    const run = scaleRun(parseNote('F#4'), SCALE_TYPE.major, 'rh', 2, false)
    expect(run.rh.map((n) => noteName(n, { octave: false })).join(' ')).toBe('F♯ G♯ A♯ B C♯ D♯ E♯ F♯ G♯ A♯ B C♯ D♯ E♯ F♯')
    expect(run.steps.map((s) => s.rh!.midi)).toEqual(run.rh.map(midiOf))
  })
})

describe('the score', () => {
  const beats = (input: ReturnType<typeof runScore>) => input.bars.reduce((s, b) => s + b.dur, 0)

  it('fills whole 4/4 bars, holding the last note', () => {
    const up1 = runScore(scaleRun(parseNote('C4'), SCALE_TYPE.major, 'rh', 1, false).steps, 0)
    expect(beats(up1)).toBe(8)
    expect(up1.voices[0].events.at(-1)!.dur).toBe('q')
    const updown1 = runScore(scaleRun(parseNote('C4'), SCALE_TYPE.major, 'rh', 1, true).steps, 0)
    expect(beats(updown1)).toBe(16)
    expect(updown1.voices[0].events.at(-1)!.dur).toBe('h')
    const updown2 = runScore(scaleRun(parseNote('C4'), SCALE_TYPE.major, 'rh', 2, true).steps, 0)
    expect(beats(updown2)).toBe(32)
    expect(updown2.voices[0].events.at(-1)!.dur).toBe('w')
    const penta = runScore(scaleRun(parseNote('C4'), SCALE_TYPE['major-pentatonic'], 'rh', 1, false).steps, 0)
    expect(penta.voices[0].events.at(-1)).toMatchObject({ dur: 'h', dots: 1 })
  })

  it('writes hands together on a grand staff, each hand on its own staff', () => {
    const input = runScore(scaleRun(parseNote('G4'), SCALE_TYPE.major, 'both', 2, true).steps, 1)
    expect(input.staves).toEqual(['treble', 'bass'])
    expect(input.voices.map((v) => v.staff)).toEqual(['treble', 'bass'])
    expect(input.bars.every((b) => b.keySig === 1)).toBe(true)
    const ids = input.voices.flatMap((v) => v.events.flatMap((e) => e.notes.map((n) => n.id)))
    expect(new Set(ids).size).toBe(ids.length)
    expect(stepOfId(noteId(7, 'lh'))).toBe(7)
    expect(runScore(scaleRun(parseNote('G4'), SCALE_TYPE.major, 'lh', 1, true).steps, 1).staves).toEqual(['bass'])
  })
})
