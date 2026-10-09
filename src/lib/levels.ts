/** XP levels: each level needs a little more XP than the last. */

const TITLES = [
  'Curious Ears',
  'Key Finder',
  'Note Spotter',
  'Staff Reader',
  'Chord Builder',
  'Scale Climber',
  'Groove Keeper',
  'Harmony Hacker',
  'Progression Pro',
  'Sight Reader',
  'Keys Maestro',
  'Virtuoso',
]

/** Total XP needed to reach `level` (level 1 = 0 XP, level 2 = 60, level 3 = 150 …). */
export function xpForLevel(level: number): number {
  const n = level - 1
  return 30 * n * (n + 1) + 0
}

export function levelFor(xp: number): { level: number; title: string; progress: number; toNext: number } {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const start = xpForLevel(level)
  const end = xpForLevel(level + 1)
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    progress: (xp - start) / (end - start),
    toNext: end - xp,
  }
}
