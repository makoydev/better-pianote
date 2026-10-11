import { describe, expect, it } from 'vitest'
import { CHORD_TYPE, chordSymbol, midi, parseChord, parseKey } from '../../../lib/theory'
import { TRAINER_LEVELS, chordRecipe, matchChord, pickRound } from './chords'
import { ECHO_LEVELS, INTERVAL_LEVELS, type IntervalQ, type QualityQ, describeMiss, makeEcho, makeInterval, optionNotes, rightOption } from './ear'
import { KEY_LEVELS, describeKeyMiss, makeKeyQuestion } from './keys'
import { RHYTHM_LEVELS, countLabel, makePattern, onsetBeats, patternToStaff, scoreTaps } from './rhythm'

const m = (...names: string[]) => names.map(midi)

/** Small deterministic random generator so tests are repeatable. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('chord matching', () => {
  const C = parseChord('C')
  it('accepts any voicing and doubling', () => {
    expect(matchChord(m('C4', 'E4', 'G4'), C)).toBe('correct')
    expect(matchChord(m('E3', 'G3', 'C4'), C)).toBe('correct')
    expect(matchChord(m('C3', 'G3', 'C4', 'E4', 'G4'), C)).toBe('correct')
  })
  it('reports partial, wrong and empty', () => {
    expect(matchChord([], C)).toBe('empty')
    expect(matchChord(m('C4', 'E4'), C)).toBe('partial')
    expect(matchChord(m('C4', 'Eb4', 'G4'), C)).toBe('wrong')
  })
  it('requires the bass for slash chords', () => {
    const CE = parseChord('C/E')
    expect(matchChord(m('E3', 'G3', 'C4'), CE)).toBe('correct')
    expect(matchChord(m('C4', 'E4', 'G4'), CE)).toBe('bass')
  })
  it('gives recipes in half steps', () => {
    expect(chordRecipe(parseChord('C').type)).toBe('Root + 4 + 3 half steps')
    expect(chordRecipe(parseChord('Am').type)).toBe('Root + 3 + 4 half steps')
    expect(chordRecipe(parseChord('G7').type)).toBe('Root + 4 + 3 + 3 half steps')
  })
  it('builds rounds without back-to-back repeats', () => {
    const pool = TRAINER_LEVELS[0].pool()
    const round = pickRound(pool, 10, seeded(3))
    expect(round).toHaveLength(10)
    for (let i = 1; i < round.length; i++) expect(chordSymbol(round[i])).not.toBe(chordSymbol(round[i - 1]))
  })
  it('spells level pools nicely', () => {
    const majors = TRAINER_LEVELS.find((l) => l.id === 'major')!.pool().map(chordSymbol)
    expect(majors).toContain('D♭')
    expect(majors).toContain('F♯')
    const inv = TRAINER_LEVELS.find((l) => l.id === 'inversions')!.pool().map(chordSymbol)
    expect(inv).toContain('C/E')
    expect(inv).toContain('Am/E')
  })
})

describe('rhythm', () => {
  it('fills whole bars and starts with a note', () => {
    for (const level of RHYTHM_LEVELS) {
      for (let seed = 1; seed < 40; seed++) {
        const p = makePattern(level, 2, seeded(seed))
        const total = p.reduce((s, n) => s + n.beats, 0)
        expect(total).toBe(8)
        expect(p[0].rest).toBe(false)
        // Notes never cross a bar line.
        for (const n of p) expect(Math.floor(n.start / 4)).toBe(Math.floor((n.start + n.beats - 1e-6) / 4))
      }
    }
  })
  it('counts beats', () => {
    expect(countLabel(0)).toBe('1')
    expect(countLabel(1.5)).toBe('&')
    expect(countLabel(2.25)).toBe('e')
    expect(countLabel(3.75)).toBe('a')
    expect(countLabel(5)).toBe('2')
  })
  it('turns patterns into staff items with bar lines', () => {
    const p = makePattern(RHYTHM_LEVELS[0], 2, seeded(7))
    const items = patternToStaff(p)
    expect(items.filter((i) => 'bar' in i)).toHaveLength(2)
    expect(onsetBeats(p).length).toBe(p.filter((n) => !n.rest).length)
  })
  it('grades taps', () => {
    const expected = [0, 0.5, 1, 1.5]
    expect(scoreTaps(expected, [0, 0.5, 1, 1.5]).score).toBe(100)
    expect(scoreTaps(expected, []).score).toBe(0)
    const r = scoreTaps(expected, [0.07, 0.5, 1.02, 1.5])
    expect(r.results[0].grade).toBe('good')
    expect(r.results[2].grade).toBe('perfect')
    const extra = scoreTaps(expected, [0, 0.25, 0.5, 1, 1.5])
    expect(extra.extras).toHaveLength(1)
    expect(extra.score).toBe(88)
    const late = scoreTaps([0, 1], [0.15, 1])
    expect(late.results[0].grade).toBe('ok')
    expect(late.results[0].error).toBeCloseTo(0.15)
  })
})

describe('ear training', () => {
  it('makes echo tunes inside the scale without repeats', () => {
    for (const level of ECHO_LEVELS) {
      const q = makeEcho(level, seeded(11))
      expect(q.notes).toHaveLength(level.length)
      for (let i = 1; i < q.notes.length; i++) expect(q.notes[i]).not.toBe(q.notes[i - 1])
      for (const n of q.notes) expect(level.scale.map((s) => 60 + s)).toContain(n)
    }
  })
  it('makes intervals from the level pool', () => {
    const level = INTERVAL_LEVELS[0]
    for (let s = 1; s < 20; s++) expect(level.semis).toContain(makeInterval(level, null, seeded(s)).semis)
  })

  const minor: QualityQ = { kind: 'quality', root: midi('C#3'), type: CHORD_TYPE.min }
  const sixth: IntervalQ = { kind: 'interval', low: midi('G3'), semis: 9, harmonic: true }

  it('turns an answer into the notes it stands for', () => {
    expect(rightOption(minor)).toBe('min')
    expect(rightOption(sixth)).toBe('9')
    expect(optionNotes(minor, 'min')).toEqual(m('C#3', 'E3', 'G#3'))
    expect(optionNotes(minor, 'aug')).toEqual(m('C#3', 'F3', 'A3'))
    expect(optionNotes(sixth, '10')).toEqual(m('G3', 'F4'))
  })

  it('describes a miss in words', () => {
    expect(describeMiss({ question: sixth, correct: false, clean: false, said: '10' })).toEqual({ asked: 'Major 6th', said: 'minor 7th' })
    expect(describeMiss({ question: minor, correct: true, clean: false, said: 'maj' })).toEqual({ asked: 'C♯ minor', said: 'major' })
    const echo = { kind: 'echo' as const, notes: m('C4', 'D4', 'E4', 'G4') }
    expect(describeMiss({ question: echo, correct: true, clean: false, played: m('C4', 'D4', 'F#4') })).toEqual({ asked: 'C – D – E – G', said: 'C – D – F♯' })
    // "Show me" before playing anything: nothing to compare.
    expect(describeMiss({ question: echo, correct: false, clean: false }).said).toBeUndefined()
  })
})

describe('key quiz', () => {
  it('always includes the right answer once, with 4 distinct options', () => {
    for (const level of KEY_LEVELS) {
      for (let s = 1; s < 30; s++) {
        const q = makeKeyQuestion(level, null, seeded(s))
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options.map((o) => o.fifths)).size).toBe(4)
        expect(q.options[q.answer].fifths).toBe(q.fifths)
        expect(Math.abs(q.fifths)).toBeLessThanOrEqual(level.max)
      }
    }
  })
})

describe('key quiz misses', () => {
  const q = { fifths: 3, key: parseKey('A'), options: [{ label: 'E major', fifths: 4 }, { label: 'A major', fifths: 3 }], answer: 1 }

  it('says what was shown, what you picked and what it was', () => {
    expect(describeKeyMiss(q, 0, 'name')).toEqual({ asked: '3 sharps', verb: 'you said', said: 'E major', answer: 'A major' })
    expect(describeKeyMiss(q, 0, 'find')).toEqual({ asked: 'A major', verb: 'you picked', said: '4 sharps', answer: '3 sharps' })
    const c = { fifths: 0, key: parseKey('C'), options: [{ label: 'F major', fifths: -1 }, { label: 'C major', fifths: 0 }], answer: 1 }
    expect(describeKeyMiss(c, 0, 'name').asked).toBe('No sharps or flats')
  })
})

describe('key explanations', () => {
  it('names the signature and the trick', async () => {
    const { explainKey } = await import('./keys')
    const { parseKey } = await import('../../../lib/theory')
    expect(explainKey(2, parseKey('D'))).toBe('D major has 2 sharps: F♯, C♯. Trick: the last sharp (C♯) is a half step below the key\'s name.')
    expect(explainKey(-3, parseKey('Eb'))).toContain('second-to-last flat (E♭)')
    expect(explainKey(-1, parseKey('F'))).toContain('one flat means F major')
    expect(explainKey(1, parseKey('Em'))).toContain('relative major, G major')
  })
})
