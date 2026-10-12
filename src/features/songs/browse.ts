import type { Song } from '../../content/songs'
import type { GameRecord } from '../../state/progress'
import { songKey } from './results'

/** Finding a song on the Songs page: search, sort, and what each card says about your practice. */

export type SongSort = 'recent' | 'title' | 'level' | 'added'
export const SORTS: readonly SongSort[] = ['recent', 'title', 'level', 'added']
export const SORT_LABEL: Record<SongSort, string> = { recent: 'Recently practised', title: 'Title', level: 'Difficulty', added: 'Recently added' }

export type SongView = 'cards' | 'list'
export const VIEWS: readonly SongView[] = ['cards', 'list']

/** Lower case without accents, so "fur elise" finds "Für Elise". */
const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Every word typed is somewhere in the title, composer or tags. */
export function matchesSearch(song: Song, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = fold([song.title, song.composer, ...song.tags].join(' '))
  return words.every((w) => text.includes(w))
}

/**
 * Songs in the chosen order. Songs with nothing to sort by (never practised, or built in when sorting by date
 * added) keep the order they came in, after the others. A finished run dates a song's practice, and so does
 * the song you practised last (`last`), finished or not.
 */
export function sortSongs(
  songs: Song[],
  sort: SongSort,
  ctx: { games: Record<string, GameRecord>; addedAt?: (id: string) => number | undefined; last?: LastSong | null },
): Song[] {
  const played = (s: Song) => Math.max(ctx.games[songKey(s.id)]?.lastPlayed ?? 0, ctx.last?.id === s.id ? ctx.last.at : 0)
  const added = (s: Song) => ctx.addedAt?.(s.id) ?? 0
  const by: Record<SongSort, (a: Song, b: Song) => number> = {
    recent: (a, b) => played(b) - played(a),
    title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }),
    level: (a, b) => a.difficulty - b.difficulty,
    added: (a, b) => added(b) - added(a),
  }
  return [...songs].sort(by[sort])
}

const DAY = 864e5
const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0)

/** "today", "yesterday", "3 days ago", "2 weeks ago", "5 months ago", counted in calendar days. */
export function agoText(t: number, now = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(t)) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return days < 14 ? 'a week ago' : `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return days < 60 ? 'a month ago' : `${Math.floor(days / 30)} months ago`
  return 'over a year ago'
}

/** "Practised 3 days ago · 12 runs", or null before the first finished run. */
export function practiceText(record: GameRecord | undefined, now = Date.now()): string | null {
  if (!record?.plays) return null
  const runs = `${record.plays} ${record.plays === 1 ? 'run' : 'runs'}`
  return record.lastPlayed ? `Practised ${agoText(record.lastPlayed, now)} · ${runs}` : runs
}

/**
 * Your best with each hands setting you've finished ("RH 100% · Both 85%"). Runs from before bests were kept
 * per hands only have an overall best: "Best 90%".
 */
export function bestsText(games: Record<string, GameRecord>, id: string): string | null {
  const rh = games[songKey(id, 'rh')]
  const both = games[songKey(id, 'both')]
  const parts = [rh && `RH ${rh.best}%`, both && `Both ${both.best}%`].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  const best = games[songKey(id)]?.best ?? 0
  return best > 0 ? `Best ${best}%` : null
}

/** Where you left off: the player keeps this as "songs:last" (`bar` counts from 0, like the song's bars). */
export interface LastSong {
  id: string
  title: string
  bar: number
  at: number
}

/** The "songs:last" record, if it's there and makes sense. */
export function readLastSong(v: unknown): LastSong | null {
  if (!v || typeof v !== 'object') return null
  const { id, title, bar, at } = v as Record<string, unknown>
  if (typeof id !== 'string' || !id || typeof title !== 'string') return null
  if (typeof bar !== 'number' || !Number.isInteger(bar) || bar < 0) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  return { id, title, bar, at }
}

/** "from bar 12", numbered like the player numbers bars (a pickup isn't bar 1), or "from the start". */
export function continueFrom(song: Pick<Song, 'pickup' | 'rh'>, bar: number): string {
  const b = Math.min(bar, song.rh.length - 1)
  const first = song.pickup ? 1 : 0
  return b <= first ? 'from the start' : `from bar ${song.pickup ? b : b + 1}`
}

/** Cards fade in one after another, but a long library shouldn't keep you waiting. */
export const fadeDelay = (index: number) => Math.min(index, 8) * 0.04
