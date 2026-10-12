import { describe, expect, it } from 'vitest'
import { bassFor, chordPcs, chordSymbol, mod, parseKey, pcOf, pitchName, romanToChord } from '../../lib/theory'
import {
  CHORD_LENGTHS,
  FEELS,
  FEEL_IDS,
  MORE_CHIPS,
  PALETTE,
  PALETTE_GROUPS,
  type PatternId,
  accented,
  cardKeys,
  chordTicks,
  drumHits,
  isMinorProgression,
  lengthsFor,
  meterOf,
  isProgression,
  jamChords,
  moveAt,
  nashville,
  patternHits,
  removeAt,
  replaceAt,
  sameRomans,
} from './jam'

const symbols = (romans: string[], pc: number, minor = false) => jamChords(romans, pc, minor).map(chordSymbol).join(' ')
const AWKWARD = /𝄫|𝄪|F♭|C♭|E♯|B♯/u

describe('jam chips', () => {
  it('groups every chip once', () => {
    const grouped = PALETTE_GROUPS.flatMap((g) => g.romans)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect(new Set(grouped)).toEqual(new Set([...PALETTE, ...MORE_CHIPS]))
  })

  it('spells the new chips in C', () => {
    const C = parseKey('C')
    expect(MORE_CHIPS.map((r) => chordSymbol(romanToChord(r, C))).join(' ')).toBe('C7 F7 Csus4 Gsus4 C/E G/B D E')
    expect(isProgression(MORE_CHIPS)).toBe(true)
  })

  it('spells them in sharp and flat keys', () => {
    expect(symbols(MORE_CHIPS, 9)).toBe('A7 D7 Asus4 Esus4 A/C♯ E/G♯ B C♯')
    expect(symbols(MORE_CHIPS, 10)).toBe('B♭7 E♭7 B♭sus4 Fsus4 B♭/D F/A C D')
    expect(symbols(MORE_CHIPS, 1)).toBe('D♭7 G♭7 D♭sus4 A♭sus4 D♭/F A♭/C E♭ F')
  })

  it('writes slash basses the way chord charts do', () => {
    // F♯ major's V/3 is C♯/E♯ in theory; charts write C♯/F.
    expect(symbols(['V/3'], 6)).toBe('C♯/F')
    // Minor progressions count from the major scale of a sharp-spelled tonic: no C𝄪, E♯ or B♯ in the bass.
    expect(symbols(['i', 'V/3'], 3, true)).toBe('D♯m A♯/D')
    expect(symbols(['i', 'I/3'], 1, true)).toBe('C♯m C♯/F')
    expect(symbols(['i', 'V/3'], 1, true)).toBe('C♯m G♯/C')
    // Major II and III land on plain roots there too.
    expect(symbols(['i', 'II', 'III'], 3, true)).toBe('D♯m F G')
  })

  it('never puts an awkward root or bass on the chart, in any key', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const minor of [false, true]) {
        for (const c of jamChords(MORE_CHIPS, pc, minor)) {
          expect(pitchName(c.root), `${chordSymbol(c)} in ${pc}`).not.toMatch(AWKWARD)
          if (c.bass) expect(pitchName(c.bass), `${chordSymbol(c)} in ${pc}`).not.toMatch(AWKWARD)
        }
      }
    }
  })

  it('keeps the slash bass a note of the chord', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const minor of [false, true]) {
        for (const c of jamChords(['I/3', 'V/3'], pc, minor)) expect(chordPcs(c)).toContain(pcOf(c.bass!))
      }
    }
  })

  it('reads the mode from the first home chord, slash and sus included', () => {
    expect(isMinorProgression(['I/3', 'IV', 'V'])).toBe(false)
    expect(isMinorProgression(['Isus4', 'I', 'i'])).toBe(false)
    expect(isMinorProgression(['II', 'III', 'i'])).toBe(true)
  })

  it('writes Nashville numbers for slash chords by the bass note’s degree', () => {
    expect(['I/3', 'V/3', 'Isus4', 'I7', 'IV7', 'II', 'III'].map(nashville)).toEqual(['1/3', '5/7', '1sus4', '17', '47', '2', '3'])
    expect(nashville('iv/3')).toBe('4m/♭6')
    expect(nashville('bVII/3')).toBe('♭7/2')
  })
})

describe('editing a progression', () => {
  const p = ['I', 'V', 'vi', 'IV']

  it('replaces, removes and moves chords without touching the original', () => {
    expect(replaceAt(p, 1, 'V/3')).toEqual(['I', 'V/3', 'vi', 'IV'])
    expect(removeAt(p, 0)).toEqual(['V', 'vi', 'IV'])
    expect(moveAt(p, 1, 1)).toEqual(['I', 'vi', 'V', 'IV'])
    expect(moveAt(p, 1, -1)).toEqual(['V', 'I', 'vi', 'IV'])
    expect(p).toEqual(['I', 'V', 'vi', 'IV'])
  })

  it('leaves the ends alone', () => {
    expect(moveAt(p, 0, -1)).toBe(p)
    expect(moveAt(p, 3, 1)).toBe(p)
    expect(moveAt(p, 7, 1)).toBe(p)
  })

  it('keys repeated chords apart, and a moved card keeps its key', () => {
    const blues = ['I7', 'I7', 'IV7', 'I7']
    expect(cardKeys(blues)).toEqual(['I7#0', 'I7#1', 'IV7#0', 'I7#2'])
    const before = cardKeys(p)
    const after = cardKeys(moveAt(p, 1, 1))
    expect(after[2]).toBe(before[1])
  })

  it('compares progressions by their numerals', () => {
    expect(sameRomans(p, [...p])).toBe(true)
    expect(sameRomans(p, p.slice(0, 3))).toBe(false)
    expect(sameRomans(p, ['I', 'V', 'IV', 'vi'])).toBe(false)
  })
})

