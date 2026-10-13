import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Hands } from './results'

/** Your last runs of each song (the ones that reached the results), so the results can show how it's going. */

export interface RunRecord {
  /** When it finished (ms since 1970). */
  at: number
  hands: Hands
  /** Accuracy, 0–100. */
  accuracy: number
  /** The tempo: beats per minute (rounded) and % of the song's own. */
  bpm: number
  pct: number
  /** The bar it started from (by index), when it didn't start at the beginning. */
  from?: number
  /** Played along at tempo (accuracy = notes in time); a Practice run when it's left out. */
  mode?: 'along'
}

/** How many runs each song keeps. */
export const RUNS_KEPT = 20

interface SongRuns {
  runs: Record<string, RunRecord[]>
  addRun: (songId: string, run: RunRecord) => void
}

export const useSongRuns = create<SongRuns>()(
  persist(
    (set) => ({
      runs: {},
      addRun: (songId, run) => set((s) => ({ runs: { ...s.runs, [songId]: [...(s.runs[songId] ?? []), run].slice(-RUNS_KEPT) } })),
    }),
    { name: 'tonic-song-runs', version: 1, partialize: (s) => ({ runs: s.runs }) },
  ),
)

/** The runs to draw a trend from: the latest ones with the same hands and mode (so they compare), oldest first. */
export const trendRuns = (runs: RunRecord[] | undefined, hands: Hands, mode?: 'along', max = 12) =>
  (runs ?? []).filter((r) => r.hands === hands && r.mode === mode).slice(-max)
