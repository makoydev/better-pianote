import { CheckCircle2, HelpCircle, Minus, Play, Plus, RotateCcw, Snail, Square, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { MusicText } from '../../../components/MusicText'
import { TimingStrip } from '../../../components/TimingStrip'
import { Button, IconButton } from '../../../components/ui/Button'
import type { PlayStep } from '../../../content/types'
import { MAX_BPM, MIN_BPM, type TimedStep } from './useTimedStep'

const COUNT_WORDS = ['', 'one click', 'two clicks', 'three clicks', 'four clicks', 'five clicks', 'six clicks']

/** One light per beat of the bar: the count-in counts up them, then the beat moves along. Beat 1 is bigger. */
function BeatLights({ meter, at, counting }: { meter: number; at: number | null; counting: boolean }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: meter }, (_, b) => {
        const lit = at !== null && (counting ? b <= at : b === at)
        return (
          <motion.span
            key={b}
            animate={{ scale: at === b ? [1.35, 1] : 1 }}
            transition={{ duration: 0.18 }}
            className={`flex items-center justify-center rounded-full font-display font-bold ${b === 0 ? 'size-9 text-lg' : 'size-7 text-sm'} ${
              lit ? 'bg-gold text-night-900 shadow-[0_0_14px_#ffc857]' : 'bg-white/8 text-ink-mute'
            }`}
          >
            {counting ? b + 1 : ''}
          </motion.span>
        )
      })}
    </div>
  )
}

/**
 * What's happening (the count-in, the run, how it went) and the controls: Start, tempo, click, Show me. While a run
 * is on, only Stop. `compact` (a short screen) keeps it to one row, two after a run; there the staff's colours show
 * how each note went, so the squares are left out when there's a staff.
 */
export function TimedPanel({
  ts,
  step,
  solved,
  praise,
  onShowMe,
  extra,
  compact,
}: {
  ts: TimedStep
  step: PlayStep
  solved: boolean
  /** Said when the step is solved and no run is showing. */
  praise: string
  onShowMe: () => void
  /** More controls for the row (the mic on a short screen). */
  extra?: ReactNode
  compact: boolean
}) {
  const { timed, bpm, setBpm, click, setClick, report, fails, nudge, names, meter } = ts
  const run = timed.run
  const live = timed.running
  const counting = run?.phase === 'count'
  const slower = Math.max(MIN_BPM, bpm - 8)
  const again = !!report && !report.passed

  if (run && live) {
    const lights = <BeatLights meter={meter} at={counting ? run.count - 1 : run.beat} counting={counting} />
    const now = run.demo ? (
      <span className="font-extrabold text-ink-soft">Listen…</span>
    ) : counting ? (
      <span className="font-extrabold text-ink-soft">Get ready…</span>
    ) : (
      <TimingStrip results={run.results} step={run.step} names={names} inTime={run.inTime} />
    )
    const stop = (
      <Button size="sm" variant="secondary" icon={Square} onClick={timed.stop}>
        Stop
      </Button>
    )
    return compact ? (
      <Row live>
        {stop}
        {lights}
        {now}
      </Row>
    ) : (
      <div className="flex w-full flex-col items-center gap-2">
        <Row live>
          {lights}
          {now}
        </Row>
        <Row>{stop}</Row>
      </div>
    )
  }

  const controls = (withExtra = true) => (
    <>
      {/* Played before starting: Start pulses (a short screen has no room for the words). */}
      <Button
        size="sm"
        icon={again || solved || report ? RotateCcw : Play}
        onClick={() => ts.start()}
        animate={nudge ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={nudge ? { repeat: Infinity, duration: 1.1 } : undefined}
      >
        {again ? 'Try again' : solved || report ? 'Play it again' : 'Start'}
      </Button>
      {again && fails >= 2 && slower < bpm && (
        <Button size="sm" variant="secondary" icon={Snail} onClick={() => ts.start(slower)}>
          Slower ({slower} BPM)
        </Button>
      )}
      <div className="flex items-center gap-1.5" role="group" aria-label="Tempo">
        <IconButton icon={Minus} label="Slower" size={44} disabled={bpm <= MIN_BPM} onClick={() => setBpm(Math.max(MIN_BPM, bpm - 4))} />
        <span className="min-w-20 text-center font-extrabold tabular-nums">
          {bpm} <span className="text-sm text-ink-mute">BPM</span>
        </span>
        <IconButton icon={Plus} label="Faster" size={44} disabled={bpm >= MAX_BPM} onClick={() => setBpm(Math.min(MAX_BPM, bpm + 4))} />
      </div>
      <Button size="sm" variant="ghost" icon={click ? Volume2 : VolumeX} aria-pressed={click} onClick={() => setClick(!click)}>
        Click {click ? 'on' : 'off'}
      </Button>
      <Button size="sm" variant="ghost" icon={HelpCircle} onClick={onShowMe}>
        Show me
      </Button>
      {withExtra && extra}
    </>
  )

  if (run?.phase === 'done' && report) {
    const title = (
      <span className={`flex items-center gap-2 font-display font-bold ${compact ? 'text-xl' : 'text-2xl'} ${report.passed ? 'text-good' : 'text-coral'}`}>
        {report.passed && <CheckCircle2 size={compact ? 22 : 24} />}
        {report.title}
      </span>
    )
    const strip = (!compact || !step.staff) && <TimingStrip results={run.results} step={null} names={names} inTime={run.inTime} short={report.short} />
    const words = (report.detail || report.tip || (report.passed && step.success)) && (
      <p className="text-center text-sm font-bold leading-snug text-ink-soft">
        {report.passed && step.success && <MusicText text={step.success} />} {report.detail}
        {report.tip && <span className="text-gold"> {report.tip}</span>}
      </p>
    )
    // A short screen keeps the mic's corner for before and during a run, so the result fits in two rows.
    return compact ? (
      <div className="flex w-full flex-col items-center gap-1" aria-live="polite">
        <Row>
          {title}
          {strip}
          {controls(false)}
        </Row>
        {words}
      </div>
    ) : (
      <div className="flex w-full flex-col items-center gap-2" aria-live="polite">
        <Row>
          {title}
          {strip}
        </Row>
        {words}
        <Row>{controls()}</Row>
      </div>
    )
  }

  // Solved: the step's own line, or on a short screen a word of praise, so it shares the row with the controls.
  const said = solved ? (
    <span className={`flex items-center gap-2 font-extrabold text-good ${compact ? 'text-lg' : 'text-xl'}`}>
      <CheckCircle2 size={compact ? 22 : 26} /> {compact ? praise : (step.success ?? praise)}
    </span>
  ) : compact ? (
    nudge && (
      <span role="status" className="sr-only">
        Press Start (or Enter, or tap the pedal) to play it in time.
      </span>
    )
  ) : nudge ? (
    <span className="text-lg font-bold text-gold">Press Start (or Enter, or tap the pedal) to play it in time.</span>
  ) : (
    <span className="text-lg font-bold text-ink-soft">Press Start: {COUNT_WORDS[meter] ?? `${meter} clicks`} count you in, then play along.</span>
  )
  return compact ? (
    <Row>
      {said}
      {controls()}
    </Row>
  ) : (
    <div className="flex w-full flex-col items-center gap-2">
      <Row>{said}</Row>
      <Row>{controls()}</Row>
    </div>
  )
}

function Row({ live, children }: { live?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-11 w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center" aria-live={live ? 'polite' : undefined}>
      {children}
    </div>
  )
}
