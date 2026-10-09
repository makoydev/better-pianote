import { describe, expect, it } from 'vitest'
import {
  CHORD_TYPE,
  IV,
  SCALE_TYPE,
  chordSymbol,
  chordToRoman,
  chordTones,
  closeVoicing,
  detectChord,
  diatonicChords,
  fromMidi,
  guessKey,
  intervalBetween,
  keyFifths,
  midi,
  midiOf,
  note,
  noteName,
  parseChord,
  parseKey,
  pitchName,
  relativeKey,
  romanToChord,
  scaleFingering,
  scaleNotes,
  spellInKey,
  spellRoot,
  stepPattern,
  transpose,
  voiceProgression,
} from './index'

const names = (ns: { letter: number; acc: number; oct: number }[]) => ns.map((n) => pitchName(n, true)).join(' ')
const sym = (midis: string[]) => detectChord(midis.map(midi))?.symbol ?? null

describe('notes', () => {
  it('converts names to MIDI', () => {
    expect(midi('C4')).toBe(60)
    expect(midi('A4')).toBe(69)
    expect(midi('Bb3')).toBe(58)
    expect(midi('C#5')).toBe(73)
    expect(midi('B#3')).toBe(60)
    expect(midi('Cb4')).toBe(59)
    expect(midi('F♯2')).toBe(42)
  })

  it('spells MIDI with sensible defaults', () => {
    expect(noteName(fromMidi(61))).toBe('C♯4')
    expect(noteName(fromMidi(63))).toBe('E♭4')
    expect(noteName(fromMidi(70))).toBe('B♭4')
    expect(noteName(fromMidi(66, 'flat'))).toBe('G♭4')
    expect(noteName(fromMidi(59))).toBe('B3')
  })

  it('transposes with correct letters', () => {
    expect(noteName(transpose(note('C4'), IV.M3))).toBe('E4')
    expect(noteName(transpose(note('Eb4'), IV.m3))).toBe('G♭4')
    expect(noteName(transpose(note('B3'), IV.m3))).toBe('D4')
    expect(noteName(transpose(note('F#4'), IV.M3))).toBe('A♯4')
    expect(noteName(transpose(note('C4'), { num: -3, semis: -3 }))).toBe('A3')
  })

  it('names intervals precisely', () => {
    expect(intervalBetween(note('C4'), note('E4')).name).toBe('Major 3rd')
    expect(intervalBetween(note('C4'), note('Eb4')).name).toBe('Minor 3rd')
    expect(intervalBetween(note('C4'), note('G4')).name).toBe('Perfect 5th')
    expect(intervalBetween(note('C4'), note('F#4')).name).toBe('Augmented 4th')
    expect(intervalBetween(note('C4'), note('Gb4')).name).toBe('Diminished 5th')
    expect(intervalBetween(note('C4'), note('C5')).name).toBe('Octave')
    expect(intervalBetween(note('E4'), note('F4')).name).toBe('Minor 2nd')
    expect(intervalBetween(note('G4'), note('C4')).name).toBe('Perfect 5th')
    expect(intervalBetween(note('G4'), note('C5')).name).toBe('Perfect 4th')
  })
})

