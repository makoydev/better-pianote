import { describe, expect, it } from 'vitest'
import { CHORD_TYPES, type Chord, type Key, chordSymbol, chordToRoman, diatonicChords, keyName, midi, parseChord, parseKey, spellRoot } from './index'
import { findKey, keysWithChord, nextChords, rankKeys, spellChordInKey } from './keyfind'

const chords = (s: string) => s.split(' ').map(parseChord)
const melody = (s: string) => s.split(' ').map((n) => ({ midi: midi(n) }))
const named = (k: Key | null | undefined) => (k ? keyName(k) : null)
const found = (notes: { midi: number }[], cs: Chord[] = [], prev: Key | null = null) => {
  const f = findKey(notes, cs, prev)
  return f && [named(f.key), named(f.alt)]
}

describe('finding the key', () => {
  it('reads a progression, with the relative key as a close second', () => {
    // River Flows in You's vi–IV–I–V is in A major; it starts on F♯m, so F♯ minor is a fair second guess.
    expect(found([], chords('F#m D A E'))).toEqual(['A major', 'F♯ minor'])
    expect(found([], chords('Em C G D'))).toEqual(['G major', 'E minor'])
    expect(found([], chords('Am F C G Am'))).toEqual(['A minor', 'C major'])
    expect(found([], chords('C G Am F'))?.[0]).toBe('C major')
    expect(found([], chords('C F G C'))).toEqual(['C major', null])
    // A minor key's V is usually major.
    expect(found([], chords('Am Dm E Am'))).toEqual(['A minor', null])
  })

  it('reads melody notes too', () => {
    expect(found(melody('C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4'))?.[0]).toBe('C major')
    expect(found(melody('G4 A4 B4 G4 D5 C5 B4 A4 F#4 G4'))?.[0]).toBe('G major')
    expect(found(melody('A3 B3 C4 D4 E4 F4 G#4 A4'))?.[0]).toBe('A minor')
    expect(found(melody('D3 A3 D4 F#4 A3 E4 G4 C#5 D3 F#3 A3 D4'))?.[0]).toBe('D major')
  })

  it('counts long notes more than short ones', () => {
    // The same notes, but long A, C and E make it A minor rather than C major.
    const notes = melody('C4 D4 E4 F4 G4 A4 B4 C5').map((n) => ({ ...n, weight: [9, 0, 4].includes(n.midi % 12) ? 3 : 0.5 }))
    expect(named(rankKeys(notes)[0].key)).toBe('A minor')
  })

  it('waits until there is enough to go on', () => {
    expect(findKey([], chords('C'))).toBeNull()
    expect(findKey([], chords('F#m'))).toBeNull()
    expect(findKey(melody('C4 E4 G4'))).toBeNull()
    expect(findKey(melody('C4 D4 E4 F4 G4'))).not.toBeNull()
  })

  it('keeps the key it showed until another fits clearly better', () => {
    // A minor fits Am F C G Am a little better, but not by enough to switch from C major.
    expect(found([], chords('Am F C G Am'), parseKey('C'))?.[0]).toBe('C major')
    // F♯ minor gives way to A major, which fits the River Flows chords clearly better.
    expect(found([], chords('F#m D A E'), parseKey('F#m'))?.[0]).toBe('A major')
    // Chords from another key take over quickly.
    expect(found([], chords('Bb Eb F Bb'), parseKey('C'))?.[0]).toBe('B♭ major')
  })
})

describe('spelling a chord for a key', () => {
  const inKey = (s: string, k: string) => chordSymbol(spellChordInKey(parseChord(s), parseKey(k)))

  it('writes a root of the key the way the key does', () => {
    expect(inKey('Ebm', 'B')).toBe('D♯m')
    expect(chordToRoman(spellChordInKey(parseChord('Ebm'), parseKey('B')), parseKey('B'))).toBe('iii')
    expect(inKey('F#', 'Db')).toBe('G♭')
    expect(chordToRoman(spellChordInKey(parseChord('F#'), parseKey('Db')), parseKey('Db'))).toBe('IV')
    expect(inKey('Fdim', 'F#')).toBe('E♯dim')
    expect(inKey('Gb', 'D#m')).toBe('F♯')
  })

  it('leans the way the key does for other roots, without double sharps or flats', () => {
    expect(inKey('A#', 'C')).toBe('B♭')
    expect(inKey('A#', 'F')).toBe('B♭')
    expect(inKey('Gb', 'E')).toBe('F♯')
    // F major in F♯ major would be E♯ major (E♯ G𝄪 B♯): plain F instead.
    expect(inKey('F', 'F#')).toBe('F')
    // The raised 7th of a minor key keeps its sharp.
    expect(inKey('Abdim', 'Am')).toBe('G♯dim')
  })

  it('moves the bass with the root, and leaves chords alone without a key', () => {
    expect(inKey('Gb/Bb', 'D')).toBe('F♯/A♯')
    expect(chordSymbol(spellChordInKey(parseChord('Gb'), null))).toBe('G♭')
    const c = parseChord('D')
    expect(spellChordInKey(c, parseKey('D'))).toBe(c)
  })
})

