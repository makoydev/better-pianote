import { ArrowLeft, ArrowRight, Flame, Footprints, ListChecks, RotateCcw, SkipForward, Timer, Trophy, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ProgressBar, Stars } from '../../components/ui/progress'
import { ALL_LESSONS, findLesson } from '../../content'
import type { Lesson, Step } from '../../content/types'
import { audio } from '../../lib/audio/engine'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { burst, celebrate } from '../../lib/fx'
import { heldNow, recentNotes } from '../../lib/input/bus'
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

const total = (slips: Record<number, number>) => Object.values(slips).reduce((a, b) => a + b, 0)

/** A step's heading as plain text (markup stripped), for the list of slips. */
function stepLabel(s: Step): string {
  const raw = s.kind === 'quiz' ? s.question : s.kind === 'play' ? (s.title ?? s.prompt) : s.title
  const text = raw
    .replace(/\[\[([^\]]+)\]\]|\{\{([^}]+)\}\}/g, (_, a: string | undefined, b: string | undefined) => a ?? b ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*+/g, '')
    .trim()
  return text.length > 70 ? `${text.slice(0, 68)}…` : text
}

interface Result {
  stars: number
  xp: number
  seconds: number
  /** Steps you slipped on, in order. */
  slips: { label: string; n: number }[]
  /** Set when this lesson finished its unit for the first time. */
  unitDone: string | null
  next: Lesson | null
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const found = findLesson(lessonId)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [solved, setSolved] = useState<Record<number, boolean>>({})
  // Slips per step (wrong notes and answers, skips, a first "Show me"), listed on the complete screen.
  const [slips, setSlips] = useState<Record<number, number>>({})
  // The play step you just solved moves on by itself; going back to it later doesn't bounce you forward.
  const [justSolved, setJustSolved] = useState<number | null>(null)
  // Bumped to restart a solved play step ("Play it again").
  const [attempt, setAttempt] = useState(0)
  const [finished, setFinished] = useState<Result | null>(null)
  // finish() runs once per run through the lesson.
  const done = useRef(false)
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
  }, [])
  const sustain = useLive((s) => s.sustain)
  const midiReady = useLive((s) => s.midi === 'ready' && s.midiDevices.length > 0)

  const lesson = found?.lesson
  const step = lesson?.steps[i]
  const canContinue = !!step && (!needsAnswer(step) || !!solved[i])
  const pedalContinue = lesson?.pedalContinue !== false

  const advance = (slipsNow = slips) => {
    if (!lesson) return
    setJustSolved(null)
    if (i < lesson.steps.length - 1) {
      setDir(1)
      setI(i + 1)
    } else finish(slipsNow)
  }
  const next = () => {
    if (canContinue) advance()
  }
  const back = () => {
    if (i === 0) return
    setJustSolved(null)
    setDir(-1)
    setI(i - 1)
  }
  const addSlips = (n: number) => setSlips((s) => ({ ...s, [i]: (s[i] ?? 0) + n }))
  const skip = () => {
    const slipsNow = { ...slips, [i]: (slips[i] ?? 0) + 2 }
    setSlips(slipsNow)
    advance(slipsNow)
  }
  const replay = () => {
    done.current = false
    setI(0)
    setDir(1)
    setSolved({})
    setSlips({})
    setJustSolved(null)
    setFinished(null)
    started.current = Date.now()
  }
  const retry = () => {
    setSolved((s) => ({ ...s, [i]: false }))
    setAttempt((a) => a + 1)
  }

  const finish = (slipsNow: Record<number, number>) => {
    if (!lesson || !found || done.current) return
    done.current = true
    const stars = starsFor(total(slipsNow))
    const p = useProgress.getState()
    const unitWasDone = found.unit.lessons.every((l) => p.lessons[l.id])
    const { firstTime, improved } = p.completeLesson(lesson.id, stars)
    const doneNow = useProgress.getState().lessons
    const xp = firstTime ? 15 + stars * 5 : improved ? 10 : 5
    p.addXp(xp)
    // Up next: the following lesson if it's still to do, otherwise the first one you haven't finished.
    const upNext = found.next && !doneNow[found.next.id] ? found.next : (ALL_LESSONS.find((x) => !doneNow[x.lesson.id])?.lesson ?? null)
    setFinished({
      stars,
      xp,
      seconds: Math.round((Date.now() - started.current) / 1000),
      slips: Object.entries(slipsNow)
        .filter(([, n]) => n > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([k, n]) => ({ label: stepLabel(lesson.steps[Number(k)]), n })),
      unitDone: !unitWasDone && found.unit.lessons.every((l) => doneNow[l.id]) ? found.unit.title : null,
      next: upNext,
    })
    if (useSettings.getState().uiSounds) audio.ui('complete')
    celebrate()
  }

  // A play step you just got right moves on by itself a moment later.
  const autoNext = useEffectEvent(() => next())
  useEffect(() => {
    if (finished || justSolved !== i) return
    const id = window.setTimeout(autoNext, 1500)
    return () => window.clearTimeout(id)
  }, [finished, justSolved, i])

  // Enter / → to continue, ← to go back. Keys inside widgets, sliders and focused buttons stay theirs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || !isPlainKey(e) || isTypingTarget(e.target)) return
      if (e.key === 'Enter' && !isButtonTarget(e.target)) next()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Tapping the sustain pedal continues, so your hands can stay on the keys. Only a deliberate tap counts
  // (pressed and released quickly with no keys down), so pedalling while you play never skips a step.
  const pedalDownAt = useRef<number | null>(null)
  const onPedal = useEffectEvent((down: boolean) => {
    if (!pedalContinue) return
    const now = performance.now()
    if (down) {
      pedalDownAt.current = heldNow().length === 0 && recentNotes(1200).length === 0 ? now : null
      return
    }
    const t0 = pedalDownAt.current
    pedalDownAt.current = null
    if (t0 === null || now - t0 > 600 || heldNow().length > 0 || recentNotes(now - t0 + 50).length > 0) return
    if (finished) {
      if (finished.next) go(`/learn/${finished.next.id}`)
    } else next()
  })
  const prevSustain = useRef(sustain)
  useEffect(() => {
    if (sustain !== prevSustain.current) onPedal(sustain)
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
    return <LessonComplete result={finished} unitColor={found.unit.color} onReplay={replay} />
  }

  const progress = (i + (canContinue ? 1 : 0)) / lesson.steps.length
  const onSolved = () => {
    setSolved((s) => ({ ...s, [i]: true }))
    if (step.kind === 'play') setJustSolved(i)
  }

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
              <PlayStepView
                key={attempt}
                step={step}
                solved={!!solved[i]}
                onSolved={onSolved}
                onMistake={addSlips}
                onRetry={solved[i] && justSolved !== i ? retry : undefined}
              />
            )}
            {step.kind === 'quiz' && <QuizStepView step={step} solved={!!solved[i]} onSolved={onSolved} onMistake={() => addSlips(1)} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="shrink-0 border-t border-white/6 bg-night-900/90 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="md" icon={ArrowLeft} onClick={back} disabled={i === 0}>
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex-1 text-center text-sm font-semibold text-ink-mute">
            {canContinue && midiReady && pedalContinue && <span className="hidden md:inline">Tip: tap your sustain pedal to continue</span>}
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

function LessonComplete({ result, unitColor, onReplay }: { result: Result; unitColor: string; onReplay: () => void }) {
  const streak = useProgress(liveStreak)
  const mins = Math.floor(result.seconds / 60)
  const secs = result.seconds % 60
  const mistakes = result.slips.reduce((a, s) => a + s.n, 0)
  const goNext = () => go(result.next ? `/learn/${result.next.id}` : '/learn')

  // A unit is a big moment: an extra burst of confetti after the usual one.
  useEffect(() => {
    if (!result.unitDone) return
    const id = window.setTimeout(() => burst(null, { count: 120, spread: 120 }), 900)
    return () => window.clearTimeout(id)
  }, [result.unitDone])

  // Enter goes on to the next lesson (after a moment, so the Enter that finished the lesson doesn't skip this).
  const shownAt = useRef(0)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [])
  const onEnter = useEffectEvent(() => goNext())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !isPlainKey(e) || isButtonTarget(e.target) || performance.now() - shownAt.current < 800) return
      onEnter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        {result.unitDone && (
          <div
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-5 py-2 text-lg font-extrabold text-night-900 shadow-[0_10px_30px_-8px_rgba(255,200,87,.7)]"
            style={{ background: `linear-gradient(120deg, ${unitColor}, #ffc857)` }}
          >
            <Trophy size={22} /> Unit complete: {result.unitDone}!
          </div>
        )}
        <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-[1.75rem] shadow-[0_20px_60px_-15px_rgba(255,200,87,.6)]" style={{ background: `linear-gradient(140deg, ${unitColor}, #ff8a6b)` }}>
          <Footprints size={48} className="text-night-900" />
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
        className="mt-6 grid w-full max-w-xl grid-cols-3 gap-3"
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
      {mistakes === 0 ? (
        <p className="mt-4 text-sm text-ink-mute">No slips!</p>
      ) : (
        <div className="glass mt-3 w-full max-w-xl rounded-2xl px-4 py-3 text-left">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-extrabold text-ink-soft">
            <ListChecks size={18} /> {mistakes} slip{mistakes === 1 ? '' : 's'} along the way
          </div>
          <ul className="space-y-1 text-sm text-ink-mute">
            {result.slips.slice(0, 3).map((s) => (
              <li key={s.label} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{s.label}</span>
                <span className="shrink-0 font-bold">×{s.n}</span>
              </li>
            ))}
            {result.slips.length > 3 && <li>…and {result.slips.length - 3} more</li>}
          </ul>
        </div>
      )}
      <div className="mt-6 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
        <Button variant="secondary" icon={RotateCcw} onClick={onReplay} className="sm:flex-1">
          Replay
        </Button>
        <Button iconRight={ArrowRight} onClick={goNext} className="sm:flex-[2]">
          {result.next ? `Next: ${result.next.title}` : 'Back to the path'}
        </Button>
      </div>
      {result.next && (
        <Button variant="ghost" size="md" onClick={() => go('/learn')} className="mt-2">
          All lessons
        </Button>
      )}
    </div>
  )
}
