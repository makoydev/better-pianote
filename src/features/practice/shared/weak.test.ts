import { describe, expect, it } from 'vitest'
import { type ItemStat, capFor, drillRound, drillWeight, slowness, spread, typicalMs, updateStat, weakest, weightOf, weightedPick, weightedRound } from './weak'

/** Small deterministic random generator so tests are repeatable. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const stat = (miss: number, ms = 1000, seen = 5): ItemStat => ({ seen, wrong: Math.round(seen * miss), miss, ms })
const noRepeats = (xs: string[]) => xs.every((x, i) => i === 0 || x !== xs[i - 1])
const counts = (xs: string[]) => xs.reduce<Record<string, number>>((c, x) => ({ ...c, [x]: (c[x] ?? 0) + 1 }), {})

describe('item stats', () => {
  it('counts what you saw and missed, with recent answers counting most', () => {
    let s = updateStat(undefined, { id: 'F5', missed: true })
    expect(s).toEqual({ seen: 1, wrong: 1, miss: 1, ms: 0 })
    s = updateStat(s, { id: 'F5', missed: false, ms: 2000 })
    expect(s.seen).toBe(2)
    expect(s.wrong).toBe(1)
    expect(s.miss).toBeCloseTo(0.7)
    expect(s.ms).toBe(2000)
    // Getting it right again and again makes an old miss fade.
    for (let i = 0; i < 8; i++) s = updateStat(s, { id: 'F5', missed: false, ms: 1000 })
    expect(s.miss).toBeLessThan(0.05)
    expect(s.ms).toBeLessThan(1100)
    expect(s.wrong).toBe(1)
  })

  it('times only first-try right answers', () => {
    const s = updateStat({ seen: 3, wrong: 0, miss: 0, ms: 900 }, { id: 'x', missed: true, ms: 5000 })
    expect(s.ms).toBe(900)
  })

  it('finds your usual time and how slow an item is against it', () => {
    expect(typicalMs([stat(0, 800), stat(0, 1000), undefined, stat(0, 3000)])).toBe(1000)
    // Too few timed answers to tell.
    expect(typicalMs([stat(0, 800), undefined])).toBe(0)
    expect(slowness(stat(0, 1000), 1000)).toBe(0)
    expect(slowness(stat(0, 1500), 1000)).toBeCloseTo(0.5)
    expect(slowness(stat(0, 5000), 1000)).toBe(1)
  })
})

describe('weights', () => {
  it('asks weak and slow items more often, up to the cap', () => {
    const known = weightOf(stat(0, 1000), 1000)
    const missed = weightOf(stat(1, 1000), 1000)
    const slow = weightOf(stat(0, 2500), 1000)
    expect(known).toBe(1)
    expect(missed).toBeGreaterThan(slow)
    expect(slow).toBeGreaterThan(known)
    expect(weightOf(stat(1, 9000), 1000)).toBeCloseTo(4)
    // New items get a little extra so they come up.
    expect(weightOf(undefined, 1000)).toBeGreaterThan(1)
    expect(weightOf(undefined, 1000)).toBeLessThan(missed)
  })

  it('keeps the cap low when there are only a few answers to choose from', () => {
    expect(capFor(2)).toBe(1.5)
    expect(capFor(4)).toBe(2)
    expect(capFor(12)).toBe(4)
    expect(weightOf(stat(1, 9000), 1000, capFor(2))).toBeCloseTo(1.5)
  })

  it('names the weakest items: missed first, then slow, only with enough answers', () => {
    const stats: Record<string, ItemStat> = {
      A3: stat(0.8),
      F5: stat(0.4),
      C4: stat(0, 1000),
      D4: stat(0, 1000),
      E4: stat(0, 2600),
      G4: stat(1, 1000, 1),
    }
    expect(weakest(stats, Object.keys(stats))).toEqual(['A3', 'E4', 'F5'])
    expect(weakest(stats, Object.keys(stats), 1)).toEqual(['A3'])
    // Only the items asked about.
    expect(weakest(stats, ['C4', 'F5'])).toEqual(['F5'])
    expect(weakest({}, ['C4'])).toEqual([])
  })

  it('picks by weight', () => {
    const rng = seeded(4)
    const picks = Array.from({ length: 4000 }, () => weightedPick(['a', 'b'], (x) => (x === 'a' ? 3 : 1), rng))
    expect(counts(picks).a / 4000).toBeCloseTo(0.75, 1)
  })
})

describe('rounds', () => {
  const pool = ['C', 'Dm', 'Em', 'F', 'G', 'Am']
  const id = (x: string) => x

  it('spreads items out so nothing comes twice in a row', () => {
    for (let seed = 1; seed < 30; seed++) {
      const out = spread(['a', 'a', 'a', 'b', 'b', 'c'], id, seeded(seed))
      expect(out.sort()).toEqual(['a', 'a', 'a', 'b', 'b', 'c'])
    }
    for (let seed = 1; seed < 30; seed++) expect(noRepeats(spread(['a', 'a', 'a', 'b', 'b', 'c'], id, seeded(seed)))).toBe(true)
  })

  it('covers the whole pool, then gives the extra turns to weak items', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = weightedRound(pool, 10, (x) => (x === 'F' ? 4 : 1), id, seeded(seed))
      expect(r).toHaveLength(10)
      expect(new Set(r).size).toBe(6)
      expect(noRepeats(r)).toBe(true)
      // Variety: no chord more than three times.
      expect(Math.max(...Object.values(counts(r)))).toBeLessThanOrEqual(3)
    }
    let f = 0
    for (let seed = 1; seed < 200; seed++) f += counts(weightedRound(pool, 10, (x) => (x === 'F' ? 4 : 1), id, seeded(seed))).F
    // Once for coverage plus most of the four extra turns' share: well above the 10/6 an even round gives it.
    expect(f / 199).toBeGreaterThan(2.2)
  })

  it('lets weak items in more often when the pool is bigger than the round', () => {
    const big = Array.from({ length: 24 }, (_, i) => `k${i}`)
    let hits = 0
    for (let seed = 1; seed < 200; seed++) if (weightedRound(big, 10, (x) => (x === 'k3' ? 4 : 1), id, seeded(seed)).includes('k3')) hits++
    // 10 of 24 is ~42% for an even pick.
    expect(hits / 199).toBeGreaterThan(0.7)
  })

  it('builds a drill mostly from what you missed', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = drillRound(['F', 'Am'], pool, 10, () => 1, id, seeded(seed))
      expect(r).toHaveLength(10)
      const c = counts(r)
      expect(c.F + c.Am).toBe(6)
      expect(c.F).toBe(3)
      expect(noRepeats(r)).toBe(true)
    }
    // Many misses: each at least once.
    const many = drillRound(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'C', 'Dm'], pool, 10, () => 1, id, seeded(3))
    expect(new Set(many).size).toBe(6)
    // Nothing missed: a normal round.
    expect(drillRound([], pool, 10, () => 1, id, seeded(3))).toHaveLength(10)
  })

  it('can allow repeats, so a two-answer drill doesn’t simply alternate', () => {
    const runs = Array.from({ length: 30 }, (_, s) => drillRound(['min'], ['maj', 'min'], 10, () => 1, id, seeded(s + 1), true))
    for (const r of runs) expect(counts(r).min).toBe(6)
    expect(runs.some((r) => !noRepeats(r))).toBe(true)
  })

  it('weights a stream of draws toward the missed items', () => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5']
    const w = drillWeight(notes, () => 1, (n) => n === 'F4' || n === 'A4')
    const rng = seeded(8)
    const draws = Array.from({ length: 5000 }, () => weightedPick(notes, w, rng))
    const c = counts(draws)
    expect((c.F4 + c.A4) / 5000).toBeCloseTo(0.6, 1)
  })
})
