import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ItemAnswer, type ItemStat, capFor, typicalMs, updateStat, weightOf } from './weak'

/**
 * What the games learn about you, kept between visits: how each note, chord, interval and key has gone, so rounds
 * can ask the weak ones more often.
 */
interface PracticeStats {
  /** Per game ("note-rush"), per item ("treble:F#4", "F♯m", "interval:9", "Bbm"). */
  items: Record<string, Record<string, ItemStat>>
  recordAnswers: (game: string, answers: ItemAnswer[]) => void
}

export const usePracticeStats = create<PracticeStats>()(
  persist(
    (set) => ({
      items: {},
      recordAnswers: (game, answers) => {
        if (!answers.length) return
        set((s) => {
          const mine = { ...s.items[game] }
          for (const a of answers) mine[a.id] = updateStat(mine[a.id], a)
          return { items: { ...s.items, [game]: mine } }
        })
      },
    }),
    { name: 'tonic-practice-stats', version: 1, partialize: (s) => ({ items: s.items }) },
  ),
)

const NONE: Record<string, ItemStat> = {}

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
