import { describe, expect, it } from 'vitest'
import { chordSymbol, keyName, parseChord, parseKey, spellChordInKey } from '../../lib/theory'
import {
  CHART_MAX,
  type ChartEntry,
  addToChart,
  chartLoop,
  chartText,
  collectionGroups,
  fromEntry,
  homeKey,
  inCollection,
  noteWeights,
  readChart,
  toEntry,
} from './chart'

const chart = (s: string) => s.split(' ').map(parseChord)
const symbols = (cs: ReturnType<typeof chart>) => cs.map(chordSymbol).join(' ')

describe('the chord chart', () => {
  it('saves chords with their spelling and bass', () => {
    for (const s of ['F#m', 'C/E', 'Bb7', 'Ebm7b5', 'G#m(maj7)', 'Dsus4/A']) {
      const c = parseChord(s)
      expect(chordSymbol(fromEntry(toEntry(c, 1))), s).toBe(chordSymbol(c))
    }
    expect(toEntry(parseChord('F#m'), 3)).toEqual({ id: 3, root: 'F#', type: 'min' })
    // A double flat in the bass survives too (C°7 over B𝄫).
    const dim = { ...parseChord('Cdim7'), bass: { letter: 6, acc: -2, oct: 4 } }
    expect(chordSymbol(fromEntry(toEntry(dim, 1)))).toBe('Cdim7/B𝄫')
  })

  it('reads back only what still makes sense', () => {
    const saved: unknown[] = [
      { id: 1, root: 'F#', type: 'min' },
      { id: 2, root: 'H', type: 'maj' },
      { id: 3, root: 'C', type: 'gone' },
      { id: 4, root: 'E', type: 'maj', bass: 'G#' },
      'D',
      null,
    ]
    expect(readChart(saved).map((e) => e.id)).toEqual([1, 4])
    expect(readChart('F#m D A E')).toEqual([])
    expect(readChart(undefined)).toEqual([])
  })

  it('adds a chord unless it’s the one already at the end, and keeps the newest', () => {
    let c: ChartEntry[] = []
    ;['Am', 'Am', 'F', 'C', 'C', 'G'].forEach((s, i) => (c = addToChart(c, parseChord(s), 1000 + i)))
    expect(c.map((e) => e.root + e.type)).toEqual(['Amin', 'Fmaj', 'Cmaj', 'Gmaj'])
    // Each one is stamped with when it was added.
    expect(c.map((e) => e.id)).toEqual([1000, 1002, 1003, 1005])
    for (let i = 0; i < 60; i++) c = addToChart(c, parseChord(i % 2 ? 'C' : 'G7'))
    expect(c).toHaveLength(CHART_MAX)
  })

  it('keeps ids unique and rising even if the clock doesn’t', () => {
    let c: ChartEntry[] = []
    for (const s of ['C', 'F', 'G']) c = addToChart(c, parseChord(s), 500)
    expect(c.map((e) => e.id)).toEqual([500, 501, 502])
  })

  it('records a chord once when it’s spelled again, keeping the newer spelling', () => {
    // Once the key is found, a held G♭ is named F♯: still one chord on the chart.
    let c: ChartEntry[] = []
    ;['Db', 'Bbm', 'Gb', 'F#', 'Ab'].forEach((s, i) => (c = addToChart(c, parseChord(s), 10 * (i + 1))))
    expect(symbols(c.map(fromEntry))).toBe('D♭ B♭m F♯ A♭')
    expect(c.map((e) => e.id)).toEqual([10, 20, 30, 50])
    // Spelled the same, nothing changes; another bass is another chord.
    expect(addToChart(c, parseChord('Ab'))).toBe(c)
    expect(addToChart(c, parseChord('Ab/C'))).toHaveLength(5)
  })

  it('finds the loop a chart goes round', () => {
    expect(symbols(chartLoop(chart('F#m D A E F#m D A E')))).toBe('F♯m D A E')
    expect(symbols(chartLoop(chart('F#m D A E F#m D')))).toBe('F♯m D A E')
    expect(symbols(chartLoop(chart('Am F C G Am F C G Am')))).toBe('Am F C G')
    // I–IV–V–I is a whole progression, not a three-chord loop.
    expect(symbols(chartLoop(chart('C F G C')))).toBe('C F G C')
    // No loop: the last 16 chords.
    const long = chart('C Am F G Em Am Dm G C F Bb F C G Am Em F C Dm G')
    expect(chartLoop(long)).toHaveLength(16)
    expect(symbols(chartLoop(long).slice(-2))).toBe('Dm G')
    // The scale's chords over and over is a 7-chord loop.
    expect(chartLoop(chart('C Dm Em F G Am Bdim C Dm Em F'))).toHaveLength(7)
  })

  it('writes the chart as text, with numerals in the key', () => {
    expect(chartText(chart('F#m D A E'), parseKey('A'))).toBe('F♯m D A E · vi IV I V in A major')
    expect(chartText(chart('Am F C G'), parseKey('Am'))).toBe('Am F C G · i VI III VII in A minor')
    expect(chartText(chart('F#m D A E'), null)).toBe('F♯m D A E')
    // Chords named before the key was found are spelled for it first (E♭m is D♯m, iii, in B major).
    const B = parseKey('B')
    expect(chartText(chart('B Ebm E Gb').map((c) => spellChordInKey(c, B)), B)).toBe('B D♯m E F♯ · I iii IV V in B major')
  })
})

describe('the chord collection', () => {
  it('counts each sound once, in its usual spelling', () => {
    const found = ['A♯', 'B♭', 'Cm', 'D♭m', 'C♯m', 'Bm7♭5', 'Cm(add9)', 'nonsense']
    const groups = collectionGroups(found)
    expect(groups.map((g) => `${g.type.id}: ${symbols(g.chords)}`)).toEqual(['maj: B♭', 'min: Cm C♯m', 'm7b5: Bm7♭5', 'madd9: Cm(add9)'])
  })

  it('knows a sound you found under another name', () => {
    expect(inCollection(['A♯'], parseChord('Bb'))).toBe(true)
    expect(inCollection(['A♯'], parseChord('Bbm'))).toBe(false)
    expect(inCollection(['F♯m'], parseChord('Gbm'))).toBe(true)
  })
})

describe('free play helpers', () => {
  it('knows the key a chord is home in', () => {
    const home = (s: string) => {
      const k = homeKey(parseChord(s))
      return k ? keyName(k) : null
    }
    expect(home('F#m7')).toBe('F♯ minor')
    expect(home('Bb')).toBe('B♭ major')
    expect(home('Dsus4')).toBe('D major')
    expect(home('Bdim')).toBeNull()
    expect(home('Caug')).toBeNull()
  })

  it('weighs notes by how long they sounded', () => {
    const w = noteWeights(
      [
        { midi: 60, on: 0, off: 50 },
        { midi: 64, on: 0, off: 1000 },
        { midi: 67, on: 0, off: null },
      ],
      5000,
    )
    expect(w.map((n) => n.weight)).toEqual([0.2, 1, 2])
  })
})
