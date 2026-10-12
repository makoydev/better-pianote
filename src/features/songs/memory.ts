import type { Song } from '../../content/songs'
import { setPref } from '../../state/prefs'
import { shownBar } from './bars'

/**
 * What each song remembers between visits, in the prefs store (so Export carries it): the hands, the loop, the
 * backing and accompaniment, the tempo, and where you were. Plus the song you practised last, for "Continue" on
 * Home and in the song list.
 */

export const songPref = (id: string, what: 'hands' | 'loop' | 'backing' | 'accompany' | 'listen' | 'bpm' | 'bar') => `song:${id}:${what}`

/** The song you practised last and the bar you were at (1-based, as shown; read by Home and the song list). */
export interface LastPractised {
  id: string
  title: string
  bar: number
  at: number
}
export const LAST_PRACTISED = 'songs:last'

/** A remembered loop: whether it's on, and its first and last bar (by index). */
export interface LoopMemory {
  on: boolean
  from: number
  to: number
}

/** The loop as remembered, if it still fits the song (an imported song can be read again with fewer bars). */
export function rememberedLoop(saved: unknown, bars: number, fallback: [number, number]): { on: boolean; bars: [number, number] } {
  const s = saved && typeof saved === 'object' ? (saved as Partial<LoopMemory>) : {}
  const ok = Number.isInteger(s.from) && Number.isInteger(s.to) && s.from! >= 0 && s.to! >= s.from! && s.to! < bars
  return ok ? { on: s.on === true, bars: [s.from!, s.to!] } : { on: false, bars: fallback }
}

/** The bar to offer "Continue from": where you were, unless that's the start (or no longer in the song). */
export function continueBar(saved: unknown, bars: number, firstFullBar: number): number | null {
  return typeof saved === 'number' && Number.isInteger(saved) && saved > firstFullBar && saved < bars ? saved : null
}

/** You're practising bar `bar` (by index): remember it for the song, and as the song you practised last. */
export function rememberBar(song: Song, bar: number) {
  setPref(songPref(song.id, 'bar'), bar)
  const last: LastPractised = { id: song.id, title: song.title, bar: shownBar(song, bar), at: Date.now() }
  setPref(LAST_PRACTISED, last)
}
