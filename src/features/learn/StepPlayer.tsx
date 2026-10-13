import { ArrowLeft, ArrowRight, RotateCcw, SkipForward } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { Icon, type IconName } from '../../components/ui/Icon'
import { ProgressBar } from '../../components/ui/progress'
import type { Step } from '../../content/types'
import { useHandsFree } from '../../hooks/useHandsFree'
import { isPlainKey, isTypingTarget } from '../../lib/focus'
import { stopDemos } from '../../lib/audio/play'
import { useLive } from '../../state/live'
import type { Resume } from './resume'
import { stepLabel } from './stepText'
import { ExplainStepView, WidgetStepView } from './steps/ExplainStepView'
import { PlayStepView } from './steps/PlayStepView'
import { QuizStepView } from './steps/QuizStepView'

const needsAnswer = (s: Step) => s.kind === 'play' || s.kind === 'quiz'

export interface StepPlayerProps {
  steps: Step[]
  title: string
  icon: IconName
  color: string
  /** Tap the sustain pedal to continue (off for the lesson about the pedal itself). */
  pedal?: boolean
  /** Reviewing a finished lesson: Continue always works, a strip jumps to any step, and nothing is counted. */
  browse?: boolean
  /** Shown after the title for each step (the lesson a quick-review question comes from). */
  sources?: string[]
  /** Where to pick up (an unfinished lesson you're coming back to). */
  initial?: Resume | null
  /** Called as you go, so your place can be remembered. */
  onProgress?: (p: Resume) => void
  /** Offered in the footer while you're still on the step you came back to. */
  onStartOver?: () => void
  /** Runs once, after the last step, with the slips per step, the seconds it took and the steps you answered. */
  onFinish: (slips: Record<number, number>, seconds: number, solved: number[]) => void
}

