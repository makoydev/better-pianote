import { describe, expect, it } from 'vitest'
import { validateSong } from '../../lib/musicxml/validate'
import { midiOf, parseChord, parseNote } from '../../lib/theory'
import { SONGS, barBeats, eventBeats, findSong, parseBars, parseSong } from './index'
import type { Song, SongEvent } from './types'

const beats = (bar: SongEvent[]) => bar.reduce((s, e) => s + eventBeats(e), 0)
const names = (bar: SongEvent[]) => bar.map((e) => (e.notes.length ? e.notes.join('+') : 'r')).join(' ')
/** Every line of a song: right hand, left hand, extra voices. */
const lines = (song: Song) => [song.rh, ...(song.lh ? [song.lh] : []), ...(song.voices ?? []).map((v) => v.bars)]

/** The notes each hand starts in one bar, in time order (notes starting together joined with "+"). */
function onsets(song: Song, bar: number, hand: 'rh' | 'lh' | 'both'): string {
  const parts = [
    { hand: 'rh', bars: song.rh },
    ...(song.lh ? [{ hand: 'lh', bars: song.lh }] : []),
    ...(song.voices ?? []),
  ].filter((p) => hand === 'both' || p.hand === hand)
  const at = new Map<number, string[]>()
  for (const p of parts) {
    let t = 0
    let held: string[] = bar > 0 ? (p.bars[bar - 1].at(-1)?.tie ? p.bars[bar - 1].at(-1)!.notes : []) : []
    for (const e of p.bars[bar]) {
      const fresh = e.notes.filter((n) => !held.includes(n))
      if (fresh.length) at.set(t, [...(at.get(t) ?? []), ...fresh])
      held = e.tie ? e.notes : []
      t += eventBeats(e)
    }
  }
  return [...at.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, ns]) => ns.sort((a, b) => midiOf(parseNote(a)) - midiOf(parseNote(b))).join('+'))
    .join(' ')
}

describe('song format', () => {
  it('parses durations, dots, fingers, chords, ties and carries durations over', () => {
    const [bar] = parseBars('{C}E4:q./3 D4:8 [C4,E4]:h r:16 G4~')
    expect(bar.map((e) => [e.notes.join(','), e.dur, e.dots, e.finger, e.chord, e.tie])).toEqual([
      ['E4', 'q', 1, 3, 'C', false],
      ['D4', '8', 0, undefined, undefined, false],
      ['C4,E4', 'h', 0, undefined, undefined, false],
      ['', '16', 0, undefined, undefined, false],
      ['G4', '16', 0, undefined, undefined, true],
    ])
  })

  it('rejects typos', () => {
    expect(() => parseBars('E4:x')).toThrow()
    expect(() => parseBars('H4')).toThrow()
  })

  it('reads extra lines (voices) in the same format', () => {
    const base = { id: 'x', title: 'X', composer: 'Y', year: '', difficulty: 1, keyName: 'C major', keySig: 0, time: [4, 4], bpm: 90, tags: [], about: '' } as const
    const song = parseSong({ ...base, time: [4, 4], tags: [], rh: 'C5:w', lh: 'C3:w', voices: [{ hand: 'lh', bars: 'r:16 E3:8.~ E3:q r:h' }] })
    expect(song.voices).toHaveLength(1)
    expect(song.voices![0].hand).toBe('lh')
    expect(names(song.voices![0].bars[0])).toBe('r E3 E3 r')
    expect(parseSong({ ...base, time: [4, 4], tags: [], rh: 'C5:w' }).voices).toBeUndefined()
  })
})

describe.each(SONGS.map((s) => [s.title, s] as const))('%s', (_, song) => {
  const full = barBeats(song.time)
  const checkBars = (bars: SongEvent[][]) => {
    bars.forEach((bar, i) => {
      const b = beats(bar)
      if (song.pickup && i === 0) expect(b, `pickup bar`).toBeCloseTo(song.pickup)
      else if (song.pickup && i === bars.length - 1) expect([full, full - song.pickup].some((x) => Math.abs(x - b) < 1e-9), `last bar ${i + 1}: ${b}`).toBe(true)
      else expect(b, `bar ${i + 1} (${names(bar)})`).toBeCloseTo(full)
    })
  }

  it('every bar adds up to the time signature', () => checkBars(song.rh))

  it('left hand and extra voices (if any) line up bar for bar', () => {
    for (const bars of lines(song).slice(1)) {
      expect(bars.length).toBe(song.rh.length)
      checkBars(bars)
    }
  })

  it('passes the same checks as an imported song', () => {
    expect(validateSong(song)).toEqual([])
  })

  it('stays on a 61-key keyboard (C2–C7) and the chords are real chords', () => {
    for (const bar of lines(song).flat()) {
      for (const e of bar) {
        for (const n of e.notes) {
          const m = midiOf(parseNote(n))
          expect(m).toBeGreaterThanOrEqual(36)
          expect(m).toBeLessThanOrEqual(96)
        }
        if (e.chord) expect(() => parseChord(e.chord!)).not.toThrow()
      }
    }
  })

  it('ties connect to the same note', () => {
    for (const bars of lines(song)) {
      const flat = bars.flat()
      flat.forEach((e, i) => {
        if (e.tie) expect(flat[i + 1]?.notes).toEqual(e.notes)
      })
    }
  })

  it('starts with a chord symbol once the first full bar begins', () => {
    const first = song.pickup ? song.rh[1] : song.rh[0]
    if (song.id === 'fur-elise') return // the famous opening has no harmony under the first bar
    expect(first[0].chord).toBeTruthy()
  })
})

