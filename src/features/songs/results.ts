import { type GameRecord, useProgress } from '../../state/progress'

/** Scoring a song run: accuracy, stars, time, and bests kept per hands. */

export type Hands = 'rh' | 'both'

/** Progress keys: the song's overall best (what the song list has always read) and one per hands. */
export const songKey = (id: string, hands?: Hands) => (hands ? `song-${id}:${hands}` : `song-${id}`)

/** Accuracy over notes: a four-note chord is four notes, and each wrong note is one slip. */
export const accuracyOf = (notes: number, mistakes: number) => (notes + mistakes ? notes / (notes + mistakes) : 0)

/** No slips = 3 stars, 85%+ = 2, any notes played = 1. */
export const starsOf = (notes: number, mistakes: number) =>
  mistakes === 0 ? 3 : accuracyOf(notes, mistakes) >= 0.85 ? 2 : notes > 0 ? 1 : 0

/** m:ss, rounded to whole seconds first (119.6 s is 2:00, not 1:60). */
export function clockTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Your best with these hands. Runs saved before bests were kept per hands only have the overall record (hands
 * unknown), so it stands in until the song has a record per hands.
 */
export function handsBest(games: Record<string, GameRecord>, id: string, hands: Hands): number {
  const own = games[songKey(id, hands)]
  if (own) return own.best
  if (games[songKey(id, 'rh')] || games[songKey(id, 'both')]) return 0
  return games[songKey(id)]?.best ?? 0
}

/** What a song card shows: both bests once you've finished it with each, else the overall best. */
export function bestText(games: Record<string, GameRecord>, id: string): string | null {
  const rh = games[songKey(id, 'rh')]
  const both = games[songKey(id, 'both')]
  if (rh && both) return `RH ${rh.best}% · Both ${both.best}%`
  const best = games[songKey(id)]?.best ?? 0
  return best > 0 ? `Best ${best}%` : null
}

/** Save a finished run (score = accuracy %). Returns true when it beats your best with these hands. */
export function recordSongRun(id: string, hands: Hands, score: number): boolean {
  const prog = useProgress.getState()
  const prev = handsBest(prog.games, id, hands)
  prog.recordGame(songKey(id), score)
  prog.recordGame(songKey(id, hands), score)
  return score > prev
}
