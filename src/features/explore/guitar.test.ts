import { describe, expect, it } from 'vitest'
import { CHORD_TYPES, type Chord, detectChord, mod, parseChord, pcOf, spellRoot } from '../../lib/theory'
import { type GuitarVoicing, capoShapes, fretText, guitarVoicings, voicingMidis, voicingName } from './guitar'

const everyChord: Chord[] = CHORD_TYPES.flatMap((type) => Array.from({ length: 12 }, (_, pc) => ({ root: spellRoot(pc, type), type })))
const name = (c: Chord) => `${pcOf(c.root)} ${c.type.id}`

/** Fingers a voicing needs: the barre is one, and neighbouring strings at the same fret share one (a small barre). */
function fingers(v: GuitarVoicing): number {
  const fretted = v.frets.map((f, i) => ({ f, s: 6 - i })).filter((x): x is { f: number; s: number } => x.f !== null && x.f > 0)
  const rest = fretted.filter((x) => !(v.barre && x.f === v.barre.fret && x.s <= v.barre.from && x.s >= v.barre.to))
  let n = v.barre ? 1 : 0
  rest.forEach((x, i) => {
    const prev = rest[i - 1]
    if (!(prev && prev.f === x.f && prev.s === x.s + 1)) n++
  })
  return n
}

describe('guitar shapes', () => {
  it('has at least one shape for every chord type on every root', () => {
    for (const c of everyChord) expect(guitarVoicings(c).length, name(c)).toBeGreaterThan(0)
  })

  it('only makes shapes that really are the chord, note by note, with the root in the bass', () => {
    for (const c of everyChord) {
      for (const v of guitarVoicings(c)) {
        const midis = voicingMidis(v.frets)
        const label = `${name(c)}: ${fretText(v.frets)}`
        const det = detectChord(midis)
        expect(det && pcOf(det.chord.root), label).toBe(pcOf(c.root))
        expect(det?.chord.type.id, label).toBe(c.type.id)
        expect(mod(Math.min(...midis), 12), label).toBe(pcOf(c.root))
      }
    }
  })

  it('only makes shapes a hand can play', () => {
    for (const c of everyChord) {
      for (const v of guitarVoicings(c)) {
        const label = `${name(c)}: ${fretText(v.frets)}`
        const fretted = v.frets.filter((f): f is number => f !== null && f > 0)
        expect(v.frets.every((f) => f === null || (f >= 0 && f <= 15)), label).toBe(true)
        // Within four frets, with four fingers at most.
        if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted), label).toBeLessThanOrEqual(3)
        expect(fingers(v), label).toBeLessThanOrEqual(4)
        if (v.barre) {
          // Nothing can be muted under a barre, and it sits on the lowest fret used.
          for (let s = v.barre.from; s >= v.barre.to; s--) expect(v.frets[6 - s], label).not.toBeNull()
          expect(Math.min(...fretted), label).toBe(v.barre.fret)
        }
      }
    }
  })

  it('draws the barre chords the way guitar books do', () => {
    const shapes = (s: string) => guitarVoicings(parseChord(s)).map((v) => `${voicingName(v)} ${fretText(v.frets)}`)
    expect(shapes('F#m')).toEqual(['E shape · 2fr 244222', 'A shape · 9fr x9(11)(11)(10)9'])
    expect(shapes('C#m')).toEqual(['A shape · 4fr x46654', 'E shape · 9fr 9(11)(11)999'])
    expect(shapes('Bm7')).toEqual(['A shape · 2fr x24232', 'E shape · 7fr 797777'])
    expect(shapes('B')).toEqual(['A shape · 2fr x24442', 'E shape · 7fr 799877'])
    expect(shapes('F')[0]).toBe('E shape · 1fr 133211')
    expect(shapes('Cm')[0]).toBe('A shape · 3fr x35543')
    expect(shapes('Bb')[0]).toBe('A shape · 1fr x13331')
  })

  it('puts the open chord first when there is one', () => {
    const g = guitarVoicings(parseChord('G'))
    expect(g.map((v) => `${voicingName(v)} ${fretText(v.frets)}`)).toEqual(['Open 320003', 'E shape · 3fr 355433', 'A shape · 10fr x(10)(12)(12)(12)(10)'])
    // The open A-shape A minor is the open Am, listed once.
    expect(guitarVoicings(parseChord('Am')).map((v) => fretText(v.frets))).toEqual(['x02210', '577555'])
  })

  it('gives the barre its fret and the capo equivalent', () => {
    const [fsm] = guitarVoicings(parseChord('F#m'))
    expect(fsm.barre).toEqual({ fret: 2, from: 6, to: 1 })
    expect(fsm.capo).toEqual({ shape: 'Em', fret: 2 })
    const [bm7] = guitarVoicings(parseChord('Bm7'))
    expect(bm7.barre).toEqual({ fret: 2, from: 5, to: 1 })
    expect(bm7.capo).toEqual({ shape: 'Am7', fret: 2 })
    // Shapes that reach behind the root's fret have no open version to capo.
    expect(guitarVoicings(parseChord('G6')).find((v) => v.form === 'E')?.capo).toBeUndefined()
  })

  it('finds open shapes to play with a capo', () => {
    expect(capoShapes(parseChord('B'))).toEqual([
      { shape: 'A', fret: 2 },
      { shape: 'G', fret: 4 },
      { shape: 'E', fret: 7 },
    ])
    expect(capoShapes(parseChord('F#m'))).toEqual([
      { shape: 'Em', fret: 2 },
      { shape: 'Dm', fret: 4 },
    ])
    expect(capoShapes(parseChord('C'))).toEqual([{ shape: 'A', fret: 3 }, { shape: 'G', fret: 5 }])
  })

  it('goes by sound, so A♯ and B♭ share their shapes', () => {
    expect(guitarVoicings(parseChord('A#')).map((v) => fretText(v.frets))).toEqual(guitarVoicings(parseChord('Bb')).map((v) => fretText(v.frets)))
  })
})
