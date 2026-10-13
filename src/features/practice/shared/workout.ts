import { starsFor } from './finish'

/**
 * The daily workout: a few games one after another, each a short round at the level you last played there, and one
 * summary at the end that counts toward the day's goal. A game plays as a part of it when it's given a WorkoutPart:
 * it starts straight away, its round is the part's size, and it hands back how it went instead of showing results.
 */

/** Its record in the progress store (best and last %, when it was last done). */
export const WORKOUT_ID = 'workout'

/** The parts, in order: a game (by id) and how long a round of it is (Note Rush: seconds). About five minutes. */
export const WORKOUT: { game: string; size: number; what: string }[] = [
  { game: 'note-rush', size: 60, what: '60 seconds of notes' },
  { game: 'chord-trainer', size: 5, what: '5 chords' },
  { game: 'rhythm', size: 3, what: '3 rhythms' },
  { game: 'ear', size: 5, what: '5 ear questions' },
]

export interface WorkoutPart {
  /** How long the round is: chords, rhythms or questions (Note Rush: seconds). */
  size: number
  /** Where you are in the workout, for the top bar ("Part 2 of 4"). */
  step: string
  /** The round is over. It isn't saved as one of the game's own rounds (your weak spots still are). */
  onDone: (r: PartResult) => void
}

export interface PartResult {
  /** How much of it went right, 0–1 (answers right first time, the rhythm's accuracy, Note Rush's notes). */
  score: number
  stars: number
  /** What it came to, for the summary ("4 of 5 chords clean", "22 notes right"). */
  detail: string
}

/** XP for a part: some for playing it and more per star, but nothing when nothing went right. */
export const partXp = (r: PartResult) => (r.score > 0 ? 3 + 2 * r.stars : 0)

/** Doing every part earns this on top. */
export const WORKOUT_BONUS = 10

/** How the workout went: the parts' average (%), stars for it, and the XP (with the bonus once all `of` are done). */
export function workoutTotals(parts: PartResult[], of: number) {
  const pct = parts.length ? Math.round((parts.reduce((s, p) => s + p.score, 0) / parts.length) * 100) : 0
  const xp = parts.reduce((s, p) => s + partXp(p), 0) + (parts.length >= of && pct > 0 ? WORKOUT_BONUS : 0)
  return { pct, stars: starsFor(pct / 100, 0.9, 0.65), xp }
}
