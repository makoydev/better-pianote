import { describe, expect, it } from 'vitest'
import { midi, parseChord } from '../theory'
import { micHearsChord, micHearsNotes, nameHeardChord } from './micMatch'

const m = (...ns: string[]) => ns.map(midi)

describe('chords heard through the mic', () => {
  it('accepts the full chord in any octave', () => {
    expect(micHearsChord(m('C3', 'E4', 'G4'), parseChord('C'))).toBe(true)
  })

  it('forgives a missing perfect 5th, but not a missing 3rd or root', () => {
    expect(micHearsChord(m('G3', 'B3'), parseChord('G'))).toBe(true)
    expect(micHearsChord(m('G3', 'D4'), parseChord('G'))).toBe(false)
    expect(micHearsChord(m('B3', 'D4'), parseChord('G'))).toBe(false)
    expect(micHearsChord(m('G3', 'B3', 'F4'), parseChord('G7'))).toBe(true)
  })

  it('stays strict for diminished and augmented chords', () => {
    expect(micHearsChord(m('B3', 'D4'), parseChord('Bdim'))).toBe(false)
    expect(micHearsChord(m('C4', 'E4'), parseChord('Caug'))).toBe(false)
  })

  it('rejects notes outside the chord and checks the bass of slash chords', () => {
    expect(micHearsChord(m('C4', 'E4', 'G4', 'A4'), parseChord('C'))).toBe(false)
    expect(micHearsChord(m('E3', 'G3', 'C4'), parseChord('C/E'))).toBe(true)
    expect(micHearsChord(m('C3', 'E3', 'G3'), parseChord('C/E'))).toBe(false)
  })

  it('works for lesson targets given as notes, inversions included', () => {
    expect(micHearsNotes(m('E4', 'C5'), m('E4', 'G4', 'C5'), midi('E4'))).toBe(true)
    expect(micHearsNotes(m('E3', 'G3'), m('E3', 'G3'))).toBe(true)
    expect(micHearsNotes(m('E3'), m('E3', 'G3'))).toBe(false)
  })
})

describe('naming chords heard through the mic', () => {
  const name = (...ns: string[]) => {
    const r = nameHeardChord(m(...ns))
    return r ? `${r.det.symbol}${r.fifthGuessed ? ' (5th guessed)' : ''}` : null
  }

  it('names full chords as usual', () => {
    expect(name('C4', 'E4', 'G4')).toBe('C')
    expect(name('G3', 'B3', 'D4', 'F4')).toBe('G7')
  })

  it('reads a bass note plus its 3rd as the full chord', () => {
    expect(name('F#2', 'A3')).toBe('F♯m (5th guessed)')
    expect(name('D3', 'F#4')).toBe('D (5th guessed)')
    expect(name('A2', 'C#4')).toBe('A (5th guessed)')
  })

  it('leaves other pairs alone', () => {
    expect(name('C4', 'G4')).toBe('C5')
    expect(name('C4', 'D4')).toBeNull()
  })
})