describe('melodies spot-check', () => {
  it('Ode to Joy opens E E F G | G F E D', () => {
    const s = findSong('ode-to-joy')!
    expect(names(s.rh[0])).toBe('E4 E4 F4 G4')
    expect(names(s.rh[1])).toBe('G4 F4 E4 D4')
    expect(names(s.rh[11])).toBe('C4 D4 G3')
  })

  it('Für Elise opens with the E–D♯ turn, and the broken chords pass between the hands', () => {
    const s = findSong('fur-elise')!
    expect(names(s.rh[0])).toBe('E5 D#5')
    expect(names(s.rh[1])).toBe('E5 D#5 E5 B4 D5 C5')
    expect(names(s.rh[2])).toBe('A4 r C4 E4 A4')
    // Breitkopf & Härtel (1888): the left hand rests under the turns and plays A–E–A or E–E–G♯ under the long notes.
    expect(s.lh!.map(names)).toEqual(['r', 'r', 'A2 E3 A3 r r', 'E2 E3 G#3 r r', 'A2 E3 A3 r r', 'r', 'A2 E3 A3 r r', 'E2 E3 G#3 r r', 'A2 E3 A3 r r'])
    expect(onsets(s, 2, 'both')).toBe('A2+A4 E3 A3 C4 E4 A4')
    expect(onsets(s, 3, 'both')).toBe('E2+B4 E3 G#3 E4 G#4 B4')
  })

  it('Amazing Grace starts on a pickup D and lands on G', () => {
    const s = findSong('amazing-grace')!
    expect(names(s.rh[0])).toBe('D4')
    expect(names(s.rh[1])).toBe('G4 B4 G4')
    expect(s.rh.length).toBe(17)
  })

  it('Minuet in G opens D G A B C | D G G over the Bach-Gesellschaft bass line', () => {
    const s = findSong('minuet-in-g')!
    expect(names(s.rh[0])).toBe('D5 G4 A4 B4 C5')
    expect(names(s.rh[1])).toBe('D5 G4 G4')
    expect(s.rh.length).toBe(16)
    expect(s.lh!.map(names).join(' | ')).toBe(
      'G3+B3+D4 A3 | B3 | C4 | B3 | A3 | G3 | D4 B3 G3 | D4 D3 C4 B3 A3 | B3 A3 | G3 B3 G3 | C4 | B3 C4 B3 A3 G3 | A3 F#3 | G3 B3 | C4 D4 D3 | G3 G2',
    )
  })

  it('Canon in D has Pachelbel’s ground bass in the left hand, twice', () => {
    const s = findSong('canon-in-d')!
    const bass = s.lh!.slice(0, 8).map(names).join(' ')
    expect(bass).toBe('D3 A2 B2 F#2 G2 D2 G2 A2 '.repeat(2).trim())
    expect(names(s.rh[0])).toBe('F#5 E5')
  })

  it('Happy Birthday jumps an octave on the third line', () => {
    const s = findSong('happy-birthday')!
    expect(names(s.rh[0])).toBe('G4 G4')
    expect(names(s.rh[1])).toBe('A4 G4 C5')
    expect(names(s.rh[5])).toBe('G5 E5 C5')
  })

  it('Greensleeves uses G♯ as the leading note', () => {
    const s = findSong('greensleeves')!
    expect(names(s.rh[0])).toBe('A4')
    expect(names(s.rh[3])).toBe('C5 A4 A4 G#4 A4')
  })

  it('Mountain King slides down by half steps, then repeats an octave higher', () => {
    const s = findSong('mountain-king')!
    expect(names(s.rh[2])).toBe('D#4 B3 D#4')
    expect(names(s.rh[3])).toBe('D4 Bb3 D4')
    const midis = (bars: SongEvent[][]) => bars.flat().map((e) => midiOf(parseNote(e.notes[0])))
    expect(midis(s.rh.slice(8, 16))).toEqual(midis(s.rh.slice(0, 8)).map((m) => m + 12))
  })

  it('Prelude in C splits each figure between the hands, as Bach wrote it', () => {
    const s = findSong('prelude-in-c')!
    expect(names(s.rh[0])).toBe('r G4 C5 E5 G4 C5 E5 '.repeat(2).trim())
    expect(names(s.lh![0])).toBe('C4 C4')
    expect(names(s.voices![0].bars[0])).toBe('r E4 E4 r E4 E4')
    // Both hands together play each chord as the same 8-note figure, twice per bar.
    const figures = s.rh.slice(0, 8).map((_, b) => onsets(s, b, 'both').split(' '))
    expect(figures[0].join(' ')).toBe('C4 E4 G4 C5 E5 G4 C5 E5 '.repeat(2).trim())
    expect(figures[2].join(' ')).toBe('B3 D4 G4 D5 F5 G4 D5 F5 '.repeat(2).trim())
    for (const n of figures) {
      expect(n).toHaveLength(16)
      expect(n.slice(5, 8)).toEqual(n.slice(2, 5))
      expect(n.slice(8)).toEqual(n.slice(0, 8))
    }
    // The left hand plays the first two notes of each half bar and holds them.
    expect(onsets(s, 0, 'lh')).toBe('C4 E4 C4 E4')
    // The excerpt ends on the piece's final chord.
    expect(onsets(s, 8, 'both')).toBe('C2+C3+E4+G4+C5')
  })

  it('songs are listed from easiest to hardest', () => {
    SONGS.slice(1).forEach((s, i) => expect(s.difficulty, s.title).toBeGreaterThanOrEqual(SONGS[i].difficulty))
  })

  it('every song has a unique id', () => {
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length)
  })
})
