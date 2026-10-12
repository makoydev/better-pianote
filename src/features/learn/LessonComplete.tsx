import { ArrowRight, Flame, Footprints, ListChecks, RotateCcw, Timer, Trophy, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { GoalProgress } from '../../components/ui/GoalProgress'
import { Stars } from '../../components/ui/progress'
import type { Lesson } from '../../content/types'
import { useHandsFree } from '../../hooks/useHandsFree'
import { burst } from '../../lib/fx'
import { go } from '../../router'
import { liveStreak, useProgress } from '../../state/progress'

export interface Result {
  stars: number
  xp: number
  seconds: number
  /** Steps you slipped on, in order. */
  slips: { label: string; n: number }[]
  /** Set when this lesson finished its unit for the first time. */
  unitDone: string | null
  next: Lesson | null
}

export function LessonComplete({ result, unitColor, onReplay, pedal }: { result: Result; unitColor: string; onReplay: () => void; pedal: boolean }) {
  const streak = useProgress(liveStreak)
  const mins = Math.floor(result.seconds / 60)
  const secs = result.seconds % 60
  const mistakes = result.slips.reduce((a, s) => a + s.n, 0)
  // Lesson → lesson replaces the history entry, so Back from the next lesson returns to where you started.
  const goNext = () => go(result.next ? `/learn/${result.next.id}` : '/learn', { replace: true })

  // A unit is a big moment: an extra burst of confetti after the usual one.
  useEffect(() => {
    if (!result.unitDone) return
    const id = window.setTimeout(() => burst(null, { count: 120, spread: 120 }), 900)
    return () => window.clearTimeout(id)
  }, [result.unitDone])

  // Enter, a pedal tap or the top C go on to the next lesson (not straight away, so the input that finished the
  // lesson doesn't skip this screen).
  useHandsFree(goNext, { pedal, delay: 800 })

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
      <GoalProgress className="mt-3" />
      {mistakes === 0 ? (
        <p className="mt-3 text-sm text-ink-mute">No slips!</p>
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
        <Button variant="ghost" size="md" onClick={() => go('/learn', { replace: true })} className="mt-2">
          All lessons
        </Button>
      )}
    </div>
  )
}