describe('what to try next', () => {
  const next = (last: string, key: string) => nextChords(parseChord(last), parseKey(key)).map((s) => `${chordSymbol(s.chord)} ${s.roman}`)

  it('follows the usual moves in a major key, spelled in the key', () => {
    expect(next('F#m', 'A')).toEqual(['D IV', 'Bm ii', 'E V', 'C♯m iii'])
    expect(next('E', 'A')).toEqual(['A I', 'F♯m vi', 'D IV'])
    expect(next('A', 'A')).toEqual(['D IV', 'E V', 'F♯m vi', 'Bm ii'])
    expect(next('Gm', 'F')).toEqual(['C V', 'B♭ IV', 'Dm vi'])
    expect(next('G7', 'C')).toEqual(['C I', 'Am vi', 'F IV'])
  })

  it('follows the usual moves in a minor key, with a major V', () => {
    expect(next('Am', 'Am')).toEqual(['F VI', 'Dm iv', 'G VII', 'E V'])
    expect(next('E', 'Am')).toEqual(['Am i', 'F VI', 'Dm iv'])
    expect(next('F#m', 'F#m')).toEqual(['D VI', 'Bm iv', 'E VII', 'C♯ V'])
  })

  it('resolves chords from outside the key where they lead', () => {
    // E7 in C leads to Am (it's the V of vi).
    expect(next('E7', 'C')[0]).toBe('Am vi')
    // D major in C leads to G.
    expect(next('D', 'C')[0]).toBe('G V')
    // A borrowed ♭VII goes home.
    expect(next('Bb', 'C').slice(0, 2)).toEqual(['C I', 'F IV'])
    // In a minor key, the V of V leads to the major V, and the V of VII to VII.
    expect(next('B', 'Am')[0]).toBe('E V')
    expect(next('B7', 'Am')[0]).toBe('E V')
    expect(next('D', 'Am')[0]).toBe('G VII')
    // Nothing leads to a diminished chord: F♯ in C doesn't suggest Bdim (or a B major "II").
    expect(next('F#', 'C').some((s) => s.startsWith('B'))).toBe(false)
  })

  it('always has something to suggest, and never the chord you just played', () => {
    for (const k of ['C', 'A', 'Eb', 'F#', 'Am', 'F#m', 'Cm']) {
      const key = parseKey(k)
      for (const { chord } of diatonicChords(key)) {
        const symbols = nextChords(chord, key).map((s) => chordSymbol(s.chord))
        expect(symbols.length, `${chordSymbol(chord)} in ${k}`).toBeGreaterThan(1)
        expect(symbols, `${chordSymbol(chord)} in ${k}`).not.toContain(chordSymbol(chord))
      }
    }
  })
})

describe('keys with a chord', () => {
  const keys = (s: string) => keysWithChord(parseChord(s)).map((k) => `${k.roman} in ${keyName(k.key)}`)

  it('lists major keys, then minor keys, nearest on the circle first', () => {
    expect(keys('Am')).toEqual(['vi in C major', 'ii in G major', 'iii in F major', 'i in A minor', 'iv in E minor', 'v in D minor'])
    expect(keys('C')).toEqual(['I in C major', 'IV in G major', 'V in F major', 'III in A minor', 'VI in E minor', 'VII in D minor', 'V in F minor'])
    expect(keys('G7')).toEqual(['V7 in C major', 'VII7 in A minor', 'V7 in C minor'])
    expect(keys('Bm7b5')).toEqual(['viiø7 in C major', 'iiø7 in A minor'])
  })

  it('takes a minor key’s raised 7th for V and vii°', () => {
    expect(keys('E')).toContain('V in A minor')
    expect(keys('G#dim')).toEqual(['vii° in A major', 'vii° in A minor', 'ii° in F♯ minor'])
  })

  it('spells the key to match the chord', () => {
    // B♭m is iii in G♭ major (in F♯ major that chord is A♯m), and D♭ isn't V in F♯ minor (that's C♯).
    expect(keys('Bbm')).toEqual(['vi in D♭ major', 'ii in A♭ major', 'iii in G♭ major', 'i in B♭ minor', 'iv in F minor', 'v in E♭ minor'])
    expect(keys('Db')).not.toContain('V in F♯ minor')
    expect(keys('C#m')).toEqual(['vi in E major', 'ii in B major', 'iii in A major', 'i in C♯ minor', 'iv in G♯ minor', 'v in F♯ minor'])
  })

  it('gives every key its place on the circle', () => {
    for (const k of keysWithChord(parseChord('Bbm'))) expect(k.index).toBeGreaterThanOrEqual(0)
    expect(keysWithChord(parseChord('Bbm')).find((k) => k.roman === 'iii')?.index).toBe(6)
  })

  it('finds nothing only for chords that come from harmonic minor', () => {
    expect(keys('Caug')).toEqual([])
    expect(keys('Cm(maj7)')).toEqual([])
    // Spelled C E♭ G♭ B𝄫, Cdim7 is vii°7 of D♭ minor, which isn't on the circle (C♯ minor's is B♯dim7).
    expect(keys('Cdim7')).toEqual([])
    expect(keys('G#dim7')).toEqual(['vii°7 in A minor'])
    // The Chord Explorer says so when the list is empty: augmented (III+), minor-major 7th (i(maj7)) and
    // diminished 7th (vii°7) chords are harmonic minor's.
    for (const type of CHORD_TYPES) {
      for (let pc = 0; pc < 12; pc++) {
        const empty = keysWithChord({ root: spellRoot(pc, type), type }).length === 0
        if (empty) expect(['aug', 'mMaj7', 'dim7'], `${pc} ${type.id}`).toContain(type.id)
        if (type.id === 'aug' || type.id === 'mMaj7') expect(empty).toBe(true)
      }
    }
  })
})
