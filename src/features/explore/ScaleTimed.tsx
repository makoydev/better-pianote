import { type LucideIcon, ArrowLeft, ArrowRight, Check, Hand, Minus, RotateCcw, Trophy, X } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '../../components/ui/Button'
import { timingTendency } from '../practice/logic/rhythm'
import type { StepResult, Verdict } from './scaleTiming'
import type { RunSummary } from './useTimedRun'

const LOOK: Record<Verdict, { icon: LucideIcon; cls: string; word: string }> = {
  perfect: { icon: Check, cls: 'bg-good text-night-900', word: 'right on the beat' },
  good: { icon: Check, cls: 'bg-good/70 text-night-900', word: 'on the beat' },
  early: { icon: ArrowLeft, cls: 'bg-gold text-night-900', word: 'early' },
  late: { icon: ArrowRight, cls: 'bg-gold text-night-900', word: 'late' },
  wrong: { icon: X, cls: 'bg-bad text-white', word: 'a wrong note' },
  miss: { icon: Minus, cls: 'bg-white/12 text-ink-soft', word: 'missed' },
  oneHand: { icon: Hand, cls: 'bg-white/12 text-ink-soft', word: 'one hand only' },
}

/** One square per note: ✓ on the beat, ← early, → late, ✕ a wrong note, – missed. The note being played is outlined. */
export function TimingStrip({ results, step, names }: { results: StepResult[]; step: number | null; names: string[] }) {
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="How each note went">
      {results.map((r, k) => {
        const look = r.verdict ? LOOK[r.verdict] : null
        const ms = r.error === null ? '' : ` by ${Math.abs(Math.round(r.error * 1000))} ms`
        const said = look ? `${look.word}${r.verdict === 'early' || r.verdict === 'late' ? ms : ''}` : 'to come'
        return (
          <motion.span
            key={k}
            role="listitem"
            title={`${names[k]}: ${said}`}
            aria-label={`${names[k]}: ${said}`}
            initial={false}
            animate={{ scale: look ? [1.25, 1] : 1 }}
            className={`flex size-7 items-center justify-center rounded-md ${look ? look.cls : k === step ? 'border-2 border-gold bg-gold/10' : 'bg-white/6'}`}
          >
            {look && <look.icon size={16} strokeWidth={3} aria-hidden />}
          </motion.span>
        )
      })}
    </div>
  )
}

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
