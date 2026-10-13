import { ArrowLeft, ArrowRight, Dumbbell, Pause, Play, RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { type ComponentType, useEffect, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui/Button'
import { IconTile } from '../../components/ui/Card'
import { GoalProgress } from '../../components/ui/GoalProgress'
import { Stars } from '../../components/ui/progress'
import { useHandsFree } from '../../hooks/useHandsFree'
import { burst, celebrate } from '../../lib/fx'
import { go } from '../../router'
import { dayKeyOf, useProgress } from '../../state/progress'
import { ChordTrainer } from './ChordTrainer'
import { EarTraining } from './EarTraining'
import { gameById } from './games'
import { NoteRush } from './NoteRush'
import { RhythmTap } from './RhythmTap'
import { GameMain } from './shared/GameParts'
import { sfx } from './shared/finish'
import { type PartResult, WORKOUT, WORKOUT_ID, type WorkoutPart, workoutTotals } from './shared/workout'

const GAME_SCREENS: Record<string, ComponentType<{ workout?: WorkoutPart }>> = {
  'note-rush': NoteRush,
  'chord-trainer': ChordTrainer,
  rhythm: RhythmTap,
  ear: EarTraining,
}

/** Seconds between parts before the next one starts by itself. */
const BREATHER = 5

type Phase = 'intro' | 'between' | 'part' | 'done'

/**
 * The daily workout: Note Rush, Chord Trainer, Rhythm Tap and Ear Training one after another, each a short round at
 * the level you last played it, then one summary. It moves on by itself between parts (or on Enter, a pedal tap or
 * the top C), so your hands can stay on the keys.
 */
export function DailyWorkout() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [at, setAt] = useState(0)
  const [results, setResults] = useState<PartResult[]>([])
  // The results so far, for a part that finishes before the screen has caught up.
  const done = useRef<PartResult[]>([])
  const [totals, setTotals] = useState<ReturnType<typeof workoutTotals> | null>(null)

  const begin = () => {
    done.current = []
    setResults([])
    setTotals(null)
    setAt(0)
    setPhase('part')
  }

  const partDone = (r: PartResult) => {
    const all = [...done.current, r]
    done.current = all
    setResults(all)
    if (all.length < WORKOUT.length) {
      setAt(all.length)
      setPhase('between')
      return
    }
    const t = workoutTotals(all, WORKOUT.length)
    const prog = useProgress.getState()
    prog.recordGame(WORKOUT_ID, t.pct)
    prog.addXp(t.xp)
    sfx('complete')
    if (t.stars === 3) celebrate()
    else if (t.stars > 0) burst()
    setTotals(t)
    setPhase('done')
  }

  if (phase === 'part') {
    const part = WORKOUT[at]
    const Game = GAME_SCREENS[part.game]
    return <Game key={at} workout={{ size: part.size, step: `Part ${at + 1} of ${WORKOUT.length}`, onDone: partDone }} />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/practice" title="Daily workout" subtitle="Notes, chords, rhythm and ear in five minutes" />
      <GameMain>
        {phase === 'intro' && <Intro onStart={begin} />}
        {phase === 'between' && <Between at={at} results={results} onGo={() => setPhase('part')} />}
        {phase === 'done' && totals && <Summary results={results} totals={totals} onAgain={begin} />}
      </GameMain>
    </div>
  )
}

/** One part: its game's tile, name and what it asks. With a result, how it went. */
function PartRow({ index, result, current = false }: { index: number; result?: PartResult; current?: boolean }) {
  const part = WORKOUT[index]
  const game = gameById(part.game)
  return (
    <li
      className={`flex items-center gap-4 rounded-2xl border p-3 pr-4 transition-colors ${
        current ? 'border-gold/70 bg-gold/12' : 'border-white/8 bg-night-800/80'
      } ${result || current ? '' : 'opacity-80'}`}
    >
      <IconTile icon={game.icon} from={game.from} to={game.to} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight">{game.title}</span>
        <span className="block text-sm font-semibold text-ink-mute">{result ? result.detail : part.what}</span>
      </span>
      {result ? <Stars value={result.stars} size={22} /> : <span className="text-sm font-extrabold text-ink-mute">{index + 1}</span>}
    </li>
  )
}

function Intro({ onStart }: { onStart: () => void }) {
  const record = useProgress((s) => s.games[WORKOUT_ID])
  const today = !!record && dayKeyOf(record.lastPlayed) === dayKeyOf()
  // Enter, a pedal tap or the top C start it.
  useHandsFree(onStart)
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gold opacity-25 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <IconTile icon={Dumbbell} from="#ffc857" to="#ff7b6b" size={64} />
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Daily workout</h2>
            <p className="mt-1.5 max-w-2xl text-lg leading-relaxed text-ink-soft">
              Four quick games in a row, each at the level you last played it. Between parts it moves on by itself, or press Enter
              or tap the pedal when you're ready.
            </p>
            {today && (
              <p className="mt-2 text-base font-bold text-good">
                Done today ({record.last}%). Another round is good practice too.
              </p>
            )}
          </div>
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {WORKOUT.map((_, i) => (
          <PartRow key={i} index={i} />
        ))}
      </ol>
      <div className="flex justify-center">
        <Button size="xl" icon={Play} onClick={onStart} className="sm:min-w-64">
          Start the workout
        </Button>
      </div>
    </motion.section>
  )
}

