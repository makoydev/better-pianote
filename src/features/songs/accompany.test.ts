import { describe, expect, it } from 'vitest'
import { type Song, parseBars } from '../../content/songs'
import { accompaniment, handFilter, listenHand, otherHand } from './accompany'
import { buildSteps, buildTimeline } from './timeline'

const song = (rh: string, lh: string): Song => ({
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
  lh: parseBars(lh),
})

describe('the other hand', () => {
  it('works out which hand Listen plays', () => {
    expect(listenHand('all', 'rh')).toBe('all')
    expect(listenHand('lh', 'both')).toBe('lh')
    // "The hand you're not practising" follows your hands choice; practising both, Listen plays everything.
    expect(listenHand('other', 'rh')).toBe('lh')
    expect(listenHand('other', 'lh')).toBe('rh')
    expect(listenHand('other', 'both')).toBe('all')
    expect(otherHand('both')).toBe(null)
    expect(handFilter('all')).toBe(undefined)
  })

  it('accompanies you up to your next step, in time', () => {
    // Right hand: C5 D5 E5 F5. Left hand: a held C3, then eighths G2 A2 on beats 2 and 2.5, and B2 under F5.
    const tl = buildTimeline(song('C5:q D5 E5 F5', 'C3:h G2:8 A2 B2:q'))
    const rh = buildSteps(tl, 'rh')
    const names = (from: number, to: number) => accompaniment(tl, 'lh', from, to).map((a) => `${a.note.name}@${a.at}`)
    expect(names(rh[0].start, rh[1].start)).toEqual(['C3@0'])
    expect(names(rh[1].start, rh[2].start)).toEqual([])
    expect(names(rh[2].start, rh[3].start)).toEqual(['G2@0', 'A2@0.5'])
    // The last step: the rest of the song.
    expect(names(rh[3].start, tl.total)).toEqual(['B2@0'])
    // The left hand practised alone: the right hand's melody comes along.
    const lh = buildSteps(tl, 'lh')
    expect(accompaniment(tl, 'rh', lh[0].start, lh[1].start).map((a) => a.note.name)).toEqual(['C5', 'D5'])
  })

  it("doesn't double a key your own step plays", () => {
    const tl = buildTimeline(song('C4:w', 'C4:h E3:h'))
    expect(accompaniment(tl, 'lh', 0, 4, [60]).map((a) => a.note.name)).toEqual(['E3'])
  })
})