describe('chords', () => {
  it('builds correctly spelled chords', () => {
    expect(names(chordTones(note('Eb4'), CHORD_TYPE.maj))).toBe('Eb G Bb')
    expect(names(chordTones(note('B3'), CHORD_TYPE.dim))).toBe('B D F')
    expect(names(chordTones(note('Ab3'), CHORD_TYPE['7']))).toBe('Ab C Eb Gb')
    expect(names(chordTones(note('F#3'), CHORD_TYPE.min))).toBe('F# A C#')
    expect(names(chordTones(note('B3'), CHORD_TYPE.dim7))).toBe('B D F Ab')
    expect(names(chordTones(note('C4'), CHORD_TYPE.add9))).toBe('C E G D')
  })

  it('names what you play, including inversions', () => {
    expect(sym(['C4', 'E4', 'G4'])).toBe('C')
    expect(sym(['E4', 'G4', 'C5'])).toBe('C/E')
    expect(detectChord([64, 67, 72])?.inversion).toBe(1)
    expect(sym(['G3', 'C4', 'E4'])).toBe('C/G')
    expect(detectChord([55, 60, 64])?.inversion).toBe(2)
    expect(sym(['A3', 'C4', 'E4'])).toBe('Am')
    expect(sym(['C4', 'E4', 'G4', 'Bb4'])).toBe('C7')
    expect(sym(['C4', 'E4', 'G4', 'B4'])).toBe('Cmaj7')
    expect(sym(['A3', 'C4', 'E4', 'G4'])).toBe('Am7')
    expect(sym(['C4', 'E4', 'G4', 'A4'])).toBe('C6')
    expect(sym(['Db4', 'F4', 'Ab4'])).toBe('D♭')
    expect(sym(['C#4', 'E4', 'G#4'])).toBe('C♯m')
    expect(sym(['B3', 'D4', 'F4'])).toBe('Bdim')
    expect(sym(['C4', 'E4', 'G#4'])).toBe('Caug')
    expect(sym(['C4', 'D4', 'G4'])).toBe('Csus2')
    expect(sym(['C4', 'F4', 'G4'])).toBe('Csus4')
    expect(sym(['D4', 'F4', 'A4', 'C5'])).toBe('Dm7')
    expect(sym(['G2', 'B3', 'D4', 'F4'])).toBe('G7')
    expect(sym(['C3', 'C4', 'E4', 'G4', 'C5'])).toBe('C')
    expect(sym(['C4', 'G4'])).toBe('C5')
    expect(sym(['C3', 'C4'])).toBe(null)
    expect(sym(['C4', 'D4', 'E4'])).toBe(null)
  })

  it('recognises 7th chords without their 5th', () => {
    const d = detectChord([midi('C3'), midi('E4'), midi('Bb4')])
    expect(d?.symbol).toBe('C7')
    expect(d?.no5).toBe(true)
  })

  it('spells played notes to match the chord', () => {
    const d = detectChord([63, 67, 70])
    expect(d?.symbol).toBe('E♭')
    expect(d?.notes.map((n) => noteName(n))).toEqual(['E♭4', 'G4', 'B♭4'])
  })

  it('chooses friendly root spellings', () => {
    expect(pitchName(spellRoot(6, CHORD_TYPE.maj))).toBe('F♯')
    expect(pitchName(spellRoot(8, CHORD_TYPE.min))).toBe('G♯')
    expect(pitchName(spellRoot(8, CHORD_TYPE.maj))).toBe('A♭')
    expect(pitchName(spellRoot(3, CHORD_TYPE.maj))).toBe('E♭')
    expect(pitchName(spellRoot(10, CHORD_TYPE.min))).toBe('B♭')
    expect(pitchName(spellRoot(1, CHORD_TYPE.maj))).toBe('D♭')
  })

  it('parses chord symbols', () => {
    expect(chordSymbol(parseChord('F#m7'))).toBe('F♯m7')
    expect(chordSymbol(parseChord('Bb/D'))).toBe('B♭/D')
    expect(parseChord('Csus4').type.id).toBe('sus4')
    expect(parseChord('Bø7').type.id).toBe('m7b5')
  })
})

