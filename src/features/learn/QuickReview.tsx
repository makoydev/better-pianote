import { ArrowRight, Repeat } from 'lucide-react'
import { useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { ALL_LESSONS } from '../../content'
import { audio } from '../../lib/audio/engine'
import { burst } from '../../lib/fx'
import { go } from '../../router'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { LessonComplete, type Result } from './LessonComplete'
import { REVIEW_XP, buildReview } from './review'
import { stepLabel } from './stepText'
import { StepPlayer } from './StepPlayer'

const GOLD = '#ffc857'

/**
 * A quick mixed review (#/learn/review): questions and play steps from lessons you've finished, run like a
 * lesson. It earns a little XP but isn't a lesson of its own, so nothing is saved for it.
 */
export function QuickReview() {
  const [items, setItems] = useState(() => buildReview(useProgress.getState().lessons))
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  const again = () => {
    setItems(buildReview(useProgress.getState().lessons))
    setResult(null)
    setRun((r) => r + 1)
  }

  const finish = (slips: Record<number, number>, seconds: number, solved: number[]) => {
    // Nothing answered (all skipped) earns nothing.
    const xp = solved.length > 0 ? REVIEW_XP : 0
    if (xp) useProgress.getState().addXp(xp)
    const done = useProgress.getState().lessons
    setResult({
      stars: null,
      xp,
      seconds,
      slips: Object.entries(slips)
        .filter(([, n]) => n > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([k, n]) => ({ label: `${items[Number(k)].lesson.title}: ${stepLabel(items[Number(k)].step)}`, n })),
      unitDone: null,
      next: ALL_LESSONS.find((x) => !done[x.lesson.id])?.lesson ?? null,
      firstTry: { right: items.filter((_, k) => solved.includes(k) && !slips[k]).length, of: items.length },
    })
    if (useSettings.getState().uiSounds) audio.ui('complete')
    burst(null, { count: 80 })
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar back="/learn" title="Quick review" />
        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 text-center">
          <Repeat size={48} className="text-gold" />
          <p className="max-w-md text-lg text-ink-soft">Finish a lesson first: a quick review mixes questions from the lessons you’ve done.</p>
          <Button iconRight={ArrowRight} onClick={() => go('/learn', { replace: true })}>
            To the lessons
          </Button>
        </main>
      </div>
    )
  }

  if (result) return <LessonComplete result={result} unitColor={GOLD} onReplay={again} replayLabel="Another review" pedal />

  return (
    <StepPlayer
      key={run}
      steps={items.map((x) => x.step)}
      title="Quick review"
      icon="repeat"
      color={GOLD}
      sources={items.map((x) => x.lesson.title)}
      onFinish={finish}
    />
  )
}
