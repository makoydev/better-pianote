import { Check, Dumbbell, Flame, Play, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Page } from '../../components/layout/Page'
import { IconTile } from '../../components/ui/Card'
import { go } from '../../router'
import { dayKeyOf, useProgress } from '../../state/progress'
import { GAMES, gameById } from './games'
import { WORKOUT, WORKOUT_ID } from './shared/workout'

export function PracticeHub() {
  const games = useProgress((s) => s.games)
  const workout = games[WORKOUT_ID]
  const doneToday = !!workout && dayKeyOf(workout.lastPlayed) === dayKeyOf()

  return (
    <Page title="Practice" subtitle="Short games that build real skills. Five minutes a day beats an hour once a week.">
      {/* The daily workout: the games in a row, five minutes, at your levels. */}
      <motion.button
        type="button"
        onClick={() => go('/practice/workout')}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        className="group relative mb-8 flex w-full flex-col gap-5 overflow-hidden rounded-[2rem] p-6 text-left sm:flex-row sm:items-center sm:p-8"
        style={{ background: 'linear-gradient(125deg, #ffc85733, #ff7b6b22 45%, rgba(25,24,56,.9))' }}
      >
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-gold opacity-40 blur-3xl transition-opacity group-hover:opacity-60" />
        <span className="relative">
          <motion.span className="inline-flex" animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}>
            <IconTile icon={Dumbbell} from="#ffc857" to="#ff7b6b" size={88} />
          </motion.span>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.18em] text-gold">
            {doneToday ? <Check size={16} strokeWidth={3} /> : <Flame size={16} className="animate-flicker" />}
            {doneToday ? `Done today · ${workout.last}%` : "Today's workout"}
          </span>
          <span className="mt-1 block font-display text-4xl font-bold leading-tight">Daily workout</span>
          <span className="mt-1 block max-w-xl text-lg text-ink-soft">Five minutes: notes, chords, rhythm and your ear, one game after another at your levels.</span>
          <span className="mt-3 flex flex-wrap items-center gap-2">
            {WORKOUT.map((p) => {
              const g = gameById(p.game)
              return (
                <span key={p.game} className="inline-flex items-center gap-1.5 rounded-full bg-night-900/45 py-1 pl-1 pr-3 text-sm font-extrabold text-ink-soft">
                  <IconTile icon={g.icon} from={g.from} to={g.to} size={26} />
                  {p.what}
                </span>
              )
            })}
          </span>
        </span>
        {/* Looks like a button; the whole card is the button. */}
        <span className="relative inline-flex h-16 shrink-0 items-center justify-center gap-3 rounded-[1.25rem] bg-linear-to-b from-gold to-gold-deep px-8 text-xl font-extrabold text-night-900 shadow-[0_5px_0_#b9761f,0_14px_28px_-10px_rgba(255,200,87,.55)] transition-transform group-active:translate-y-[3px]">
          <Play size={26} strokeWidth={2.5} /> {doneToday ? 'Go again' : 'Start'}
        </span>
      </motion.button>

      <div className="grid gap-4 md:grid-cols-2">
        {GAMES.map((g, i) => {
          const rec = games[g.id]
          const I = g.icon
          return (
            <motion.button
              key={g.id}
              type="button"
              onClick={() => go(g.path)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="glass group relative flex items-start gap-4 overflow-hidden rounded-3xl p-5 text-left transition-colors hover:border-white/15"
            >
              <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-35" style={{ background: g.from }} />
              <IconTile icon={I} from={g.from} to={g.to} size={64} />
              <span className="relative min-w-0 flex-1">
                <span className="text-xs font-extrabold uppercase tracking-[0.16em]" style={{ color: g.from }}>
                  {g.skill}
                </span>
                <span className="block font-display text-2xl font-bold leading-tight">{g.title}</span>
                <span className="mt-1 block text-base leading-snug text-ink-mute">{g.blurb}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2 text-sm font-extrabold">
                  {rec ? (
                    <>
                      <span className="flex items-center gap-1 rounded-full bg-gold/12 px-3 py-1 text-gold">
                        <Trophy size={14} /> Best {g.format(rec.best)}
                      </span>
                      <span className="rounded-full bg-white/6 px-3 py-1 text-ink-mute">
                        {rec.plays} {rec.plays === 1 ? 'round' : 'rounds'}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-teal/15 px-3 py-1 text-teal">New!</span>
                  )}
                </span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </Page>
  )
}
