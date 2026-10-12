import { describe, expect, it } from 'vitest'
import { bassFor, chordPcs, chordSymbol, mod, parseKey, pcOf, pitchName, romanToChord } from '../../lib/theory'
import { MORE_CHIPS, PALETTE, PALETTE_GROUPS, isMinorProgression, isProgression, jamChords, nashville, patternHits } from './jam'

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
