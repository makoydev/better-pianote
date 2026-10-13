import { RotateCcw, Trophy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { timingTendency } from '../practice/logic/rhythm'
import type { RunSummary } from '../../hooks/useTimedRun'

/** How a run in time went, your best clean tempo, and Again. */
export function TimedResult({
  summary,
  bpm,
  best,
  newBest,
  onAgain,
}: {
  summary: RunSummary
  bpm: number
  /** The best clean tempo before this run, if any. */
  best: number | null
  newBest: boolean
  onAgain: () => void
}) {
  const tendency = timingTendency(summary.errors)
  const parts = [
    summary.early && `${summary.early} early`,
    summary.late && `${summary.late} late`,
    summary.wrong && `${summary.wrong} wrong`,
    summary.missed && `${summary.missed} missed`,
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" role="status">
      <div className="min-w-0">
        <div className={`flex items-center gap-2 font-display text-2xl font-bold ${summary.clean ? 'text-good' : ''}`}>
          {summary.clean && <Trophy size={22} />}
          {summary.clean ? `Clean, in time at ${bpm} BPM!` : `${summary.onTime} of ${summary.total} on the beat`}
        </div>
        <div className="text-sm font-bold text-ink-soft">
          {parts.length ? parts.join(' · ') : 'Every note within 90 ms of its click.'}
          {tendency && Math.abs(tendency.ms) > 10 && ` · ${tendency.text}`}
        </div>
        {newBest ? (
          <div className="mt-1 text-sm font-extrabold text-gold">
            New best clean tempo for this scale: {bpm} BPM{best !== null ? ` (was ${best})` : ''}. Try {Math.min(200, bpm + 4)} next.
          </div>
        ) : (
          best !== null && <div className="mt-1 text-sm font-bold text-ink-mute">Best clean tempo for this scale: {best} BPM.</div>
        )}
      </div>
      <Button size="sm" variant="secondary" icon={RotateCcw} onClick={onAgain}>
        Again
      </Button>
    </div>
  )
}
