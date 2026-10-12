import { audio } from '../../../lib/audio/engine'
import { burst, celebrate } from '../../../lib/fx'
import { getPref, setPref } from '../../../state/prefs'
import { useProgress } from '../../../state/progress'
import { useSettings } from '../../../state/settings'

/** Feedback sounds, respecting the "UI sounds" setting. */
export function sfx(kind: 'correct' | 'wrong' | 'tap' | 'complete' | 'levelup') {
  if (useSettings.getState().uiSounds) audio.ui(kind)
}

export interface FinishResult {
  isBest: boolean
  prevBest: number
  levelBest: boolean
  xp: number
}

/**
 * Save a finished round: overall best for the game, best per level ("game:level"), XP, and a celebration.
 * XP: 5 for playing + 5 per star, +5 for beating your best. A round with nothing right (score 0) earns
 * nothing, so it doesn't keep the daily streak going either. A drill of what you missed (`levelId` null) counts
 * for the game and pays XP, but isn't a level's record.
 */
export function finishGame(gameId: string, levelId: string | null, score: number, stars: number): FinishResult {
  const { recordGame, addXp } = useProgress.getState()
  const overall = recordGame(gameId, score)
  const level = levelId === null ? null : recordGame(`${gameId}:${levelId}`, score)
  const beatBest = !!level?.isBest && level.prevBest > 0
  const xp = score > 0 ? 5 + stars * 5 + (beatBest ? 5 : 0) : 0
  addXp(xp)
  if (stars >= 2) sfx('complete')
  if (stars === 3 || beatBest) celebrate()
  else if (stars > 0) burst()
  return { isBest: overall.isBest, prevBest: overall.prevBest, levelBest: level?.isBest ?? false, xp }
}

export function starsFor(ratio: number, three = 0.9, two = 0.65): number {
  return ratio >= three ? 3 : ratio >= two ? 2 : ratio > 0 ? 1 : 0
}

/** Remember the last level/mode picked (kept in the prefs store, so Export carries it). */
export function remember<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  return getPref(key, fallback, allowed)
}

export function store(key: string, value: string) {
  setPref(key, value)
}
