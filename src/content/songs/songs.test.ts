import { describe, expect, it } from 'vitest'
import { midiOf, parseChord, parseNote } from '../../lib/theory'
import { SONGS, barBeats, eventBeats, findSong, parseBars } from './index'
import type { SongEvent } from './types'

const beats = (bar: SongEvent[]) => bar.reduce((s, e) => s + eventBeats(e), 0)
const names = (bar: SongEvent[]) => bar.map((e) => (e.notes.length ? e.notes.join('+') : 'r')).join(' ')

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

  it('left hand (if any) lines up bar for bar', () => {
    if (!song.lh) return
    expect(song.lh.length).toBe(song.rh.length)
    checkBars(song.lh)
  })

  it('stays on a 61-key keyboard (C2–C7) and the chords are real chords', () => {
    for (const bar of [...song.rh, ...(song.lh ?? [])]) {
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
    const flat = song.rh.flat()
    flat.forEach((e, i) => {
      if (e.tie) expect(flat[i + 1]?.notes).toEqual(e.notes)
    })
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

  it('Für Elise opens with the E–D♯ turn', () => {
    const s = findSong('fur-elise')!
    expect(names(s.rh[0])).toBe('E5 D#5')
    expect(names(s.rh[1])).toBe('E5 D#5 E5 B4 D5 C5')
    expect(names(s.rh[2])).toBe('A4 r C4 E4 A4')
  })

  it('Amazing Grace starts on a pickup D and lands on G', () => {
    const s = findSong('amazing-grace')!
    expect(names(s.rh[0])).toBe('D4')
    expect(names(s.rh[1])).toBe('G4 B4 G4')
    expect(s.rh.length).toBe(17)
  })

  it('Minuet in G opens D G A B C | D G G', () => {
    const s = findSong('minuet-in-g')!
    expect(names(s.rh[0])).toBe('D5 G4 A4 B4 C5')
    expect(names(s.rh[1])).toBe('D5 G4 G4')
    expect(s.rh.length).toBe(16)
  })

  it('every song has a unique id', () => {
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length)
  })
})
