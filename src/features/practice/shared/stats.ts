import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ItemAnswer, type ItemStat, capFor, typicalMs, updateStat, weightOf } from './weak'

/** One finished round, for a level's recent history. */
export interface RoundRecord {
  /** When it was played (ms since 1970). */
  at: number
  score: number
  /** Percent right, 0–100. */
  accuracy: number
  /** Rhythm Tap's tempo. */
  bpm?: number
}

/** Rounds kept per level. */
const HISTORY = 20

/**
 * What the games learn about you, kept between visits: how each note, chord, interval and key has gone (so rounds
 * can ask the weak ones more often), and your last rounds on each level (for the trend on setup and results).
 */
interface PracticeStats {
  /** Per game ("note-rush"), per item ("treble:F#4", "F♯m", "interval:9", "Bbm"). */
  items: Record<string, Record<string, ItemStat>>
  /** Per game and level, as the level's record is named ("ear:quality-mm", "rhythm:l1:mid"), oldest first. */
  history: Record<string, RoundRecord[]>
  recordAnswers: (game: string, answers: ItemAnswer[]) => void
  addRound: (key: string, round: RoundRecord) => void
}

export const usePracticeStats = create<PracticeStats>()(
  persist(
    (set) => ({
      items: {},
      history: {},
      recordAnswers: (game, answers) => {
        if (!answers.length) return
        set((s) => {
          const mine = { ...s.items[game] }
          for (const a of answers) mine[a.id] = updateStat(mine[a.id], a)
          return { items: { ...s.items, [game]: mine } }
        })
      },
      addRound: (key, round) => set((s) => ({ history: { ...s.history, [key]: [...(s.history[key] ?? []), round].slice(-HISTORY) } })),
    }),
    { name: 'tonic-practice-stats', version: 1, partialize: (s) => ({ items: s.items, history: s.history }) },
  ),
)

const NONE: Record<string, ItemStat> = {}
const NO_ROUNDS: RoundRecord[] = []

/** A level's last rounds, oldest first ("" for none). */
export const useHistory = (key: string) => usePracticeStats((s) => (key ? (s.history[key] ?? NO_ROUNDS) : NO_ROUNDS))

/** "62% → 88% this week", "420 → 610 points since your last round", "Last round: 72%"; null with no rounds. */
export function trendText(rounds: RoundRecord[], metric: 'accuracy' | 'score', now = Date.now()): string | null {
  if (!rounds.length) return null
  const value = (r: RoundRecord) => (metric === 'accuracy' ? `${r.accuracy}%` : r.score.toLocaleString())
  const unit = metric === 'score' ? ' points' : ''
  const last = rounds[rounds.length - 1]
  if (rounds.length === 1) return `Last round: ${value(last)}${unit}`
  const week = rounds.filter((r) => now - r.at < 7 * 864e5)
  if (week.length >= 2) return `${value(week[0])} → ${value(last)}${unit} this week`
  return `${value(rounds[rounds.length - 2])} → ${value(last)}${unit} since your last round`
}

/** A game's item stats (outside React, e.g. when building a round). */
export const itemStats = (game: string) => usePracticeStats.getState().items[game] ?? NONE

/** The same, for a screen that shows them. */
export const useItemStats = (game: string) => usePracticeStats((s) => s.items[game] ?? NONE)

/** Weights for a round drawn from `ids`: weak and slow items come up more often (see weightOf). */
export function weigher(game: string, ids: string[]): (id: string) => number {
  const stats = itemStats(game)
  const typical = typicalMs(ids.map((id) => stats[id]))
  const cap = capFor(new Set(ids).size)
  return (id) => weightOf(stats[id], typical, cap)
}
