import { useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { ALL_LESSONS, findLesson } from '../../content'
import { audio } from '../../lib/audio/engine'
import { celebrate } from '../../lib/fx'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { LessonComplete, type Result } from './LessonComplete'
import { isFresh, loadResume, saveResume } from './resume'
import { stepLabel } from './stepText'
import { StepPlayer } from './StepPlayer'

function starsFor(mistakes: number) {
  return mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1
}

const total = (slips: Record<number, number>) => Object.values(slips).reduce((a, b) => a + b, 0)

type Found = NonNullable<ReturnType<typeof findLesson>>

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const found = findLesson(lessonId)
  if (!found) {
    return (
      <div className="min-h-dvh">
        <TopBar back="/learn" title="Lesson not found" />
        <div className="p-10 text-center text-ink-mute">This lesson doesn't exist (yet).</div>
      </div>
    )
  }
  return <LessonRun found={found} />
}

function LessonRun({ found }: { found: Found }) {
  const { lesson, unit } = found
  const pedal = lesson.pedalContinue !== false
  // Where you left off last time, if you didn't finish (read once, when the lesson opens).
  const [initial, setInitial] = useState(() => loadResume(lesson.id, lesson.steps.length))
  // Bumped to start a fresh run (Replay, Start over).
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  const restart = () => {
    saveResume(lesson.id, null)
    setInitial(null)
    setResult(null)
    setRun((r) => r + 1)
  }

  const finish = (slips: Record<number, number>, seconds: number) => {
    saveResume(lesson.id, null)
    const stars = starsFor(total(slips))
    const p = useProgress.getState()
    const unitWasDone = unit.lessons.every((l) => p.lessons[l.id])
    const { firstTime, improved } = p.completeLesson(lesson.id, stars)
    const doneNow = useProgress.getState().lessons
    const xp = firstTime ? 15 + stars * 5 : improved ? 10 : 5
    p.addXp(xp)
    // Up next: the following lesson if it's still to do, otherwise the first one you haven't finished.
    const upNext = found.next && !doneNow[found.next.id] ? found.next : (ALL_LESSONS.find((x) => !doneNow[x.lesson.id])?.lesson ?? null)
    setResult({
      stars,
      xp,
      seconds,
      slips: Object.entries(slips)
        .filter(([, n]) => n > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([k, n]) => ({ label: stepLabel(lesson.steps[Number(k)]), n })),
      unitDone: !unitWasDone && unit.lessons.every((l) => doneNow[l.id]) ? unit.title : null,
      next: upNext,
    })
    if (useSettings.getState().uiSounds) audio.ui('complete')
    celebrate()
  }

  if (result) return <LessonComplete result={result} unitColor={unit.color} onReplay={restart} pedal={pedal} />

  return (
    <StepPlayer
      key={run}
      steps={lesson.steps}
      title={lesson.title}
      icon={lesson.icon}
      color={unit.color}
      pedal={pedal}
      initial={initial}
      onProgress={(p) => saveResume(lesson.id, isFresh(p) ? null : p)}
      onStartOver={initial ? restart : undefined}
      onFinish={finish}
    />
  )
}
