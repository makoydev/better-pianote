import { type ScoreInput, type ScoreLayout, type ScoreOptions, layoutScore } from '../../components/staff/score'

/**
 * Using the screen: the music in lines (systems) that fill the width when there's room for two or more, one long
 * scrolling line when there isn't, and a keyboard sized to its keys.
 */

export type ScoreSize = 'S' | 'M' | 'L'
export const SCORE_SIZES: readonly ScoreSize[] = ['S', 'M', 'L']

/**
 * Staff space in px for each size; two staves are drawn a little smaller so a grand staff fits. Small is about
 * the size of printed music, and lets two lines of both hands fit on an iPad held upright.
 */
export const staffSpace = (size: ScoreSize, grand: boolean) => ({ S: 12, M: 16, L: 20 })[size] * (grand ? 0.85 : 1)

/** One line of music: bars `from`…`to` (inclusive), laid out. */
export interface ScoreLine {
  from: number
  to: number
  layout: ScoreLayout
}

/** Spacing for a line, loosest first: natural, then squeezed as engravers do (never closer than the notes allow). */
const SPACINGS = [1, 0.9, 0.8, 0.7]

/**
 * Lay `bars` bars of music out in lines no wider than `width`: whole bars, as many as fit with the spacing squeezed
 * (at least one a line). Each line then takes the loosest spacing it fits with and is spread out to fill the width,
 * except a short last line. `inputFor` gives the score of a range of bars.
 */
export function layoutLines(inputFor: (from: number, to: number) => ScoreInput, bars: number, width: number, opts: ScoreOptions): ScoreLine[] {
  const tight = { ...opts, spacing: SPACINGS[SPACINGS.length - 1] }
  const full = layoutScore(inputFor(0, bars - 1), tight)
  const widths = full.barX.map((b) => b.x1 - b.x0)
  const head = full.contentStart + opts.sp
  const lines: ScoreLine[] = []
  for (let from = 0; from < widths.length; ) {
    let to = from
    let used = head + widths[from]
    while (to + 1 < widths.length && used + widths[to + 1] <= width) used += widths[++to]
    // That was an estimate (signatures move to the start of a line): drop bars while the real thing is too wide.
    let input = inputFor(from, to)
    let laid = layoutScore(input, tight)
    while (laid.width > width && to > from) {
      input = inputFor(from, --to)
      laid = layoutScore(input, tight)
    }
    let spacing = tight.spacing
    for (const s of SPACINGS.slice(0, -1)) {
      const l = layoutScore(input, { ...opts, spacing: s })
      if (l.width > width) continue
      laid = l
      spacing = s
      break
    }
    const spare = width - laid.width
    const last = to === widths.length - 1
    const spread = spare > 1 && laid.slots > 0 && (!last || laid.width > width * 0.7)
    lines.push({ from, to, layout: spread ? layoutScore(input, { ...opts, spacing, extraPerSlot: spare / laid.slots }) : laid })
    from = to + 1
  }
  return lines
}

/** How many lines fit in `height` px, each given the tallest line's room (1 means: use one scrolling line). */
export function linesThatFit(lines: ScoreLine[], height: number, max = 4): number {
  if (lines.length < 2) return 1
  const tallest = Math.max(...lines.map((l) => l.layout.height))
  return Math.max(1, Math.min(max, lines.length, Math.floor(height / tallest)))
}

/** The line at moment t (in beats). */
export function lineAt(lines: ScoreLine[], barOf: (t: number) => number, t: number): number {
  const bar = barOf(t)
  const i = lines.findIndex((l) => bar >= l.from && bar <= l.to)
  return i < 0 ? lines.length - 1 : i
}

/**
 * The line shown at the top. It stays put while you read down the lines shown, and when you reach the last one
 * it moves up to the top (so there's always a line ahead to read). A jump elsewhere (a loop going round) follows.
 */
export function topLine(top: number, cur: number, shown: number, total: number): number {
  let next = top
  if (cur < top || cur >= top + shown || (shown > 1 && cur === top + shown - 1)) next = cur
  return Math.max(0, Math.min(next, total - shown))
}

/** Below this width per white key the keyboard scrolls sideways (wide pieces get narrower keys first). */
export const MIN_KEY_WIDTH = 22

/**
 * A keyboard height that suits its keys (about 6½ times as long as they're wide), in at most a fifth of the screen.
 * `compact` (Focus view, where the music comes first): shorter keys, in about an eighth of the screen.
 */
export function keyboardHeight(width: number, whiteKeys: number, vh: number, grand: boolean, compact = false): number {
  const keyW = Math.max(MIN_KEY_WIDTH, whiteKeys > 0 && width > 0 ? width / whiteKeys : 40)
  if (compact) return Math.round(Math.max(80, Math.min(130, vh * 0.13, keyW * 4.5)))
  return Math.round(Math.max(110, Math.min(210, vh * (grand ? 0.18 : 0.21), keyW * 6.5)))
}