describe('left-hand patterns', () => {
  it('only plays chord tones, for slash and diminished chords too', () => {
    for (const rn of ['I/3', 'V/3', 'vii°', 'I', 'V7', 'Isus4', 'bVI']) {
      const c = romanToChord(rn, parseKey('C'))
      const pcs = chordPcs(c)
      for (const pattern of ['block', 'fingerstyle', 'ballad'] as const) {
        // The left hand plays single notes below the right hand's range (A3 and up).
        for (const h of patternHits(pattern, [60, 64, 67], bassFor(c, 40), pcs, 8)) {
          if (h.notes.length === 1 && h.notes[0] < 57) expect(pcs, `${rn} ${pattern}`).toContain(mod(h.notes[0], 12))
        }
      }
    }
  })

  it('still rolls 1–5–8–10 under a plain major chord', () => {
    const wave = patternHits('ballad', [60, 64, 67], 48, [0, 4, 7], 8)
      .filter((h) => h.notes.length === 1)
      .slice(0, 4)
      .map((h) => h.notes[0])
    expect(wave).toEqual([48, 55, 60, 64])
  })
})

describe('feels, metres and chord lengths', () => {
  const rh = [60, 64, 67]
  const C = [0, 4, 7]
  const at = (pattern: PatternId, ticks: number, part: 'bass' | 'chords') =>
    patternHits(pattern, rh, 48, C, ticks)
      .filter((h) => h.part === part)
      .map((h) => `${h.tick}:${h.notes.join('+')}`)

  it('gives every feel a metre', () => {
    expect(FEELS.map((f) => meterOf(f.id).id)).toEqual(['4/4', '4/4', '4/4', '3/4', '6/8'])
    expect(new Set(FEEL_IDS).size).toBe(FEELS.length)
  })

  it('counts quarters, except eighths in 6/8 where the tempo counts dotted quarters', () => {
    const m68 = meterOf('six-eight')
    expect(m68.bar / m68.count).toBe(6)
    expect(m68.beat).toBe(3)
    expect([0, 1, 2, 3, 4, 5].filter((c) => accented(m68, c))).toEqual([0, 3])
    const m34 = meterOf('waltz')
    expect(m34.bar / m34.count).toBe(3)
    expect([0, 1, 2].filter((c) => accented(m34, c))).toEqual([0])
  })

  it('turns a chord length into ticks for each metre', () => {
    const m44 = meterOf('ballad')
    const m34 = meterOf('waltz')
    const m68 = meterOf('six-eight')
    expect(CHORD_LENGTHS.map((l) => chordTicks(l, m44))).toEqual([4, 8, 16])
    // Half a bar doesn't split 3/4 or 6/8 into whole beats: those get a bar.
    expect(CHORD_LENGTHS.map((l) => chordTicks(l, m34))).toEqual([6, 6, 12])
    expect(CHORD_LENGTHS.map((l) => chordTicks(l, m68))).toEqual([6, 6, 12])
    expect(lengthsFor(m34)).toEqual([8, 16])
  })

  it('plays a waltz: bass on 1, the chord on 2 and 3, the fifth in a second bar', () => {
    expect(at('waltz', 6, 'bass')).toEqual(['0:48'])
    expect(at('waltz', 6, 'chords')).toEqual(['2:60+64+67', '4:60+64+67'])
    expect(at('waltz', 12, 'bass')).toEqual(['0:48', '6:55'])
    expect(at('waltz', 12, 'chords')).toEqual(['2:60+64+67', '4:60+64+67', '8:60+64+67', '10:60+64+67'])
  })

  it('rolls 1–5–8–10–8–5 across a 6/8 bar', () => {
    expect(at('six-eight', 6, 'bass')).toEqual(['0:48', '1:55', '2:60', '3:64', '4:60', '5:55'])
    expect(at('six-eight', 6, 'chords')).toEqual(['0:60+64+67'])
  })

  it('keeps the groove going through a two-bar chord', () => {
    expect(at('block', 16, 'bass')).toEqual(['0:48', '8:48'])
    expect(at('block', 16, 'chords').map((s) => s.split(':')[0])).toEqual(['0', '2', '4', '6', '8', '10', '12', '14'])
    expect(at('fingerstyle', 16, 'bass')).toEqual(['0:48', '4:55', '8:48', '12:55'])
    expect(at('ballad', 16, 'chords')).toEqual(['0:60+64+67', '8:60+64+67'])
  })

  it('labels every hit as the band’s bass or chords, inside the chord, on chord tones', () => {
    for (const f of FEEL_IDS) {
      for (const ticks of [4, 6, 8, 12, 16]) {
        for (const h of patternHits(f, rh, 48, C, ticks)) {
          expect(h.tick, f).toBeLessThan(ticks)
          // The right hand plays the voiced chord (or notes of it); the left hand one note at a time.
          if (h.part === 'chords') expect(h.notes.every((n) => rh.includes(n)), f).toBe(true)
          else expect(h.notes, f).toHaveLength(1)
          for (const n of h.notes) expect(C).toContain(n % 12)
        }
      }
    }
  })

  it('drums in each metre', () => {
    const kit = (meter: '3/4' | '6/8') =>
      [0, 1, 2, 3, 4, 5].map((t) => {
        const d = drumHits(t, meter)
        return d.kick ? 'K' : d.snare ? 'S' : '-'
      })
    expect(kit('3/4').join('')).toBe('K-S-S-')
    expect(kit('6/8').join('')).toBe('K--S--')
    expect(drumHits(3, '6/8').hat).toBeGreaterThan(drumHits(4, '6/8').hat)
  })
})
