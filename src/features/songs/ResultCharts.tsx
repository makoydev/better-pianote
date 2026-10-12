import type { Song } from '../../content/songs'
import { barTitle } from './bars'
import type { RunRecord } from './history'

/**
 * Where the slips were (a strip with a column per bar) and how your recent runs went (a sparkline). Colours and
 * sizes follow the app's dark surfaces: more is brighter, and taller too, so colour isn't the only clue.
 */

/** Slips in a bar → colour (one hue, brighter with more) and height. */
const SLIP_STEPS = [
  { fill: '#4b4a8a', height: 0.4 }, // none
  { fill: '#8f4769', height: 0.6 }, // one
  { fill: '#c65372', height: 0.8 }, // two
  { fill: '#ff5c7a', height: 1 }, // three or more
]
const NOT_PLAYED = { fill: '#282752', height: 0.14 }

/** A column per bar: how many slips were in it. The stretch worth practising is underlined. */
export function SlipStrip({ song, slips, played, worst }: { song: Song; slips: number[]; played: [number, number]; worst: [number, number] | null }) {
  const gap = slips.length > 48 ? 1 : 2
  const inPlay = (b: number) => b >= played[0] && b <= played[1]
  const summary = slips.flatMap((s, b) => (s > 0 ? [`${barTitle(song, b)}: ${s}`] : [])).join(', ')
  return (
    <div className="w-full">
      <div className="flex h-10 items-end" style={{ gap }} role="img" aria-label={`Wrong notes by bar. ${summary || 'None.'}`}>
        {slips.map((s, b) => {
          const step = inPlay(b) ? SLIP_STEPS[Math.min(3, s)] : NOT_PLAYED
          const note = inPlay(b) ? `${s} wrong note${s === 1 ? '' : 's'}` : 'not played'
          return (
            <span key={b} className="min-w-0 flex-1 rounded-t-[3px]" style={{ height: `${step.height * 100}%`, background: step.fill }} title={`${barTitle(song, b)}: ${note}`} />
          )
        })}
      </div>
      {/* The worst stretch, underlined in the loop's gold */}
      <div className="relative mt-1 h-1">
        {worst && (
          <span
            className="absolute inset-y-0 rounded-full bg-gold"
            style={{ left: `${(worst[0] / slips.length) * 100}%`, width: `${((worst[1] - worst[0] + 1) / slips.length) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs font-bold text-ink-mute">
        <span>{barTitle(song, 0)}</span>
        <span>{barTitle(song, slips.length - 1)}</span>
      </div>
    </div>
  )
}

const W = 400
const H = 64
const PAD = 8

/** Accuracy over your latest runs (oldest on the left), this run marked in gold. */
export function RunTrend({ runs }: { runs: RunRecord[] }) {
  const accs = runs.map((r) => r.accuracy)
  // Scale to the runs (at least 20 points tall), so a change shows without exaggerating a wobble at the top.
  const lo = Math.max(0, Math.min(80, Math.min(...accs) - 10))
  const pts = accs.map((a, i) => [PAD + (i * (W - 2 * PAD)) / Math.max(1, accs.length - 1), PAD + (1 - (a - lo) / (100 - lo)) * (H - 2 * PAD)] as const)
  const last = pts.length - 1
  const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full overflow-visible"
      role="img"
      aria-label={`Accuracy over your last ${runs.length} runs: ${accs.join('%, ')}%`}
    >
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="var(--color-ink-mute)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === last ? 6 : 4} fill={i === last ? 'var(--color-gold)' : 'var(--color-ink-mute)'} stroke="var(--color-night-850)" strokeWidth={2}>
          <title>{`${day(runs[i].at)}: ${runs[i].accuracy}% at ${runs[i].pct}% tempo`}</title>
        </circle>
      ))}
    </svg>
  )
}
