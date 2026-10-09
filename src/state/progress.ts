import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emitXp } from '../lib/fx'

export interface LessonRecord {
  stars: number
  completedAt: number
}

export interface GameRecord {
  best: number
  plays: number
  last: number
  lastPlayed: number
}

export interface Progress {
  xp: number
  lessons: Record<string, LessonRecord>
  games: Record<string, GameRecord>
  streak: number
  bestStreak: number
  lastDay: string | null
  dayKey: string
  dayXp: number
  dailyGoal: number
  /** Chord symbols you've played in Free Play (your collection). */
  chordsFound: string[]
  /** Days with practice (YYYY-MM-DD), newest last, capped. */
  days: string[]
  addXp: (n: number) => void
  completeLesson: (id: string, stars: number) => { firstTime: boolean; improved: boolean }
  recordGame: (id: string, score: number) => { isBest: boolean; prevBest: number }
  findChord: (symbol: string) => boolean
  setGoal: (n: number) => void
  resetAll: () => void
}

export function dayKeyOf(t = Date.now()): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const initial = {
  xp: 0,
  lessons: {},
  games: {},
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  dayKey: dayKeyOf(),
  dayXp: 0,
  dailyGoal: 40,
  chordsFound: [],
  days: [],
}

export const useProgress = create<Progress>()(
  persist(
    (set, get) => ({
      ...initial,
      addXp: (n) => {
        if (n <= 0) return
        const today = dayKeyOf()
        set((s) => {
          let { streak, bestStreak, days } = s
          if (s.lastDay !== today) {
            streak = s.lastDay === dayKeyOf(Date.now() - 864e5) ? s.streak + 1 : 1
            bestStreak = Math.max(bestStreak, streak)
            days = [...days, today].slice(-120)
          }
          const dayXp = (s.dayKey === today ? s.dayXp : 0) + n
          return { xp: s.xp + n, streak, bestStreak, days, lastDay: today, dayKey: today, dayXp }
        })
        emitXp(n)
      },
      completeLesson: (id, stars) => {
        const prev = get().lessons[id]
        const firstTime = !prev
        const improved = !!prev && stars > prev.stars
        set((s) => ({
          lessons: { ...s.lessons, [id]: { stars: Math.max(stars, prev?.stars ?? 0), completedAt: Date.now() } },
        }))
        return { firstTime, improved }
      },
      recordGame: (id, score) => {
        const prev = get().games[id]
        const prevBest = prev?.best ?? 0
        set((s) => ({
          games: {
            ...s.games,
            [id]: { best: Math.max(prevBest, score), plays: (prev?.plays ?? 0) + 1, last: score, lastPlayed: Date.now() },
          },
        }))
        return { isBest: score > prevBest, prevBest }
      },
      findChord: (symbol) => {
        if (get().chordsFound.includes(symbol)) return false
        set((s) => ({ chordsFound: [...s.chordsFound, symbol] }))
        return true
      },
      setGoal: (n) => set({ dailyGoal: n }),
      resetAll: () => set({ ...initial, dayKey: dayKeyOf() }),
    }),
    { name: 'tonic-progress', version: 1 },
  ),
)

/** Streak as it stands today (0 if you missed yesterday). */
export function liveStreak(p: Pick<Progress, 'streak' | 'lastDay'>): number {
  const today = dayKeyOf()
  const yesterday = dayKeyOf(Date.now() - 864e5)
  return p.lastDay === today || p.lastDay === yesterday ? p.streak : 0
}

export function todayXp(p: Pick<Progress, 'dayKey' | 'dayXp'>): number {
  return p.dayKey === dayKeyOf() ? p.dayXp : 0
}