/** Between parts: how the last one went and what's next, starting by itself after a breather (unless you hold it). */
function Between({ at, results, onGo }: { at: number; results: PartResult[]; onGo: () => void }) {
  const [held, setHeld] = useState(false)
  const [left, setLeft] = useState(BREATHER)
  const next = gameById(WORKOUT[at].game)
  useEffect(() => {
    if (held) return
    if (left <= 0) {
      onGo()
      return
    }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [held, left, onGo])
  useHandsFree(onGo)
  const last = results[results.length - 1]
  return (
    <motion.section key={at} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      {last && (
        <p className="text-center text-xl font-extrabold text-ink-soft">
          {gameById(WORKOUT[at - 1].game).title}: <span className="text-ink">{last.detail}</span>
        </p>
      )}
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-6 text-center sm:p-8">
        <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-gold">
          Up next · part {at + 1} of {WORKOUT.length}
        </span>
        <IconTile icon={next.icon} from={next.from} to={next.to} size={88} />
        <h2 className="font-display text-4xl font-bold leading-tight">{next.title}</h2>
        <p className="text-lg font-semibold text-ink-soft">{WORKOUT[at].what}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" iconRight={ArrowRight} onClick={onGo} className="min-w-48">
            {held ? 'Go' : `Go (${Math.max(0, left)})`}
          </Button>
          {!held && (
            <Button size="lg" variant="secondary" icon={Pause} onClick={() => setHeld(true)}>
              Hold on
            </Button>
          )}
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {WORKOUT.map((_, i) => (
          <PartRow key={i} index={i} result={results[i]} current={i === at} />
        ))}
      </ol>
    </motion.section>
  )
}

const TITLES = ['Workout done', 'Workout done!', 'Great workout!', 'Superb workout!']

function Summary({ results, totals, onAgain }: { results: PartResult[]; totals: ReturnType<typeof workoutTotals>; onAgain: () => void }) {
  // Enter, a pedal tap or the top C finish (not straight away, so the note that ended the last part doesn't).
  useHandsFree(() => go('/practice'))
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="glass mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl p-6 text-center sm:p-8"
    >
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{TITLES[totals.stars]}</h2>
      <div className="mt-4">
        <Stars value={totals.stars} size={44} animate />
      </div>
      <div className="mt-3 font-display text-6xl font-bold text-gold">
        {totals.pct}
        <span className="ml-1 text-3xl text-ink-soft">%</span>
      </div>
      <p className="mt-1 text-lg font-bold text-ink-soft">+{totals.xp} XP</p>
      <ol className="mt-6 flex w-full flex-col gap-2 text-left">
        {WORKOUT.map((_, i) => (
          <PartRow key={i} index={i} result={results[i]} />
        ))}
      </ol>
      <GoalProgress className="mx-auto mt-5" />
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button size="lg" icon={ArrowLeft} onClick={() => go('/practice')}>
          Done
        </Button>
        <Button size="lg" variant="secondary" icon={RotateCcw} onClick={onAgain}>
          Do it again
        </Button>
      </div>
    </motion.section>
  )
}
