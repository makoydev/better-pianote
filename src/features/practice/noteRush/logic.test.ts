import { describe, expect, it } from 'vitest'
import { midi } from '../../../lib/theory'
import { isCorrect, keyboardRange, makeRound, multiplier, nameMatches, naturals, poolFor } from './logic'

describe('note rush', () => {
  it('lists white keys between two notes', () => {
    expect(naturals('D4', 'G4')).toEqual(['D4', 'E4', 'F4', 'G4'])
    expect(naturals('A3', 'C4')).toEqual(['A3', 'B3', 'C4'])
  })

  it('never repeats a note twice in a row', () => {
    const r = makeRound('treble', 1, 200)
    for (let i = 1; i < r.length; i++) expect(r[i].name).not.toBe(r[i - 1].name)
  })

  it('only uses friendly accidentals at level 5', () => {
    const r = makeRound('grand', 5, 400)
    for (const n of r) expect(['E#', 'B#', 'Fb', 'Cb'].some((bad) => n.name.startsWith(bad))).toBe(false)
    expect(r.some((n) => n.name.includes('#'))).toBe(true)
    expect(r.some((n) => n.name[1] === 'b')).toBe(true)
  })

  it('puts grand-staff notes on the right staff', () => {
    for (const p of poolFor('grand', 4)) {
      if (p.staff === 'treble') expect(midi(p.name)).toBeGreaterThanOrEqual(midi('A3'))
      else expect(midi(p.name)).toBeLessThanOrEqual(midi('E4'))
    }
  })

  it('checks answers with or without octave', () => {
    const n = { id: 0, name: 'C4', midi: 60, staff: 'treble' as const }
    expect(isCorrect(n, 72, false)).toBe(true)
    expect(isCorrect(n, 72, true)).toBe(false)
    expect(nameMatches({ ...n, name: 'F#4', midi: 66 }, 3, 1)).toBe(true)
    expect(nameMatches({ ...n, name: 'F#4', midi: 66 }, 4, -1)).toBe(false)
  })

  it('builds multipliers from combos', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 50].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it('keyboard covers the pool in whole octaves', () => {
    expect(keyboardRange('treble', 2)).toEqual([48, 71])
    const [lo, hi] = keyboardRange('bass', 4)
    expect(lo % 12).toBe(0)
    expect(hi % 12).toBe(11)
    expect(lo).toBeLessThanOrEqual(midi('C2'))
  })
})
