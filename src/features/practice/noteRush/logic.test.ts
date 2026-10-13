import { describe, expect, it } from 'vitest'
import { GLYPH } from '../../../components/staff/glyphs'
import { midi, parseNote } from '../../../lib/theory'
import {
  RUSH_KEYS,
  type RushClef,
  type RushLevel,
  isCorrect,
  keyHint,
  keyboardRange,
  levelDetail,
  makeRound,
  multiplier,
  nameMatches,
  naturals,
  poolFor,
  rushChoices,
  rushGroup,
  rushShare,
  rushStars,
} from './logic'
import { tapeLayout } from './tape'

const CLEFS: RushClef[] = ['treble', 'bass', 'grand']
const LEVELS: RushLevel[] = [1, 2, 3, 4, 5]

/** Small deterministic random generator so tests are repeatable. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

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

  it('gives stars for accuracy over enough notes', () => {
    expect(rushStars(25, 1)).toBe(3)
    // Perfect but short: two stars at most.
    expect(rushStars(24, 0)).toBe(2)
    expect(rushStars(30, 4)).toBe(2)
    expect(rushStars(14, 0)).toBe(1)
    expect(rushStars(1, 20)).toBe(1)
    expect(rushStars(0, 3)).toBe(0)
    expect(rushStars(0, 0)).toBe(0)
  })

  it('says how much of a three-star minute a round was', () => {
    expect(rushShare(25, 0)).toBe(1)
    expect(rushShare(30, 10)).toBeCloseTo(0.75)
    // Clean but few: scaled by the 25 notes three stars need.
    expect(rushShare(20, 0)).toBeCloseTo(0.8)
    expect(rushShare(0, 0)).toBe(0)
  })

  it('weights notes when asked, and still never repeats one', () => {
    const r = makeRound('treble', 3, 400, seeded(5), { weight: (c) => (c.name === 'F5' ? 6 : 1) })
    const f5 = r.filter((n) => n.name === 'F5').length
    // 11 notes, one of them six times as likely: about a third of the round (it can't follow itself).
    expect(f5).toBeGreaterThan(80)
    expect(f5).toBeLessThan(200)
    for (let i = 1; i < r.length; i++) expect(r[i].name).not.toBe(r[i - 1].name)
  })
})

describe('note rush keyboard', () => {
  it('covers the notes in whole octaves with nothing extra', () => {
    // C4–G4 fits in one octave, C4–B4 (it used to start an octave lower).
    expect(keyboardRange('treble', 2)).toEqual([midi('C4'), midi('B4')])
    expect(keyboardRange('treble', 1)).toEqual([midi('C4'), midi('B5')])
    expect(keyboardRange('bass', 3)).toEqual([midi('C2'), midi('B3')])
  })

  it('never goes below C2 or above C7, the keys a CT-S1 has', () => {
    // Bass level 4 reaches down to C2 itself: it used to start at C1.
    expect(keyboardRange('bass', 4)).toEqual([midi('C2'), midi('B4')])
    for (const clef of CLEFS) {
      for (const level of LEVELS) {
        for (const key of RUSH_KEYS) {
          const [lo, hi] = keyboardRange(clef, level, key)
          expect(lo % 12).toBe(0)
          expect(hi % 12 === 11 || hi === midi('C7')).toBe(true)
          expect(lo).toBeGreaterThanOrEqual(midi('C2'))
          expect(hi).toBeLessThanOrEqual(midi('C7'))
          // Every note a round can ask is on the keyboard, and the outer octaves aren't empty.
          const ms = rushChoices(clef, level, key).map((c) => midi(c.name))
          for (const m of ms) {
            expect(m).toBeGreaterThanOrEqual(lo)
            expect(m).toBeLessThanOrEqual(hi)
          }
          expect(Math.min(...ms) - lo).toBeLessThan(12)
          expect(hi - Math.max(...ms)).toBeLessThan(12)
        }
      }
    }
  })
})

describe('note rush key signatures', () => {
  const names = (key: number, level: RushLevel = 3, clef: RushClef = 'grand') => rushChoices(clef, level, key).map((c) => c.name)

  it('makes every F an F♯ in G major', () => {
    const g = names(1)
    expect(g.filter((n) => n[0] === 'F').length).toBeGreaterThan(0)
    for (const n of g) if (n[0] === 'F') expect(n).toMatch(/^F#\d$/)
    // Nothing else changes.
    for (const n of g) if (n[0] !== 'F') expect(n).toMatch(/^[A-G]\d$/)
    expect(g).toContain('F#4')
    expect(g).not.toContain('F4')
    expect(midi('F#4')).toBe(66)
  })

  it('follows D, F and B♭ major too', () => {
    for (const n of names(2)) if (n[0] === 'F' || n[0] === 'C') expect(n[1]).toBe('#')
    for (const n of names(-1)) {
      if (n[0] === 'B') expect(n[1]).toBe('b')
      else expect(n).toMatch(/^[A-G]\d$/)
    }
    for (const n of names(-2)) if (n[0] === 'B' || n[0] === 'E') expect(n[1]).toBe('b')
    for (const n of names(-2)) if (n[0] !== 'B' && n[0] !== 'E') expect(n).toMatch(/^[A-G]\d$/)
  })

  it('spells and sounds every note right', () => {
    for (const key of RUSH_KEYS) {
      for (const r of makeRound('grand', 4, 120, seeded(9), { key })) {
        const n = parseNote(r.name)
        expect(r.midi).toBe(midi(r.name))
        // Same letter and octave as the written note, so the staff position matches.
        expect(poolFor('grand', 4).some((p) => p.name === `${'CDEFGAB'[n.letter]}${n.oct}`)).toBe(true)
      }
    }
  })

  it('expects the key signature’s sharp or flat when you name a note', () => {
    const fSharp = makeRound('treble', 3, 300, seeded(2), { key: 1 }).find((n) => n.name.startsWith('F'))!
    expect(fSharp.name).toMatch(/^F#/)
    expect(nameMatches(fSharp, 3, 1)).toBe(true)
    expect(nameMatches(fSharp, 3, 0)).toBe(false)
    const bFlat = makeRound('treble', 3, 300, seeded(2), { key: -1 }).find((n) => n.name.startsWith('B'))!
    expect(nameMatches(bFlat, 6, -1)).toBe(true)
    expect(nameMatches(bFlat, 6, 0)).toBe(false)
  })

  it('alters notes a half step from the key at level 5, never to E♯, B♯, F♭, C♭ or doubles', () => {
    const g = names(1, 5)
    // In G major an F can be F♯ (the key's) or F♮; a C can be C or C♯; E only E♭; B only B♭.
    expect(g).toContain('F#4')
    expect(g).toContain('F4')
    expect(g).toContain('C#5')
    expect(g).not.toContain('E#4')
    expect(g).not.toContain('Cb5')
    for (const key of RUSH_KEYS) {
      for (const n of names(key, 5)) {
        const p = parseNote(n)
        expect(Math.abs(p.acc)).toBeLessThanOrEqual(1)
        expect(['E#', 'B#', 'Fb', 'Cb'].some((bad) => n.startsWith(bad))).toBe(false)
      }
    }
  })

  it('keeps bests apart per key signature', () => {
    expect(rushGroup('treble', 0)).toBe('treble')
    expect(rushGroup('treble', 1)).toBe('treble:G')
    expect(rushGroup('bass', -2)).toBe('bass:Bb')
  })

  it('describes levels as they are in the key', () => {
    expect(levelDetail(1, 0)).toBe('Middle C, treble G, bass F and friends')
    // In D major there's no middle C to find, so the level doesn't promise one.
    expect(levelDetail(1, 2)).toBe('The landmark lines and spaces, in D major')
    expect(levelDetail(2, 2)).toBe('The five notes from C up, in D major: C♯ D E F♯ G')
    expect(levelDetail(2, -2)).toBe('The five notes from C up, in B♭ major: C D E♭ F G')
    expect(levelDetail(4, 1)).toBe('Notes above and below the staff, in G major')
  })

  it('says what the key signature does', () => {
    expect(keyHint(1)).toBe('G major: every F is F♯.')
    expect(keyHint(2)).toBe('D major: every F is F♯ and every C is C♯.')
    expect(keyHint(-2)).toBe('B♭ major: every B is B♭ and every E is E♭.')
  })
})

describe('note rush tape', () => {
  const accidentals = (names: string[], keySig: number) => {
    const l = tapeLayout(
      names.map((name, key) => ({ key, name, state: 'normal' as const })),
      { clef: 'treble', keySig, sp: 20, reserve: 2.8 },
    )
    return l.events.map((e) => e.glyphs.map((g) => (g.ch === GLYPH.sharp ? '♯' : g.ch === GLYPH.flat ? '♭' : g.ch === GLYPH.natural ? '♮' : '')).join(''))
  }

  it('writes every accidental, even when the same note came just before', () => {
    // Each note stands alone: a second F♯ keeps its sharp, and an F after an F♯ needs no natural.
    expect(accidentals(['F#4', 'A4', 'F#4', 'Bb4', 'F4', 'Bb4'], 0)).toEqual(['♯', '', '♯', '♭', '', '♭'])
  })

  it('leaves the key signature’s sharps and flats unwritten', () => {
    expect(accidentals(['F#4', 'C5', 'F4', 'F#5'], 1)).toEqual(['', '', '♮', ''])
    expect(accidentals(['Bb4', 'Eb5', 'B4', 'E4'], -2)).toEqual(['', '', '♮', '♮'])
  })

  it('draws neither bar lines nor a second key signature', () => {
    const l = tapeLayout(
      ['F#4', 'G4', 'A4'].map((name, key) => ({ key, name, state: 'normal' as const })),
      { clef: 'treble', keySig: 2, sp: 20, reserve: 2.2 },
    )
    expect(l.bars).toEqual([])
    expect(l.header).toEqual([])
    // Evenly spaced, so the tape can place any note from its index.
    expect(l.events[2].x - l.events[1].x).toBeCloseTo(l.events[1].x - l.events[0].x)
  })
})
