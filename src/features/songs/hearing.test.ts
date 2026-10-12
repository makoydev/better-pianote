import { describe, expect, it } from 'vitest'
import { type Song, parseBars } from '../../content/songs'
import { micHearsNotes } from '../../lib/input/micMatch'
import { midiOf, parseNote } from '../../lib/theory'
import { handSpans, judgeKey, micChordHeard, otherHandKey } from './hearing'
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
const m = (...names: string[]) => names.map((n) => midiOf(parseNote(n)))

describe('judging the keys you play', () => {
  const tl = buildTimeline(song('C5:q E5 [C5,E5,G5]:h | G5:w | A5:w', 'C3:w | G2:w | F3:w'))
  const rh = buildSteps(tl, 'rh')

  it('asks a keyboard for the written octave, and the mic only for the note name', () => {
    const [c5] = m('C5', 'C4')
    expect(judgeKey(rh[0], new Set(), c5, true).verdict).toBe('hit')
    // An octave low on a keyboard: not right, but not a slip either.
    expect(judgeKey(rh[0], new Set(), m('C4')[0], true).verdict).toBe('octave')
    // Through the mic (or with exact octaves off) any C will do.
    expect(judgeKey(rh[0], new Set(), m('C4')[0], false)).toMatchObject({ verdict: 'hit', note: rh[0].notes[0] })
    expect(judgeKey(rh[0], new Set([rh[0].notes[0].id]), c5, true).verdict).toBe('again')
    expect(judgeKey(rh[0], new Set(), m('D5')[0], true).verdict).toBe('wrong')
  })

  it('lets you play along with the other hand while you practise one', () => {
    const spans = handSpans(tl)
    const other = (midi: number) => otherHandKey(spans, 'rh', 0, midi)
    // Right hand around C5–A5, left hand around G2–F3: a C3 is the left hand's.
    expect(judgeKey(rh[0], new Set(), m('C3')[0], true, other).verdict).toBe('other-hand')
    // A C4 is near neither: a wrong note of yours.
    expect(otherHandKey(spans, 'rh', 0, m('C4')[0])).toBe(false)
    // Practising the left hand, the melody's notes are ignored, but not a wrong bass note.
    expect(otherHandKey(spans, 'lh', 1, m('G5')[0])).toBe(true)
    expect(otherHandKey(spans, 'lh', 1, m('B2')[0])).toBe(false)
  })

  it('hears a chord through the mic, leaving out a note still ringing from the step before', () => {
    const chord = rh[2].notes.map((n) => n.midi)
    // E5 from the step before is in the chord too; a D5 ringing on from before would not be.
    const heard = micChordHeard(m('E5', 'D5', 'C5', 'G5'), chord, m('E5', 'D5'))
    expect(heard).toEqual(m('E5', 'C5', 'G5'))
    expect(micHearsNotes(heard, chord)).toBe(true)
    // A stray note that wasn't ringing before still spoils it.
    expect(micHearsNotes(micChordHeard(m('C5', 'E5', 'G5', 'F5'), chord, m('E5')), chord)).toBe(false)
  })
})
