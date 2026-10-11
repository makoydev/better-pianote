import { shuffle } from '../practice/logic/chords'

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }

/** "3", "60", "2½ beats", "½ beat", "1 (the thumb)" → 3, 60, 2.5, 0.5, 1. Anything else → null. */
export function numberValue(s: string): number | null {
  const m = /^(\d+)?([½¼¾])?(?=\s|$)/.exec(s.trim())
  if (!m || (!m[1] && !m[2])) return null
  return (m[1] ? Number(m[1]) : 0) + (m[2] ? FRACTIONS[m[2]] : 0)
}

/**
 * The order to show a quiz's options in, as indices into `options`. Shuffled, so the right answer isn't always
 * in the same place; two-option questions (Major / Minor) and `ordered` ones keep their written order, and
 * all-number options are shown smallest first.
 */
export function optionOrder(options: string[], ordered = false, rng: () => number = Math.random): number[] {
  const idx = options.map((_, i) => i)
  if (ordered || options.length <= 2) return idx
  const values = options.map(numberValue)
  if (values.every((v) => v !== null)) return idx.sort((a, b) => values[a]! - values[b]!)
  return shuffle(idx, rng)
}
