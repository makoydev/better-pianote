import { describe, expect, it } from 'vitest'
import { SONGS, type Song, findSong } from '../../content/songs'
import type { GameRecord } from '../../state/progress'
import { agoText, bestsText, continueFrom, fadeDelay, matchesSearch, practiceText, readLastSong, sortSongs } from './browse'

const song = (id: string, o: Partial<Song> = {}): Song => ({ ...SONGS[0], id, ...o })
const rec = (best: number, lastPlayed = 1, plays = 1): GameRecord => ({ best, plays, last: best, lastPlayed })
const ids = (songs: Song[]) => songs.map((s) => s.id)

describe('searching songs', () => {
  it('finds words in the title, composer or tags, ignoring case and accents', () => {
    const elise = findSong('fur-elise')!
    expect(matchesSearch(elise, 'fur elise')).toBe(true)
    expect(matchesSearch(elise, 'BEETHOVEN')).toBe(true)
    expect(matchesSearch(elise, 'elise 3/8')).toBe(true)
    expect(matchesSearch(elise, 'elise bach')).toBe(false)
    expect(matchesSearch(elise, '   ')).toBe(true)
  })
})

describe('sorting songs', () => {
  const a = song('a', { title: 'Zebra', difficulty: 2 })
  const b = song('b', { title: 'apple', difficulty: 3 })
  const c = song('c', { title: 'Mango', difficulty: 1 })
  const games = { 'song-c': rec(80, 300), 'song-a': rec(90, 200) }

  it('recently practised first; songs never played keep their order after them', () => {
    expect(ids(sortSongs([a, b, c], 'recent', { games }))).toEqual(['c', 'a', 'b'])
    expect(ids(sortSongs([b, a, c, song('d')], 'recent', { games: {} }))).toEqual(['b', 'a', 'c', 'd'])
  })

  it('by title, by difficulty, or newest import first', () => {
    expect(ids(sortSongs([a, b, c], 'title', { games }))).toEqual(['b', 'c', 'a'])
    expect(ids(sortSongs([a, b, c], 'level', { games }))).toEqual(['c', 'a', 'b'])
    const added: Record<string, number> = { a: 5, c: 9 }
    expect(ids(sortSongs([a, b, c], 'added', { games, addedAt: (id) => added[id] }))).toEqual(['c', 'a', 'b'])
  })
})

describe('what a card says', () => {
  const now = new Date(2026, 9, 13, 10, 0).getTime()
  const daysAgo = (n: number, hour = 20) => new Date(2026, 9, 13 - n, hour, 0).getTime()

  it('when you last practised, in calendar days', () => {
    expect(agoText(daysAgo(0, 1), now)).toBe('today')
    expect(agoText(daysAgo(1, 23), now)).toBe('yesterday')
    expect(agoText(daysAgo(3), now)).toBe('3 days ago')
    expect(agoText(daysAgo(8), now)).toBe('a week ago')
    expect(agoText(daysAgo(20), now)).toBe('2 weeks ago')
    expect(agoText(daysAgo(40), now)).toBe('a month ago')
    expect(agoText(daysAgo(150), now)).toBe('5 months ago')
    expect(agoText(daysAgo(400), now)).toBe('over a year ago')
  })

  it('"Practised 3 days ago · 12 runs"', () => {
    expect(practiceText(rec(90, daysAgo(3), 12), now)).toBe('Practised 3 days ago · 12 runs')
    expect(practiceText(rec(90, daysAgo(0), 1), now)).toBe('Practised today · 1 run')
    expect(practiceText(undefined, now)).toBeNull()
  })

  it('your best with each hands setting, or the overall best from older runs', () => {
    expect(bestsText({ 'song-x': rec(85), 'song-x:rh': rec(100), 'song-x:both': rec(85) }, 'x')).toBe('RH 100% · Both 85%')
    expect(bestsText({ 'song-x': rec(90), 'song-x:both': rec(90) }, 'x')).toBe('Both 90%')
    expect(bestsText({ 'song-x': rec(70) }, 'x')).toBe('Best 70%')
    expect(bestsText({}, 'x')).toBeNull()
  })
})

describe('continue where you left off', () => {
  it('reads the player’s record only when it makes sense', () => {
    expect(readLastSong({ id: 'twinkle', title: 'Twinkle', bar: 4, at: 123 })).toEqual({ id: 'twinkle', title: 'Twinkle', bar: 4, at: 123 })
    for (const junk of [null, 'twinkle', 42, {}, { id: '', title: 'T', bar: 1, at: 1 }, { id: 'x', title: 'T', bar: -1, at: 1 }, { id: 'x', title: 'T', bar: 1.5, at: 1 }, { id: 'x', title: 'T', bar: 1 }]) {
      expect(readLastSong(junk)).toBeNull()
    }
  })

  it('names the bar the way the player does', () => {
    const twinkle = findSong('twinkle')!
    expect(continueFrom(twinkle, 0)).toBe('from the start')
    expect(continueFrom(twinkle, 4)).toBe('from bar 5')
    // Amazing Grace starts with a pickup: its bar 1 comes after it.
    const grace = findSong('amazing-grace')!
    expect(continueFrom(grace, 1)).toBe('from the start')
    expect(continueFrom(grace, 5)).toBe('from bar 5')
    expect(continueFrom(twinkle, 999)).toBe(`from bar ${twinkle.rh.length}`)
  })

  it('cards fade in quickly however long the list', () => {
    expect(fadeDelay(0)).toBe(0)
    expect(fadeDelay(200)).toBe(fadeDelay(8))
    expect(fadeDelay(200)).toBeLessThanOrEqual(0.35)
  })
})
