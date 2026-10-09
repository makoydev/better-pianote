import { describe, expect, it } from 'vitest'
import type { Target } from '../../content/types'
import { midi } from '../../lib/theory'
import { chordMatches, feedNote, initialMatch } from './match'

function run(t: Target, notes: string[]) {
  let s = initialMatch()
  const verdicts: string[] = []
  for (const n of notes) {
    const r = feedNote(t, s, midi(n))
    s = r.state
    verdicts.push(r.verdict)
  }
  return { s, verdicts }
}

describe('lesson targets', () => {
  it('single note, exact octave', () => {
    const t: Target = { type: 'note', notes: ['C4'] }
    expect(run(t, ['C5']).s.done).toBe(false)
    expect(run(t, ['C5', 'C4']).s.done).toBe(true)
  })

  it('single note, any octave', () => {
    expect(run({ type: 'note', notes: ['F4'], anyOctave: true }, ['F2']).s.done).toBe(true)
  })

  it('set in any order, repeats are not mistakes', () => {
    const t: Target = { type: 'set', notes: ['C3', 'C4', 'C5'] }
    const r = run(t, ['C4', 'C4', 'D4', 'C5', 'C3'])
    expect(r.verdicts).toEqual(['good', 'ignore', 'bad', 'good', 'good'])
    expect(r.s.done).toBe(true)
  })

  it('sequence handles repeated notes and keeps progress after a slip', () => {
    const t: Target = { type: 'sequence', notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'] }
    const r = run(t, ['E4', 'D4', 'F4', 'C4', 'D4', 'E4', 'E4', 'E4'])
    expect(r.verdicts.filter((v) => v === 'bad').length).toBe(1)
    expect(r.s.done).toBe(true)
  })

  it('enharmonic spellings match the same key', () => {
    expect(run({ type: 'note', notes: ['Bb4'], anyOctave: true }, ['A#3']).s.done).toBe(true)
  })

  it('chords: exact notes unless anyOctave', () => {
    const t: Target = { type: 'chord', notes: ['C4', 'E4', 'G4'] }
    expect(chordMatches(t, [60, 64, 67])).toBe(true)
    expect(chordMatches(t, [48, 52, 55])).toBe(false)
  })

  it('chords with anyOctave: any voicing, doubled notes ok, wrong extras not ok', () => {
    const t: Target = { type: 'chord', notes: ['C4', 'E4', 'G4'], anyOctave: true }
    expect(chordMatches(t, [48, 64, 67, 72])).toBe(true)
    expect(chordMatches(t, [60, 64])).toBe(false)
    expect(chordMatches(t, [60, 64, 67, 69])).toBe(false)
  })

  it('chords: bass note required for inversions', () => {
    const t: Target = { type: 'chord', notes: ['E4', 'G4', 'C5'], bass: 'E', anyOctave: true }
    expect(chordMatches(t, [64, 67, 72])).toBe(true)
    expect(chordMatches(t, [60, 64, 67])).toBe(false)
  })
})
