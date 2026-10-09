import { parseSong } from './parse'
import { SONG_SOURCES } from './songs'
import type { Song } from './types'

export type { Song, SongChange, SongEvent, SongSource, SongVoice } from './types'
export { BEATS, barBeats, eventBeats, parseBars, parseSong } from './parse'

export const SONGS: Song[] = SONG_SOURCES.map(parseSong)

export const findSong = (id: string) => SONGS.find((s) => s.id === id) ?? null

export const DIFFICULTY_LABEL: Record<Song['difficulty'], string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' }

/** Stars for a best score (accuracy %): perfect = 3, 85%+ = 2, finished = 1. */
export const starsForScore = (score: number) => (score >= 100 ? 3 : score >= 85 ? 2 : score > 0 ? 1 : 0)
