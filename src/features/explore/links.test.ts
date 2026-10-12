import { describe, expect, it } from 'vitest'
import { CHORD_TYPES, type Chord, chordPcs, chordSymbol, keyName, parseChord, parseKey, romanToChord, spellChordInKey, spellRoot } from '../../lib/theory'
import { isMinorProgression, isProgression, jamChords, jamTonic } from './jam'
import { circleIndex, circleKey, jamNumeral, jamPresetFor } from './links'

const sorted = (c: Chord) => [...chordPcs(c)].sort((a, b) => a - b).join(',')

describe('links between the tools', () => {
  it('finds a key’s place on the circle of fifths, whatever its spelling', () => {
    expect(circleIndex(parseKey('C'))).toBe(0)
    expect(circleIndex(parseKey('Am'))).toBe(0)
    expect(circleIndex(parseKey('F#'))).toBe(6)
    expect(circleIndex(parseKey('Gb'))).toBe(6)
    expect(circleIndex(parseKey('Ebm'))).toBe(6)
    expect(circleIndex(parseKey('Db'))).toBe(7)
    expect(circleIndex(parseKey('Bbm'))).toBe(7)
    expect(keyName(circleKey(parseKey('Gb')))).toBe('F♯ major')
  })

  it('keeps the Jam’s progression when its mode fits the key, and swaps it when it doesn’t', () => {
    expect(jamPresetFor('major', { preset: 'river', romans: [] })).toBe('river')
    expect(jamPresetFor('minor', { preset: 'river', romans: [] })).toBe('andalusian')
    expect(jamPresetFor('major', { preset: 'andalusian', romans: [] })).toBe('pop')
    expect(jamPresetFor('minor', { preset: 'custom', romans: ['i', 'iv', 'V'] })).toBe('custom')
    expect(jamPresetFor('major', { preset: 'custom', romans: ['i', 'iv', 'V'] })).toBe('pop')
    expect(jamPresetFor('major', { preset: 'custom', romans: [] })).toBe('pop')
  })
})

describe('chords as Jam numerals', () => {
  const numerals = (chart: string, key: string) => chart.split(' ').map((s) => jamNumeral(parseChord(s), parseKey(key).tonic))

  it('writes a chart the way the Jam counts', () => {
    expect(numerals('F#m D A E', 'A')).toEqual(['vi', 'IV', 'I', 'V'])
    expect(numerals('Dm7 G7 Cmaj7', 'C')).toEqual(['ii7', 'V7', 'Imaj7'])
    // In a minor key the Jam still counts up the tonic's major scale.
    const minor = numerals('Am F C G', 'Am')
    expect(minor).toEqual(['i', 'bVI', 'bIII', 'bVII'])
    expect(isMinorProgression(minor)).toBe(true)
    expect(jamChords(minor, 9, true).map(chordSymbol).join(' ')).toBe('Am F C G')
  })

  it('reads cleanly once the chords are spelled for the key', () => {
    // F♯ named before the key was found is G♭ (IV) in D♭, not ♯III.
    const Db = parseKey('Db')
    expect(jamNumeral(parseChord('F#'), Db.tonic)).toBe('#III')
    expect(jamNumeral(spellChordInKey(parseChord('F#'), Db), Db.tonic)).toBe('IV')
  })

  it('keeps a 3rd, 5th or 7th in the bass', () => {
    expect(numerals('C/E G/B Am F/C', 'C')).toEqual(['I/3', 'V/3', 'vi', 'IV/5'])
    expect(numerals('G7/F', 'C')).toEqual(['V7/7'])
    expect(numerals('Csus4/G', 'C')).toEqual(['Isus4/5'])
  })

  it('gives every chord, on every root, in every key, a numeral the Jam plays back as the same chord', () => {
    // Power chords, minor-major 7ths and major 9ths become the nearest chord the Jam knows.
    const simpler: Record<string, string> = { '5': 'maj', mMaj7: 'min', maj9: 'maj7' }
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      for (const minor of [false, true]) {
        const tonic = jamTonic(tonicPc, minor)
        for (const type of CHORD_TYPES) {
          for (let pc = 0; pc < 12; pc++) {
            const chord = { root: spellRoot(pc, type), type }
            const rn = jamNumeral(chord, tonic)
            const label = `${chordSymbol(chord)} in ${tonicPc}${minor ? 'm' : ''}: ${rn}`
            expect(isProgression([rn]), label).toBe(true)
            const want = sorted({ root: chord.root, type: CHORD_TYPES.find((t) => t.id === (simpler[type.id] ?? type.id))! })
            expect(sorted(romanToChord(rn, { tonic, mode: 'major' })), label).toBe(want)
            expect(sorted(jamChords([rn], tonicPc, minor)[0]), label).toBe(want)
          }
        }
      }
    }
  })
})
