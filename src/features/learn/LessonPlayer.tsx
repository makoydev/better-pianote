import { ArrowLeft, ArrowRight, Flame, Footprints, RotateCcw, SkipForward, Timer, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ProgressBar, Stars } from '../../components/ui/progress'
import { findLesson } from '../../content'
import type { Step } from '../../content/types'
import { audio } from '../../lib/audio/engine'
import { celebrate } from '../../lib/fx'
import { go } from '../../router'
import { useLive } from '../../state/live'
import { liveStreak, useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { ExplainStepView, WidgetStepView } from './steps/ExplainStepView'
import { PlayStepView } from './steps/PlayStepView'
import { QuizStepView } from './steps/QuizStepView'

const needsAnswer = (s: Step) => s.kind === 'play' || s.kind === 'quiz'

function starsFor(mistakes: number) {
  return mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const found = findLesson(lessonId)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [solved, setSolved] = useState<Record<number, boolean>>({})
  const [mistakes, setMistakes] = useState(0)
  const [finished, setFinished] = useState<null | { stars: number; xp: number; seconds: number }>(null)
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
  }, [])
  const sustain = useLive((s) => s.sustain)
  const midiReady = useLive((s) => s.midi === 'ready' && s.midiDevices.length > 0)

  const lesson = found?.lesson
  const step = lesson?.steps[i]
  const canContinue = !!step && (!needsAnswer(step) || !!solved[i])

  const advance = (extraMistakes = 0) => {
    if (!lesson) return
    if (i < lesson.steps.length - 1) {
      setDir(1)
      setI(i + 1)
    } else finish(mistakes + extraMistakes)
  }
  const next = () => {
    if (canContinue) advance()
  }
  const back = () => {
    if (i === 0) return
    setDir(-1)
    setI(i - 1)
  }
  const skip = () => {
    setMistakes((m) => m + 2)
    advance(2)
  }
  const replay = () => {
    setI(0)
    setDir(1)
    setSolved({})
    setMistakes(0)
    setFinished(null)
    started.current = Date.now()
  }

  const finish = (totalMistakes: number) => {
    if (!lesson) return
    const stars = starsFor(totalMistakes)
    const p = useProgress.getState()
    const { firstTime, improved } = p.completeLesson(lesson.id, stars)
    const xp = firstTime ? 15 + stars * 5 : improved ? 10 : 5
    p.addXp(xp)
    setFinished({ stars, xp, seconds: Math.round((Date.now() - started.current) / 1000) })
    if (useSettings.getState().uiSounds) audio.ui('complete')
    celebrate()
  }

  // Play steps move on by themselves a moment after you get them right.
  useEffect(() => {
    if (!step || step.kind !== 'play' || !solved[i]) return
    const id = window.setTimeout(next, 1500)
    return () => window.clearTimeout(id)
  })

  // Enter / → to continue, ← to go back. Tapping the sustain pedal also continues (hands stay on the keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const onPedalDown = useEffectEvent(() => {
    if (!finished) next()
  })
  const prevSustain = useRef(sustain)
  useEffect(() => {
    if (sustain && !prevSustain.current) onPedalDown()
    prevSustain.current = sustain
  }, [sustain])

  if (!found || !lesson || !step) {
    return (
      <div className="min-h-dvh">
        <TopBar back="/learn" title="Lesson not found" />
        <div className="p-10 text-center text-ink-mute">This lesson doesn't exist (yet).</div>
      </div>
    )
  }

  if (finished) {
    return (
      <LessonComplete
        result={finished}
        mistakes={mistakes}
        nextId={found.next?.id ?? null}
        nextTitle={found.next?.title ?? null}
        unitColor={found.unit.color}
        onReplay={replay}
      />
    )
  }

  const progress = (i + (canContinue ? 1 : 0)) / lesson.steps.length

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        back="/learn"
        center={
          <div className="min-w-0 flex-1 px-1">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-extrabold">
              <span className="flex min-w-0 items-center gap-2 truncate" style={{ color: found.unit.color }}>
                <Icon name={lesson.icon} size={18} /> <span className="truncate">{lesson.title}</span>
              </span>
              <span className="shrink-0 text-ink-mute">
                {i + 1} / {lesson.steps.length}
              </span>
            </div>
            <ProgressBar value={progress} color={found.unit.color} height={12} />
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
            {step.kind === 'explain' && <ExplainStepView step={step} />}
            {step.kind === 'widget' && <WidgetStepView step={step} />}
            {step.kind === 'play' && (
              <PlayStepView step={step} solved={!!solved[i]} onSolved={() => setSolved((s) => ({ ...s, [i]: true }))} onMistake={() => setMistakes((m) => m + 1)} />
            )}
            {step.kind === 'quiz' && (
              <QuizStepView step={step} solved={!!solved[i]} onSolved={() => setSolved((s) => ({ ...s, [i]: true }))} onMistake={() => setMistakes((m) => m + 1)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="shrink-0 border-t border-white/6 bg-night-900/90 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="md" icon={ArrowLeft} onClick={back} disabled={i === 0}>
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex-1 text-center text-sm font-semibold text-ink-mute">
            {canContinue && midiReady && <span className="hidden md:inline">Tip: tap your sustain pedal to continue</span>}
          </div>
          {needsAnswer(step) && !solved[i] && (
            <Button variant="ghost" size="md" icon={SkipForward} onClick={skip} aria-label="Skip">
              <span className="hidden sm:inline">Skip</span>
            </Button>
          )}
          <Button size="lg" iconRight={ArrowRight} onClick={next} disabled={!canContinue} className="sm:min-w-44">
            {i === lesson.steps.length - 1 ? 'Finish' : 'Continue'}
          </Button>
        </div>
      </footer>
    </div>
  )
}

function LessonComplete({
  result,
  mistakes,
  nextId,
  nextTitle,
  unitColor,
  onReplay,
}: {
  result: { stars: number; xp: number; seconds: number }
  mistakes: number
  nextId: string | null
  nextTitle: string | null
  unitColor: string
  onReplay: () => void
}) {
  const streak = useProgress(liveStreak)
  const mins = Math.floor(result.seconds / 60)
  const secs = result.seconds % 60
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        <div className="mx-auto mb-5 flex size-28 items-center justify-center rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(255,200,87,.6)]" style={{ background: `linear-gradient(140deg, ${unitColor}, #ff8a6b)` }}>
          <Footprints size={56} className="text-night-900" />
        </div>
        <h1 className="font-display text-5xl font-bold sm:text-6xl">Lesson complete!</h1>
        <div className="mt-5 flex justify-center">
          <Stars value={result.stars} size={52} animate />
        </div>
        <p className="mt-3 text-lg text-ink-soft">
          {result.stars === 3 ? 'Flawless. Your hands are learning fast.' : result.stars === 2 ? 'Great work! Replay any time for three stars.' : 'Done! Each replay makes it stick.'}
        </p>
      </motion.div>
      <motion.div
        className="mt-8 grid w-full max-w-xl grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.6 } } }}
      >
        {[
          { icon: Zap, label: 'XP earned', value: `+${result.xp}`, color: '#ffc857' },
          { icon: Flame, label: 'Day streak', value: String(streak), color: '#ff7b6b' },
          { icon: Timer, label: 'Time', value: `${mins}:${String(secs).padStart(2, '0')}`, color: '#5cc8ff' },
        ].map((s) => (
          <motion.div
            key={s.label}
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            className="glass rounded-2xl p-4"
          >
            <s.icon size={26} className="mx-auto" style={{ color: s.color }} />
            <div className="mt-1 text-2xl font-extrabold">{s.value}</div>
            <div className="text-sm font-bold text-ink-mute">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>
      <p className="mt-4 text-sm text-ink-mute">{mistakes === 0 ? 'No mistakes!' : `${mistakes} slip${mistakes === 1 ? '' : 's'} along the way`}</p>
      <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
        <Button variant="secondary" icon={RotateCcw} onClick={onReplay} className="sm:flex-1">
          Replay
        </Button>
        {nextId ? (
          <Button iconRight={ArrowRight} onClick={() => go(`/learn/${nextId}`)} className="sm:flex-[2]">
            Next: {nextTitle}
          </Button>
        ) : (
          <Button iconRight={ArrowRight} onClick={() => go('/learn')} className="sm:flex-[2]">
            Back to the path
          </Button>
        )}
      </div>
      <button type="button" onClick={() => go('/learn')} className="mt-4 text-sm font-bold text-ink-mute hover:text-ink">
        Back to all lessons
      </button>
    </div>
  )
}
