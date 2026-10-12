import { describe, expect, it } from 'vitest'
import { type Song, parseBars } from '../../content/songs'
import { barLabel, barName, barTitle, barsName, countedStraight, ordinal, shownBar } from './bars'

const song = (rh: string, extra: Partial<Song> = {}): Song => ({
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
  rh: parseBars(rh),
  ...extra,
})

describe('bar names', () => {
  it('counts from the first full bar, after any pickup', () => {
    const s = song('G4:q | C5:w | D5:w', { pickup: 1 })
    expect([0, 1, 2].map((i) => barLabel(s, i))).toEqual(['Pickup', '1', '2'])
    expect(barName(s, 0)).toBe('the pickup')
    expect(barTitle(s, 2)).toBe('Bar 2')
    expect(countedStraight(s)).toBe(true)
    expect(shownBar(s, 0)).toBe(1)
    expect(shownBar(s, 2)).toBe(2)
    expect(barsName(s, 1, 2)).toBe('bars 1–2')
    expect(barsName(s, 0, 1)).toBe('the pickup to bar 1')
    expect(barsName(s, 2, 2)).toBe('bar 2')
  })

  it('uses the numbers printed on an imported score, with the time through a repeat', () => {
    const s = song('C4:w | D4:w | C4:w | D4:w | E4:w', {
      barNumbers: [
        { number: '13', pass: 1 },
        { number: '14', pass: 1 },
        { number: '13', pass: 2 },
        { number: '14', pass: 2 },
        { number: '15', pass: 1 },
      ],
    })
    expect(barTitle(s, 3)).toBe('Bar 14 (2nd time)')
    expect(barName(s, 1)).toBe('bar 14')
    expect(barLabel(s, 2)).toBe('13 (2nd time)')
    expect(countedStraight(s)).toBe(false)
    expect(shownBar(s, 3)).toBe(14)
  })

  it('ignores printed numbers that don’t match the bars', () => {
    const s = song('C4:w | D4:w', { barNumbers: [{ number: '7', pass: 1 }] })
    expect(barLabel(s, 1)).toBe('2')
  })

  it('says 1st, 2nd, 3rd, 4th … 11th, 12th, 21st', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st'])
  })
})
