import { Eye, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Stars } from '../../components/ui/progress'
import type { Lesson, Unit } from '../../content/types'
import { useHandsFree } from '../../hooks/useHandsFree'

/** Opening a lesson you've finished: play it again for stars, or review it (browse every step, nothing scored). */
export function LessonIntro({
  lesson,
  unit,
  stars,
  onReplay,
  onReview,
  pedal,
}: {
  lesson: Lesson
  unit: Unit
  stars: number
  onReplay: () => void
  onReview: () => void
  pedal: boolean
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])
  // Enter, a pedal tap or the top C start the replay.
  useHandsFree(onReplay, { pedal })

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/learn" title={unit.title} />
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div
            className="mx-auto mb-4 flex size-24 items-center justify-center rounded-[1.75rem] text-night-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,.6)]"
            style={{ background: `linear-gradient(140deg, ${unit.color}, ${unit.color}aa)` }}
          >
            <Icon name={lesson.icon} size={48} />
          </div>
          <h1 ref={heading} tabIndex={-1} className="font-display text-4xl font-bold leading-tight outline-none sm:text-5xl">
            {lesson.title}
          </h1>
          <p className="mt-2 text-lg text-ink-soft">{lesson.subtitle}</p>
          <div className="mt-4 flex items-center justify-center gap-2.5 font-bold text-ink-mute">
            You’ve finished this one <Stars value={stars} size={24} />
          </div>
        </motion.div>
        <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <Button icon={RotateCcw} onClick={onReplay} className="sm:flex-1">
            {stars < 3 ? 'Replay for stars' : 'Replay'}
          </Button>
          <Button variant="secondary" icon={Eye} onClick={onReview} className="sm:flex-1">
            Review
          </Button>
        </div>
        <p className="mt-3 max-w-md text-sm text-ink-mute">Review: look through every step and jump to any of them. Nothing is scored.</p>
      </main>
    </div>
  )
}