describe('scales and keys', () => {
  it('spells scales with one of each letter', () => {
    expect(names(scaleNotes(note('G4'), SCALE_TYPE.major))).toBe('G A B C D E F# G')
    expect(names(scaleNotes(note('F4'), SCALE_TYPE.major))).toBe('F G A Bb C D E F')
    expect(names(scaleNotes(note('Eb4'), SCALE_TYPE.major))).toBe('Eb F G Ab Bb C D Eb')
    expect(names(scaleNotes(note('A4'), SCALE_TYPE['harmonic-minor']))).toBe('A B C D E F G# A')
    expect(names(scaleNotes(note('A4'), SCALE_TYPE['minor-pentatonic']))).toBe('A C D E G A')
    expect(names(scaleNotes(note('A4'), SCALE_TYPE.blues))).toBe('A C D Eb E G A')
  })

  it('shows step patterns', () => {
    expect(stepPattern(SCALE_TYPE.major).join(' ')).toBe('W W H W W W H')
    expect(stepPattern(SCALE_TYPE.minor).join(' ')).toBe('W H W W H W W')
  })

  it('knows standard fingerings', () => {
    expect(scaleFingering(note('C4'), SCALE_TYPE.major)?.rh).toEqual([1, 2, 3, 1, 2, 3, 4, 5])
    expect(scaleFingering(note('F4'), SCALE_TYPE.major)?.rh).toEqual([1, 2, 3, 4, 1, 2, 3, 4])
    expect(scaleFingering(note('C4'), SCALE_TYPE.blues)).toBeNull()
  })

  it('counts key signatures', () => {
    expect(keyFifths(parseKey('G'))).toBe(1)
    expect(keyFifths(parseKey('Bb'))).toBe(-2)
    expect(keyFifths(parseKey('Am'))).toBe(0)
    expect(keyFifths(parseKey('Em'))).toBe(1)
    expect(keyFifths(parseKey('Cm'))).toBe(-3)
    expect(keyFifths(parseKey('F#'))).toBe(6)
    expect(keyFifths(parseKey('Ab'))).toBe(-4)
  })

  it('finds relative keys', () => {
    const r = relativeKey(parseKey('C'))
    expect(pitchName(r.tonic) + r.mode).toBe('Aminor')
    const r2 = relativeKey(parseKey('F#m'))
    expect(pitchName(r2.tonic) + r2.mode).toBe('Amajor')
  })

  it('builds diatonic chords', () => {
    const c = diatonicChords(parseKey('C')).map((d) => chordSymbol(d.chord)).join(' ')
    expect(c).toBe('C Dm Em F G Am Bdim')
    const c7 = diatonicChords(parseKey('C'), true).map((d) => chordSymbol(d.chord)).join(' ')
    expect(c7).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5')
    const am = diatonicChords(parseKey('Am')).map((d) => chordSymbol(d.chord)).join(' ')
    expect(am).toBe('Am Bdim C Dm Em F G')
    expect(diatonicChords(parseKey('C')).map((d) => d.roman).join(' ')).toBe('I ii iii IV V vi vii°')
  })

  it('reads roman numerals', () => {
    const A = parseKey('A')
    expect(['vi', 'IV', 'I', 'V'].map((r) => chordSymbol(romanToChord(r, A))).join(' ')).toBe('F♯m D A E')
    const C = parseKey('C')
    expect(chordSymbol(romanToChord('bVII', C))).toBe('B♭')
    expect(chordSymbol(romanToChord('V7', C))).toBe('G7')
    expect(chordSymbol(romanToChord('ii7', C))).toBe('Dm7')
    expect(chordSymbol(romanToChord('viiø7', C))).toBe('Bm7♭5')
    expect(chordSymbol(romanToChord('I/3', C))).toBe('C/E')
    expect(chordSymbol(romanToChord('V', parseKey('Am')))).toBe('E')
  })

  it('spells notes in key', () => {
    expect(noteName(spellInKey(70, parseKey('F')))).toBe('B♭4')
    expect(noteName(spellInKey(68, parseKey('Am')))).toBe('G♯4')
    expect(noteName(spellInKey(66, parseKey('G')))).toBe('F♯4')
    expect(noteName(spellInKey(63, parseKey('Eb')))).toBe('E♭4')
  })
})

describe('voicing', () => {
  it('stacks close voicings', () => {
    expect(closeVoicing([0, 4, 7], 0, 60)).toEqual([60, 64, 67])
    expect(closeVoicing([0, 4, 7], 1, 60)).toEqual([64, 67, 72])
  })

  it('voice-leads I–IV–V smoothly', () => {
    const v = voiceProgression(['C', 'F', 'G'].map(parseChord))
    expect(v).toEqual([
      [60, 64, 67],
      [60, 65, 69],
      [59, 62, 67],
    ])
    expect(midiOf(note('C4'))).toBe(60)
  })
})

describe('roman numerals and key guessing', () => {
  it('names chords in a key', () => {
    const A = parseKey('A')
    expect(['F#m', 'D', 'A', 'E'].map((c) => chordToRoman(parseChord(c), A)).join(' ')).toBe('vi IV I V')
    expect(chordToRoman(parseChord('Bb'), parseKey('C'))).toBe('♭VII')
    expect(chordToRoman(parseChord('G7'), parseKey('C'))).toBe('V7')
    expect(chordToRoman(parseChord('E'), parseKey('Am'))).toBe('V')
  })

  it('guesses the key of a progression', () => {
    const k = guessKey(['F#m', 'D', 'A', 'E'].map(parseChord))
    expect(k && pitchName(k.tonic) + k.mode).toBe('Amajor')
    const k2 = guessKey(['C', 'G', 'Am', 'F'].map(parseChord))
    expect(k2 && pitchName(k2.tonic) + k2.mode).toBe('Cmajor')
    const k3 = guessKey(['Am', 'F', 'C', 'G', 'Am'].map(parseChord))
    expect(k3 && pitchName(k3.tonic) + k3.mode).toBe('Aminor')
    expect(guessKey(['C', 'F#', 'Bb'].map(parseChord))).toBeNull()
  })
})
