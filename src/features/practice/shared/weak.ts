/**
 * Weak spots: how each thing a game asks (a note on a clef, a chord, an interval, a key) has gone, and rounds that
 * ask the ones you miss or are slow on more often, without asking only those.
 */

export interface ItemStat {
  /** Times asked. */
  seen: number
  /** Times missed: a wrong answer, a skip, or asking to be shown. */
  wrong: number
  /** Recent miss rate, 0–1: each answer moves it 30% of the way, so old mistakes fade once you get it right. */
  miss: number
  /** Time to a first-try right answer in ms, recent answers counting most (0 until there is one). */
  ms: number
}

/** How one question went. */
export interface ItemAnswer {
  id: string
  missed: boolean
  /** Time to the answer, when it was right first time. */
  ms?: number
}

const RECENT = 0.3

/** Milliseconds since a performance.now() time, for an answer's time. */
export const msSince = (t: number) => performance.now() - t

export function updateStat(prev: ItemStat | undefined, a: ItemAnswer): ItemStat {
  const s = prev ?? { seen: 0, wrong: 0, miss: 0, ms: 0 }
  const x = a.missed ? 1 : 0
  const ms = a.missed || a.ms === undefined ? s.ms : s.ms ? s.ms + (a.ms - s.ms) * RECENT : a.ms
  return { seen: s.seen + 1, wrong: s.wrong + x, miss: s.seen ? s.miss + (x - s.miss) * RECENT : x, ms: Math.round(ms) }
}

/** Your usual answer time among these items (the median), or 0 with too few timed answers to tell. */
export function typicalMs(stats: (ItemStat | undefined)[]): number {
  const ms = stats.flatMap((s) => (s?.ms ? [s.ms] : [])).sort((a, b) => a - b)
  return ms.length < 3 ? 0 : ms[Math.floor(ms.length / 2)]
}

/** 0 at your usual time or quicker, 1 at twice as long or more. */
export function slowness(s: ItemStat, typical: number): number {
  if (!s.ms || !typical) return 0
  return Math.max(0, Math.min(1, s.ms / typical - 1))
}

/**
 * How much more often to ask an item than one you know well: 1 for that, up to `cap` for one you keep missing and
 * are slow on. Items you haven't met yet get a little extra, so they come up. With only a few choices (major or
 * minor?) the cap stays low, or guessing the weak one would pay.
 */
export function weightOf(s: ItemStat | undefined, typical: number, cap = 4): number {
  const raw = s?.seen ? 1 + 2.4 * s.miss + 0.6 * slowness(s, typical) : 1.5
  return 1 + ((raw - 1) * (cap - 1)) / 3
}

/** The cap for a pool of this many items: 1.5 for two, 2 for four, up to 4. */
export const capFor = (items: number) => Math.min(4, Math.max(1.5, items / 2))

/** The weakest of `ids`, most missed (then slowest) first: only items asked at least twice that you miss or are slow on. */
export function weakest(stats: Record<string, ItemStat>, ids: string[], n = 3): string[] {
  const typical = typicalMs(ids.map((id) => stats[id]))
  return [...new Set(ids)]
    .flatMap((id) => {
      const s = stats[id]
      return s && s.seen >= 2 ? [{ id, score: s.miss + 0.5 * slowness(s, typical) }] : []
    })
    .filter((x) => x.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.id)
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, rng: () => number = Math.random): T {
  const ws = items.map((t) => Math.max(0, weight(t)))
  const total = ws.reduce((a, b) => a + b, 0)
  if (total <= 0) return items[Math.floor(rng() * items.length)]
  let r = rng() * total
  for (let i = 0; i < items.length; i++) if ((r -= ws[i]) < 0) return items[i]
  return items[items.length - 1]
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}

