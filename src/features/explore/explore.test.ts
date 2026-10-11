import { describe, expect, it } from 'vitest'
import {
  CHORD_TYPE,
  CHORD_TYPES,
  CIRCLE,
  IV,
  type Key,
  type Note,
  chordSymbol,
  chordTones,
  detectChord,
  diatonicChords,
  midi,
  noteName,
  parseChord,
  parseKey,
  parseNote,
  pitchName,
  romanToChord,
  transpose,
} from '../../lib/theory'
import { CHORD_GROUPS, GUITAR_SHAPES, PC_NAMES, chordFormula, lhFingers, lhVoicing, rhFingers, rhVoicing, shapeMidis, spellVoicing } from './chordTools'
import { PALETTE, PRESETS, drumHits, isMinorProgression, isProgression, jamChords, jamTonic, nashville, patternHits } from './jam'
import { tapTempo, tempoName } from './tempo'

describe('chord explorer helpers', () => {
  it('groups every chord type exactly once', () => {
    const ids = CHORD_GROUPS.flatMap((g) => g.ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(CHORD_TYPES.map((t) => t.id).sort())
  })

  it('voices the right hand from middle C up, with inversions', () => {
    const C = parseChord('C')
    expect(rhVoicing(C, 0)).toEqual([60, 64, 67])
    expect(rhVoicing(C, 1)).toEqual([64, 67, 72])
    expect(rhVoicing(C, 2)).toEqual([67, 72, 76])
    expect(rhVoicing(parseChord('B'), 0)).toEqual([71, 75, 78])
  })

  it('keeps the left hand below middle C', () => {
    for (const t of CHORD_TYPES) {
      for (const p of PC_NAMES) {
        const v = lhVoicing({ root: parseNote(p.sharp.replace('♯', '#')), type: t })
        expect(Math.max(...v)).toBeLessThan(60)
        expect(Math.min(...v)).toBeGreaterThanOrEqual(40)
      }
    }
    expect(lhVoicing(parseChord('E'))).toEqual([40, 44, 47])
    expect(lhVoicing(parseChord('D♯m'))).toEqual([51, 54, 58])
  })

  it('spells voicings with the chord’s letters', () => {
    const E = parseChord('E')
    expect(spellVoicing(E, rhVoicing(E, 0)).map((n) => noteName(n))).toEqual(['E4', 'G♯4', 'B4'])
    const Ab = parseChord('Ab')
    expect(spellVoicing(Ab, rhVoicing(Ab, 1)).map((n) => noteName(n))).toEqual(['C4', 'E♭4', 'A♭4'])
  })

  it('suggests standard fingerings', () => {
    expect(rhFingers([60, 64, 67], 'maj', 0)).toEqual([1, 3, 5])
    expect(rhFingers([64, 67, 72], 'maj', 1)).toEqual([1, 2, 5])
    expect(rhFingers([67, 72, 76], 'maj', 2)).toEqual([1, 3, 5])
    expect(rhFingers([60, 65, 67], 'sus4', 0)).toEqual([1, 4, 5])
    expect(rhFingers([60, 62, 67], 'sus2', 0)).toEqual([1, 2, 5])
    expect(rhFingers([64, 67, 70, 72], '7', 1)).toEqual([1, 2, 4, 5])
    expect(rhFingers([67, 70, 72, 76], '7', 2)).toEqual([1, 2, 3, 5])
    expect(lhFingers([48, 52, 55])).toEqual([5, 3, 1])
    expect(lhFingers([48, 50, 55])).toEqual([5, 4, 1])
    expect(lhFingers([48, 53, 55])).toEqual([5, 2, 1])
  })

  it('explains how chords are stacked', () => {
    const f = chordFormula(parseChord('F#m7'))
    expect(f.map((p) => p.degree)).toEqual(['1', '♭3', '5', '♭7'])
    expect(f.map((p) => p.gap)).toEqual([0, 3, 4, 3])
    expect(f[1].gapName).toBe('Minor 3rd')
    expect(f[3].fromRoot).toBe('Minor 7th')
    expect(f.map((p) => noteName(p.note, { octave: false }))).toEqual(['F♯', 'A', 'C♯', 'E'])
  })

  it('has guitar shapes that really are the chords they claim', () => {
    for (const [symbol, shape] of Object.entries(GUITAR_SHAPES)) {
      expect(detectChord(shapeMidis(shape.frets))?.symbol, `${symbol} (${shape.frets})`).toBe(symbol)
    }
  })
})

describe('circle of fifths', () => {
  // KeyDetails shows i, iv and a major V (built with romanToChord) as a minor key's main chords.
  const minorKeys: Key[] = CIRCLE.map((c) => ({ tonic: c.minor, mode: 'minor' }))
  const names = (notes: Note[]) => notes.map((n) => pitchName(n)).join(' ')

  it('spells i, iv and v of every minor key from its key signature', () => {
    const main = minorKeys.map((k) => {
      const d = diatonicChords(k)
      return [d[0], d[3], d[4]].map((c) => chordSymbol(c.chord)).join(' ')
    })
    expect(main).toEqual([
      'Am Dm Em',
      'Em Am Bm',
      'Bm Em F♯m',
      'F♯m Bm C♯m',
      'C♯m F♯m G♯m',
      'G♯m C♯m D♯m',
      'D♯m G♯m A♯m',
      'B♭m E♭m Fm',
      'Fm B♭m Cm',
      'Cm Fm Gm',
      'Gm Cm Dm',
      'Dm Gm Am',
    ])
  })

  it('spells the major V of every minor key with the raised 7th as its 3rd', () => {
    const fives = minorKeys.map((k) => {
      const V = romanToChord('V', k)
      return names(chordTones(V.root, V.type))
    })
    expect(fives).toEqual([
      'E G♯ B',
      'B D♯ F♯',
      'F♯ A♯ C♯',
      'C♯ E♯ G♯',
      'G♯ B♯ D♯',
      'D♯ F𝄪 A♯',
      'A♯ C𝄪 E♯',
      'F A C',
      'C E G',
      'G B D',
      'D F♯ A',
      'A C♯ E',
    ])
    for (const k of minorKeys) {
      const V = romanToChord('V', k)
      expect(V.type.id).toBe('maj')
      // The 3rd of V is the leading tone: the 7th letter, a half step below the tonic.
      expect(pitchName(chordTones(V.root, V.type)[1])).toBe(pitchName(transpose(k.tonic, IV.M7)))
    }
  })
})

describe('progression jam helpers', () => {
  it('builds every preset in its default key', () => {
    for (const p of PRESETS) {
      const key = parseKey(p.tonic)
      expect(() => p.romans.map((r) => romanToChord(r, key))).not.toThrow()
    }
    const river = PRESETS.find((p) => p.id === 'river')!
    expect(river.romans.map((r) => chordSymbol(romanToChord(r, parseKey(river.tonic)))).join(' ')).toBe('F♯m D A E')
    const andalusian = PRESETS.find((p) => p.id === 'andalusian')!
    expect(andalusian.romans.map((r) => chordSymbol(romanToChord(r, parseKey('A')))).join(' ')).toBe('Am G F E')
    const blues = PRESETS.find((p) => p.id === 'blues')!
    expect(new Set(blues.romans.map((r) => chordSymbol(romanToChord(r, parseKey('A')))))).toEqual(new Set(['A7', 'D7', 'E7']))
  })

  it('parses every palette chip', () => {
    const C = parseKey('C')
    expect(PALETTE.map((r) => chordSymbol(romanToChord(r, C))).join(' ')).toBe(
      'C Dm Em F G Am Bdim Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Cm Fm E♭ A♭ B♭',
    )
  })

  it('names keys the way musicians write them', () => {
    const names = (minor: boolean) => Array.from({ length: 12 }, (_, pc) => pitchName(jamTonic(pc, minor))).join(' ')
    expect(names(false)).toBe('C D♭ D E♭ E F F♯ G A♭ A B♭ B')
    expect(names(true)).toBe('C C♯ D D♯ E F F♯ G G♯ A B♭ B')
  })

  it('takes the mode from the first home chord', () => {
    for (const p of PRESETS) expect(isMinorProgression(p.romans), p.id).toBe(p.id === 'andalusian')
    expect(isMinorProgression(['i', 'iv', 'V', 'I'])).toBe(true)
    expect(isMinorProgression(['ii7', 'V7', 'Imaj7', 'i'])).toBe(false)
    expect(isMinorProgression(['IV', 'V', 'iii', 'vi'])).toBe(false)
  })

  it('transposes minor progressions into minor keys', () => {
    const andalusian = PRESETS.find((p) => p.id === 'andalusian')!
    const inKey = (pc: number) => jamChords(andalusian.romans, pc, true).map(chordSymbol).join(' ')
    // Not D♭m C♭ B𝄫 A♭ (D♭ minor) or A♭m G♭ F♭ E♭ (A♭ minor, 7 flats).
    expect(inKey(1)).toBe('C♯m B A G♯')
    expect(inKey(3)).toBe('D♯m C♯ B A♯')
    expect(inKey(6)).toBe('F♯m E D C♯')
    expect(inKey(8)).toBe('G♯m F♯ E D♯')
    expect(inKey(10)).toBe('B♭m A♭ G♭ F')
    expect(inKey(0)).toBe('Cm B♭ A♭ G')
  })

  it('respells borrowed chords that would land on awkward roots', () => {
    const borrowed = ['bIII', 'bVI', 'bVII']
    const inKey = (pc: number) => jamChords(borrowed, pc, false).map(chordSymbol).join(' ')
    expect(inKey(1)).toBe('E A B') // D♭ major: not F♭ B𝄫 C♭
    expect(inKey(3)).toBe('G♭ B D♭') // E♭ major: not C♭
    expect(inKey(8)).toBe('B E G♭') // A♭ major: not C♭ F♭
    expect(inKey(0)).toBe('E♭ A♭ B♭')
    // The chord's notes follow its new root: A C♯ E, not B𝄫 D♭ F♭.
    const sixth = jamChords(['bVI'], 1, false)[0]
    expect(chordTones(sixth.root, sixth.type).map((n) => pitchName(n))).toEqual(['A', 'C♯', 'E'])
  })

  it('never puts an awkward root on the chart, in any key', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const minor of [false, true]) {
        for (const romans of [PALETTE, ...PRESETS.map((p) => p.romans)]) {
          for (const c of jamChords(romans, pc, minor)) expect(pitchName(c.root), `${romans.join(' ')} in ${pc}`).not.toMatch(/𝄫|𝄪|F♭|C♭|E♯|B♯/u)
        }
      }
    }
  })

  it('reads back a saved progression only if every numeral still makes sense', () => {
    expect(isProgression(['vi', 'IV', 'I', 'V'])).toBe(true)
    expect(isProgression(['I7', 'bVII', 'ii7', 'vii°'])).toBe(true)
    expect(isProgression([])).toBe(true)
    expect(isProgression(['I', 'XI'])).toBe(false)
    expect(isProgression(['I', 4])).toBe(false)
    expect(isProgression('I V vi IV')).toBe(false)
    expect(isProgression({ 0: 'I' })).toBe(false)
  })

  it('writes Nashville numbers', () => {
    expect(['I', 'vi', 'IV', 'V7', 'ii7', 'bVII', 'vii°', 'Imaj7'].map(nashville)).toEqual(['1', '6m', '4', '57', '2m7', '♭7', '7°', '1maj7'])
  })

  it('fills a bar with each accompaniment pattern', () => {
    const rh = [60, 64, 67]
    for (const pat of ['block', 'fingerstyle', 'ballad'] as const) {
      const hits = patternHits(pat, rh, 48, [0, 4, 7], 8)
      expect(hits.some((h) => h.tick === 0 && h.notes.includes(48))).toBe(true)
      expect(Math.max(...hits.map((h) => h.tick))).toBeLessThan(8)
      expect(hits.every((h) => h.notes.every((n) => n >= 36 && n <= 84))).toBe(true)
    }
    // Half-bar chords only use the first four eighths.
    expect(Math.max(...patternHits('ballad', rh, 48, [0, 4, 7], 4).map((h) => h.tick))).toBe(3)
  })

  it('plays a backbeat', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((t) => drumHits(t).kick)).toEqual([true, false, false, false, true, false, false, false])
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((t) => drumHits(t).snare)).toEqual([false, false, true, false, false, false, true, false])
  })
})

describe('metronome helpers', () => {
  it('names tempos', () => {
    expect(tempoName(50)).toBe('Largo')
    expect(tempoName(90)).toBe('Andante')
    expect(tempoName(110)).toBe('Moderato')
    expect(tempoName(130)).toBe('Allegro')
    expect(tempoName(190)).toBe('Presto')
  })

  it('finds tempo from taps', () => {
    expect(tapTempo([1000])).toBeNull()
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120)
    // A long pause starts a new measurement.
    expect(tapTempo([0, 300, 5000, 6000])).toBe(60)
    expect(tapTempo([0, 10])).toBe(240)
  })
})

describe('sanity', () => {
  it('uses the theory library as expected', () => {
    expect(midi('C4')).toBe(60)
    expect(CHORD_TYPE.maj.suffix).toBe('')
  })
})