/** Plays a list of lesson steps: the header, each step in turn, Back / Skip / Continue. */
export function StepPlayer({ steps, title, icon, color, pedal = true, browse = false, sources, initial, onProgress, onStartOver, onFinish }: StepPlayerProps) {
  const [i, setI] = useState(initial?.step ?? 0)
  const [dir, setDir] = useState(1)
  const [solved, setSolved] = useState<Record<number, boolean>>(() => Object.fromEntries((initial?.solved ?? []).map((k) => [k, true])))
  // Slips per step (wrong notes and answers, skips, a first "Show me"), listed on the complete screen.
  const [slips, setSlips] = useState<Record<number, number>>(() => ({ ...initial?.slips }))
  // The play step you just solved moves on by itself; going back to it later doesn't bounce you forward.
  const [justSolved, setJustSolved] = useState<number | null>(null)
  // Bumped to restart a solved play step ("Play it again").
  const [attempt, setAttempt] = useState(0)
  // "Back where you left off" stays until you move to another step.
  const [resumed, setResumed] = useState(!!initial)
  // onFinish runs once per run through the steps.
  const done = useRef(false)
  // When this run started, counting the time already spent before you left.
  const spentBefore = useRef(initial?.secs ?? 0)
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now() - spentBefore.current * 1000
  }, [])
  const midiReady = useLive((s) => s.midi === 'ready' && s.midiDevices.length > 0)
  const elapsed = () => Math.round((Date.now() - started.current) / 1000)

  const step = steps[i]
  const canContinue = browse || !needsAnswer(step) || !!solved[i]
  const answered = () => Object.keys(solved).map(Number).filter((k) => solved[k])

  // Remember your place as you go, and once more when you leave (or the iPad puts the app away), so the time spent
  // on the last step counts too.
  const report = useEffectEvent(() => {
    if (!done.current) onProgress?.({ step: i, solved: answered(), slips, secs: elapsed(), of: steps.length })
  })
  useEffect(() => report(), [i, solved, slips])
  // A demo from one step ("Show me", a listen clip) stops when you move to another.
  useEffect(() => () => stopDemos(), [i])
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') report()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      report()
    }
  }, [])

  const finish = (slipsNow: Record<number, number>) => {
    if (done.current) return
    done.current = true
    onFinish(slipsNow, elapsed(), answered())
  }
  const goTo = (k: number) => {
    setJustSolved(null)
    setResumed(false)
    setDir(k > i ? 1 : -1)
    setI(k)
  }
  const advance = (slipsNow = slips) => {
    if (i < steps.length - 1) goTo(i + 1)
    else finish(slipsNow)
  }
  const next = () => {
    if (canContinue) advance()
  }
  const back = () => {
    if (i > 0) goTo(i - 1)
  }
  const addSlips = (n: number) => {
    if (!browse) setSlips((s) => ({ ...s, [i]: (s[i] ?? 0) + n }))
  }
  const skip = () => {
    const slipsNow = { ...slips, [i]: (slips[i] ?? 0) + 2 }
    setSlips(slipsNow)
    advance(slipsNow)
  }
  const retry = () => {
    setSolved((s) => ({ ...s, [i]: false }))
    setAttempt((a) => a + 1)
  }

  // A play step you just got right moves on by itself a moment later.
  const autoNext = useEffectEvent(() => next())
  useEffect(() => {
    if (justSolved !== i) return
    const id = window.setTimeout(autoNext, 1500)
    return () => window.clearTimeout(id)
  }, [justSolved, i])

  // → to continue, ← to go back. Keys inside widgets, sliders and focused buttons stay theirs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e) || isTypingTarget(e.target)) return
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // Enter, a quick pedal tap or the top C continue, so your hands stay on the keys (no delay: steps are quick).
  // The top C stays a note where notes go somewhere: widgets (the keyboard map shows C7, the interval lab picks
  // any note), and in a review, where Continue is always on, a question still waiting for its answer.
  const notesUsed = step.kind === 'widget' || (step.kind === 'explain' && !!step.visual?.widget) || (browse && needsAnswer(step) && !solved[i])
  useHandsFree(canContinue ? next : null, { pedal, delay: 0, topC: !notesUsed })

  const progress = (i + (canContinue ? 1 : 0)) / steps.length
  const onSolved = () => {
    setSolved((s) => ({ ...s, [i]: true }))
    // A step played in time stays put, so you can see how each note went (and play it again for a better run).
    if (step.kind === 'play' && !step.timed) setJustSolved(i)
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        back="/learn"
        center={
          <div className="min-w-0 flex-1 px-1">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-extrabold">
              <span className="flex min-w-0 items-center gap-2 truncate" style={{ color }}>
                <Icon name={icon} size={18} />
                <span className="truncate">
                  {title}
                  {sources?.[i] && <span className="text-ink-mute"> · {sources[i]}</span>}
                </span>
              </span>
              <span className="shrink-0 text-ink-mute">
                {i + 1} / {steps.length}
              </span>
            </div>
            <ProgressBar value={progress} color={color} height={12} />
          </div>
        }
      />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-5 pt-5 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={i}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-full flex-1 flex-col"
          >
            <FocusHeading />
            {step.kind === 'explain' && <ExplainStepView step={step} />}
            {step.kind === 'widget' && <WidgetStepView step={step} />}
            {step.kind === 'play' && (
              <PlayStepView
                key={attempt}
                step={step}
                solved={!!solved[i]}
                onSolved={onSolved}
                onMistake={addSlips}
                onRetry={solved[i] && justSolved !== i ? retry : undefined}
                handsFree={!canContinue}
              />
            )}
            {step.kind === 'quiz' && <QuizStepView step={step} solved={!!solved[i]} onSolved={onSolved} onMistake={() => addSlips(1)} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="shrink-0 border-t border-white/6 bg-night-900/90 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {browse && <StepStrip steps={steps} at={i} solved={solved} onPick={(k) => k !== i && goTo(k)} />}
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="md" icon={ArrowLeft} onClick={back} disabled={i === 0}>
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center text-sm font-semibold text-ink-mute">
            {resumed && onStartOver ? (
              <>
                <span className="hidden md:inline">Back where you left off.</span>
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onStartOver} aria-label="Start over">
                  <span className="hidden sm:inline">Start over</span>
                </Button>
              </>
            ) : browse ? (
              <span className="hidden md:inline">Reviewing: nothing is scored</span>
            ) : (
              canContinue && midiReady && pedal && <span className="hidden md:inline">Tip: tap your sustain pedal to continue</span>
            )}
          </div>
          {!browse && needsAnswer(step) && !solved[i] && (
            <Button variant="ghost" size="md" icon={SkipForward} onClick={skip} aria-label="Skip">
              <span className="hidden sm:inline">Skip</span>
            </Button>
          )}
          <Button size="lg" iconRight={ArrowRight} onClick={next} disabled={!canContinue} className="sm:min-w-44">
            {i < steps.length - 1 ? 'Continue' : browse ? 'Done' : 'Finish'}
          </Button>
        </div>
      </footer>
    </div>
  )
}

/** In a review: every step as a numbered button, to jump straight to it. */
function StepStrip({ steps, at, solved, onPick }: { steps: Step[]; at: number; solved: Record<number, boolean>; onPick: (k: number) => void }) {
  return (
    <nav aria-label="Steps" className="mx-auto mb-2.5 max-w-5xl overflow-x-auto scrollbar-none">
      <div className="mx-auto flex w-max gap-1.5">
        {steps.map((s, k) => (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            aria-label={`Step ${k + 1}: ${stepLabel(s)}`}
            aria-current={k === at ? 'step' : undefined}
            title={stepLabel(s)}
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-base font-extrabold transition-colors ${
              k === at
                ? 'border-gold bg-gold text-night-900'
                : solved[k]
                  ? 'border-good/40 bg-good/10 text-good'
                  : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
            }`}
          >
            {k + 1}
          </button>
        ))}
      </div>
    </nav>
  )
}

/** Screen readers follow along: a new step moves focus to its heading (the step views mark it data-step-heading). */
function FocusHeading() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    ref.current?.parentElement?.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true })
  }, [])
  return <span ref={ref} hidden />
}