/** Put items in a random order where nothing comes twice in a row (when that's possible at all). */
export function spread<T>(items: T[], idOf: (t: T) => string, rng: () => number = Math.random): T[] {
  const left = shuffle([...items], rng)
  const out: T[] = []
  while (left.length) {
    const last = out.length ? idOf(out[out.length - 1]) : null
    const counts = new Map<string, number>()
    for (const t of left) counts.set(idOf(t), (counts.get(idOf(t)) ?? 0) + 1)
    const [topId, topN] = [...counts].sort((a, b) => b[1] - a[1])[0]
    // If the commonest item would otherwise run out of room, it has to go now.
    let options = topId !== last && topN > Math.floor(left.length / 2) ? left.filter((t) => idOf(t) === topId) : left.filter((t) => idOf(t) !== last)
    if (!options.length) options = left
    const pick = options[Math.floor(rng() * options.length)]
    left.splice(left.indexOf(pick), 1)
    out.push(pick)
  }
  return out
}

/**
 * A round of `n` from `pool`. Everything comes up once while there's room (when there isn't, weak items are
 * likelier to make it in); the turns left over go to weak items, at most a couple each. Nothing comes twice in a row.
 */
export function weightedRound<T>(pool: T[], n: number, weight: (t: T) => number, idOf: (t: T) => string, rng: () => number = Math.random): T[] {
  if (!pool.length) return []
  const picks: T[] = []
  let left = [...pool]
  while (picks.length < n && left.length) {
    const t = weightedPick(left, weight, rng)
    picks.push(t)
    left = left.filter((x) => x !== t)
  }
  const cap = Math.ceil(n / pool.length) + 1
  const count = new Map<string, number>()
  for (const t of picks) count.set(idOf(t), 1)
  while (picks.length < n) {
    const open = pool.filter((t) => (count.get(idOf(t)) ?? 0) < cap)
    const t = weightedPick(open.length ? open : pool, weight, rng)
    picks.push(t)
    count.set(idOf(t), (count.get(idOf(t)) ?? 0) + 1)
  }
  return spread(picks, idOf, rng)
}

/**
 * A drill of what you just missed: those fill about 60% of the round (each at least once while there's room) and
 * the rest comes from the pool as usual. Nothing comes twice in a row, unless `repeats` allows it (with only two
 * answers, major or minor, a strict back-and-forth would give the answer away).
 */
export function drillRound<T>(
  missed: T[],
  pool: T[],
  n: number,
  weight: (t: T) => number,
  idOf: (t: T) => string,
  rng: () => number = Math.random,
  repeats = false,
): T[] {
  const ids = new Set<string>()
  const unique: T[] = []
  for (const t of missed) {
    if (ids.has(idOf(t))) continue
    ids.add(idOf(t))
    unique.push(t)
  }
  if (!unique.length) return weightedRound(pool, n, weight, idOf, rng)
  const k = Math.min(n, Math.max(unique.length, Math.round(n * 0.6)))
  const order = shuffle([...unique], rng)
  const drilled = Array.from({ length: k }, (_, i) => order[i % order.length])
  const others = pool.filter((t) => !ids.has(idOf(t)))
  const rest = k < n ? weightedRound(others.length ? others : pool, n - k, weight, idOf, rng) : []
  return repeats ? shuffle([...drilled, ...rest], rng) : spread([...drilled, ...rest], idOf, rng)
}

/**
 * For a game that draws notes one after another (Note Rush): weights that give the missed items about `share` of
 * the draws between them, on top of each item's own `chance`.
 */
export function drillWeight<T>(pool: T[], chance: (t: T) => number, isMissed: (t: T) => boolean, share = 0.6): (t: T) => number {
  const sum = (xs: T[]) => xs.reduce((a, t) => a + chance(t), 0)
  const m = sum(pool.filter(isMissed))
  const o = sum(pool.filter((t) => !isMissed(t)))
  const boost = m > 0 && o > 0 ? (share / (1 - share)) * (o / m) : 1
  return (t) => (isMissed(t) ? boost : 1)
}
