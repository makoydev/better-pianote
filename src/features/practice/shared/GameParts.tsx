import { ArrowLeft, Flame, type LucideIcon, Play, RotateCcw, SlidersHorizontal, Trophy, Zap } from 'lucide-react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { type ReactNode, useEffect } from 'react'
import { MusicText } from '../../../components/MusicText'
import { Button } from '../../../components/ui/Button'
import { IconTile } from '../../../components/ui/Card'
import { ProgressBar, Stars } from '../../../components/ui/progress'
import { go } from '../../../router'
import { useProgress } from '../../../state/progress'
import type { FinishResult } from './finish'

/** Page frame for a game: centred column under the top bar. */
export function GameMain({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto flex w-full flex-1 flex-col gap-5 px-3 pb-8 pt-4 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>{children}</main>
}

export interface LevelInfo {
  id: string
  name: string
  description: string
}

/** Intro + level picker + start button. */
export function SetupCard({
  icon,
  from,
  to,
  title,
  blurb,
  gameId,
  levels,
  level,
  onLevel,
  onStart,
  children,
  startLabel = 'Start',
}: {
  icon: LucideIcon
  from: string
  to: string
  title: string
  blurb: ReactNode
  gameId: string
  levels: LevelInfo[]
  level: string
  onLevel: (id: string) => void
  onStart: () => void
  children?: ReactNode
  startLabel?: string
}) {
  const games = useProgress((s) => s.games)
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-25 blur-3xl" style={{ background: from }} />
        <div className="relative flex items-start gap-4">
          <IconTile icon={icon} from={from} to={to} size={64} />
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
            <div className="mt-1.5 max-w-2xl text-lg leading-relaxed text-ink-soft">{blurb}</div>
          </div>
        </div>
      </div>
      {children}
      <div>
        <h3 className="mb-3 px-1 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Choose a level</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {levels.map((l, i) => {
            const active = l.id === level
            const best = games[`${gameId}:${l.id}`]?.best
            return (
              <motion.button
                key={l.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onLevel(l.id)}
                aria-pressed={active}
                className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                  active ? 'border-gold/70 bg-gold/12' : 'border-white/8 bg-night-800/80 hover:border-white/20'
                }`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${
                    active ? 'bg-gold text-night-900' : 'bg-night-700 text-ink-soft'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold leading-tight">
                    <MusicText text={l.name} />
                  </span>
                  <span className="block text-sm text-ink-mute">
                    <MusicText text={l.description} />
                  </span>
                </span>
                {best !== undefined && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-night-700 px-2.5 py-1 text-xs font-extrabold text-gold">
                    <Trophy size={13} /> {best}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
      <div className="flex justify-center pt-1">
        <Button size="xl" icon={Play} onClick={onStart} className="min-w-64">
          {startLabel}
        </Button>
      </div>
    </motion.section>
  )
}

/** Progress, score and streak along the top of a game. */
export function Hud({ step, total, score, streak, label = 'Question' }: { step: number; total: number; score: number; streak: number; label?: string }) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex justify-between text-sm font-extrabold text-ink-mute">
          <span>
            {label} {Math.min(step + 1, total)} of {total}
          </span>
        </div>
        <ProgressBar value={step / total} />
      </div>
      <AnimatePresence>
        {streak >= 2 && (
          <motion.span
            key="streak"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            className="flex items-center gap-1 rounded-full bg-coral/15 px-3 py-1.5 text-base font-extrabold text-coral"
            title="Streak"
          >
            <Flame size={18} className="animate-flicker" />
            <motion.span key={streak} initial={{ scale: 1.6 }} animate={{ scale: 1 }}>
              {streak}
            </motion.span>
          </motion.span>
        )}
      </AnimatePresence>
      <div className="flex min-w-[5.5rem] items-center justify-end gap-1.5 rounded-full bg-gold/12 px-3.5 py-1.5 text-lg font-extrabold text-gold">
        <Zap size={18} className="fill-gold" />
        <CountUp value={score} />
      </div>
    </div>
  )
}

export function CountUp({ value, duration = 0.6 }: { value: number; duration?: number }) {
  const mv = useMotionValue(value)
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString())
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: 'easeOut' })
    return () => c.stop()
  }, [mv, value, duration])
  return <motion.span>{rounded}</motion.span>
}

/** End-of-round summary. */
export function ResultsCard({
  title,
  score,
  scoreLabel,
  stars,
  result,
  stats,
  onAgain,
  onSetup,
  children,
}: {
  title: string
  score: number
  scoreLabel?: string
  stars: number
  result: FinishResult | null
  stats: { label: string; value: ReactNode }[]
  onAgain: () => void
  onSetup: () => void
  children?: ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="glass mx-auto w-full max-w-2xl rounded-3xl p-6 text-center sm:p-8"
    >
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      <div className="mt-4 flex justify-center">
        <Stars value={stars} size={44} animate />
      </div>
      <div className="mt-4 font-display text-6xl font-bold text-gold">
        <CountUp value={score} duration={1.1} />
        {scoreLabel && <span className="ml-1 text-3xl text-ink-soft">{scoreLabel}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {result?.isBest && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.25, 1] }}
            transition={{ delay: 0.9 }}
            className="flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1 font-extrabold text-night-900"
          >
            <Trophy size={16} /> New best!
          </motion.span>
        )}
        {result && (
          <span className="flex items-center gap-1 rounded-full bg-white/8 px-3.5 py-1 font-extrabold text-ink-soft">
            <Zap size={16} className="fill-gold text-gold" /> +{result.xp} XP
          </span>
        )}
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-night-850 p-3">
            <dt className="text-xs font-extrabold uppercase tracking-wider text-ink-mute">{s.label}</dt>
            <dd className="mt-1 text-xl font-extrabold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button size="lg" icon={RotateCcw} onClick={onAgain}>
          Play again
        </Button>
        <Button size="lg" variant="secondary" icon={SlidersHorizontal} onClick={onSetup}>
          Change level
        </Button>
        <Button size="lg" variant="ghost" icon={ArrowLeft} onClick={() => go('/practice')}>
          All games
        </Button>
      </div>
    </motion.section>
  )
}

/** One line of feedback with a fixed height, so the layout doesn't jump. */
export function FeedbackLine({ tone, children, id }: { tone: 'neutral' | 'good' | 'bad' | 'info'; children: ReactNode; id: string | number }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'info' ? 'text-gold' : 'text-ink-soft'
  return (
    <div className="flex min-h-[2.25rem] items-center justify-center text-center" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.p
          key={id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className={`text-lg font-extrabold ${color}`}
        >
          {children}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
