import { ArrowRight, Ear, Music2, Repeat, Smile, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Button } from '../../components/ui/Button'
import { playNotes, playSequence } from '../../lib/audio/play'
import { burst } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { fromMidi, pitchName } from '../../lib/theory'
import {
  ECHO_LEVELS,
  type EarMode,
  INTERVAL_LEVELS,
  type IntervalQ,
  QUALITY_LABEL,
  QUALITY_LEVELS,
  type QualityQ,
  intervalCue,
  intervalName,
  makeEcho,
  makeInterval,
  makeQuality,
  qualityNotes,
  samePitchClass,
} from './logic/ear'
import { FeedbackLine, GameMain, Hud, ResultsCard, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame, remember, sfx, starsFor, store } from './shared/finish'

const ROUND = 10

const MODES: { id: EarMode; title: string; blurb: string; icon: typeof Ear; from: string; to: string }[] = [
  { id: 'quality', title: 'Major or minor?', blurb: 'Hear a chord, name its colour.', icon: Smile, from: '#3ee6c8', to: '#5cc8ff' },
  { id: 'interval', title: 'Name the interval', blurb: 'How far apart are two notes?', icon: Music2, from: '#9b8cff', to: '#5cc8ff' },
  { id: 'echo', title: 'Echo', blurb: 'Hear a short tune, play it back.', icon: Repeat, from: '#ffc857', to: '#ff7b6b' },
]

function levelsFor(mode: EarMode) {
  const list = mode === 'quality' ? QUALITY_LEVELS : mode === 'interval' ? INTERVAL_LEVELS : ECHO_LEVELS
  return list.map((l) => ({ id: `${mode}-${l.id}`, name: l.name, description: l.description }))
}

type Question = QualityQ | IntervalQ | { kind: 'echo'; notes: number[] }

interface Outcome {
  correct: boolean
  /** Right without help (first try for choices, no reveal for echo). */
  clean: boolean
}

export function EarTraining() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [mode, setMode] = useState<EarMode>(() => remember('ear-mode', 'quality', ['quality', 'interval', 'echo'] as const))
  const allLevelIds = (['quality', 'interval', 'echo'] as EarMode[]).flatMap((m) => levelsFor(m).map((l) => l.id))
  const [levelId, setLevelId] = useState(() => remember('ear-level', levelsFor(mode)[0].id, allLevelIds))
  const levels = levelsFor(mode)
  const level = levels.find((l) => l.id === levelId) ?? levels[0]
  const [question, setQuestion] = useState<Question | null>(null)
  // Which question we're on (changes on "next", so answering doesn't remount the question).
  const [qIndex, setQIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [finish, setFinish] = useState<FinishResult | null>(null)
  // Answers can arrive from timers, so the running tally lives in a ref too.
  const tally = useRef({ outcomes: [] as Outcome[], score: 0, streak: 0, best: 0 })

  const makeQuestion = (prev: Question | null): Question => {
    const lid = level.id.slice(mode.length + 1)
    if (mode === 'quality') return makeQuality(QUALITY_LEVELS.find((l) => l.id === lid) ?? QUALITY_LEVELS[0], prev?.kind === 'quality' ? prev : null)
    if (mode === 'interval') return makeInterval(INTERVAL_LEVELS.find((l) => l.id === lid) ?? INTERVAL_LEVELS[0], prev?.kind === 'interval' ? prev : null)
    return makeEcho(ECHO_LEVELS.find((l) => l.id === lid) ?? ECHO_LEVELS[0])
  }

  const chooseMode = (m: EarMode) => {
    setMode(m)
    setLevelId(levelsFor(m)[0].id)
  }

  const start = () => {
    store('ear-mode', mode)
    store('ear-level', level.id)
    tally.current = { outcomes: [], score: 0, streak: 0, best: 0 }
    setQuestion(makeQuestion(null))
    setQIndex(0)
    setOutcomes([])
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setFinish(null)
    setPhase('play')
  }

  const answered = (o: Outcome) => {
    const t = tally.current
    t.streak = o.correct ? t.streak + 1 : 0
    t.best = Math.max(t.best, t.streak)
    t.score += o.correct ? (o.clean ? 100 : 50) + 10 * Math.min(t.streak, 5) : 0
    t.outcomes = [...t.outcomes, o]
    setStreak(t.streak)
    setBestStreak(t.best)
    setScore(t.score)
    setOutcomes(t.outcomes)
  }

  const next = () => {
    const t = tally.current
    if (t.outcomes.length >= ROUND) {
      const clean = t.outcomes.filter((o) => o.clean).length
      setFinish(finishGame('ear', level.id, t.score, starsFor(clean / ROUND, 0.9, 0.7)))
      setPhase('done')
      return
    }
    setQuestion((q) => makeQuestion(q))
    setQIndex(t.outcomes.length)
  }

  const modeInfo = MODES.find((m) => m.id === mode)!
  const clean = outcomes.filter((o) => o.clean).length

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/practice" title="Ear Training" subtitle={phase === 'setup' ? 'Train the ear you already have' : `${modeInfo.title} · ${level.name}`} />
      {phase === 'setup' && (
        <GameMain>
          <SetupCard
            icon={Ear}
            from="#3ee6c8"
            to="#5cc8ff"
            title="Ear Training"
            blurb="You already play by ear, so this is where you shine. Put names to the sounds you know."
            gameId="ear"
            levels={levels}
            level={level.id}
            onLevel={setLevelId}
            onStart={start}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => {
                const I = m.icon
                const active = m.id === mode
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => chooseMode(m.id)}
                    aria-pressed={active}
                    className={`flex flex-col items-start gap-2 rounded-3xl border p-5 text-left transition-colors ${
                      active ? 'border-gold/70 bg-gold/12' : 'border-white/8 bg-night-800/80 hover:border-white/20'
                    }`}
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl text-night-900" style={{ background: `linear-gradient(140deg, ${m.from}, ${m.to})` }}>
                      <I size={26} />
                    </span>
                    <span className="text-xl font-extrabold">{m.title}</span>
                    <span className="text-sm text-ink-mute">{m.blurb}</span>
                  </motion.button>
                )
              })}
            </div>
          </SetupCard>
        </GameMain>
      )}
      {phase === 'play' && question && (
        <GameMain wide={mode === 'echo'}>
          <Hud step={qIndex} total={ROUND} score={score} streak={streak} />
          {question.kind === 'quality' && (
            <ChoiceQuestion
              key={qIndex}
              title="Major or minor?"
              prompt="Is this chord happy, sad… or something stranger?"
              play={() => {
                const notes = qualityNotes(question)
                playSequence(notes, { gap: 0.32, dur: 1.1 })
                playNotes(notes, { dur: 1.8, delay: 1.05 })
              }}
              options={(level.id.endsWith('mm') ? ['maj', 'min'] : ['maj', 'min', 'dim', 'aug']).map((id) => ({ id, label: QUALITY_LABEL[id] }))}
              answer={question.type.id}
              hear={(id) => {
                const notes = [0, ...(id === 'maj' ? [4, 7] : id === 'min' ? [3, 7] : id === 'dim' ? [3, 6] : [4, 8])].map((s) => question.root + s)
                playSequence(notes, { gap: 0.32, dur: 1.1 })
                playNotes(notes, { dur: 1.8, delay: 1.05 })
              }}
              reveal={() => (
                <MusicText text={`${pitchName(fromMidi(question.root))} ${QUALITY_LABEL[question.type.id].toLowerCase()}`} />
              )}
              onAnswer={answered}
              onNext={next}
            />
          )}
          {question.kind === 'interval' && (
            <ChoiceQuestion
              key={qIndex}
              title="Name the interval"
              prompt={question.harmonic ? 'Two notes played together. How far apart?' : 'Two notes, low then high. How far apart?'}
              play={() => (question.harmonic ? playNotes([question.low, question.low + question.semis], { dur: 1.8 }) : playSequence([question.low, question.low + question.semis], { gap: 0.75, dur: 1.3 }))}
              options={INTERVAL_LEVELS.find((l) => level.id.endsWith(l.id))!.semis.map((s) => ({ id: String(s), label: intervalName(s) }))}
              answer={String(question.semis)}
              hear={(id) => playSequence([question.low, question.low + Number(id)], { gap: 0.75, dur: 1.3 })}
              reveal={() => (
                <span>
                  {intervalName(question.semis)} · {question.semis} half step{question.semis > 1 ? 's' : ''}
                  {intervalCue(question.semis) && <span className="mt-1 block text-base font-bold text-ink-soft">Like {intervalCue(question.semis)}</span>}
                </span>
              )}
              keyboard={{ from: 48, to: 84, marks: { [question.low]: { kind: 'root', label: pitchName(fromMidi(question.low)) }, [question.low + question.semis]: { kind: 'chord', label: pitchName(fromMidi(question.low + question.semis)) } } }}
              onAnswer={answered}
              onNext={next}
            />
          )}
          {question.kind === 'echo' && <EchoQuestion key={qIndex} notes={question.notes} onAnswer={answered} onNext={next} />}
        </GameMain>
      )}
      {phase === 'done' && (
        <GameMain>
          <ResultsCard
            title={clean >= 9 ? 'Golden ears!' : clean >= 7 ? 'Great listening!' : 'Round complete'}
            score={score}
            stars={starsFor(clean / ROUND, 0.9, 0.7)}
            result={finish}
            stats={[
              { label: 'First try', value: `${clean}/${ROUND}` },
              { label: 'Correct', value: `${outcomes.filter((o) => o.correct).length}/${ROUND}` },
              { label: 'Best streak', value: bestStreak },
            ]}
            onAgain={start}
            onSetup={() => setPhase('setup')}
          />
        </GameMain>
      )}
    </div>
  )
}

/** The big round "play it again" button. */
function ReplayButton({ onClick, playing }: { onClick: () => void; playing: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      animate={playing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={playing ? { duration: 0.9, repeat: Infinity } : undefined}
      className="relative flex size-28 items-center justify-center rounded-full bg-linear-to-b from-teal to-sky text-night-900 shadow-[0_6px_0_#1a8f86,0_18px_40px_-12px_rgba(62,230,200,.6)] active:translate-y-[3px] active:shadow-[0_3px_0_#1a8f86]"
      aria-label="Play again"
    >
      {playing && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-teal/50" />}
      <Volume2 size={46} strokeWidth={2.4} className="relative" />
    </motion.button>
  )
}

function usePlayback(play: () => number | void, autoKey: string) {
  const [playing, setPlaying] = useState(false)
  const timer = useRef(0)
  const run = () => {
    const secs = play() ?? 2
    setPlaying(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPlaying(false), Math.max(800, Number(secs) * 1000))
  }
  const autoPlay = useEffectEvent(run)
  useEffect(() => {
    // Play each new question once it appears (the cleanup cancels the duplicate in dev strict mode).
    const t = window.setTimeout(autoPlay, 350)
    return () => window.clearTimeout(t)
  }, [autoKey])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { playing, run }
}

function ChoiceQuestion({
  title,
  prompt,
  play,
  options,
  answer,
  hear,
  reveal,
  keyboard,
  onAnswer,
  onNext,
}: {
  title: string
  prompt: string
  play: () => number | void
  options: { id: string; label: string }[]
  answer: string
  hear: (id: string) => void
  reveal: () => ReactNode
  keyboard?: { from: number; to: number; marks: Marks }
  onAnswer: (o: Outcome) => void
  onNext: () => void
}) {
  const [wrongs, setWrongs] = useState<string[]>([])
  const [result, setResult] = useState<null | 'clean' | 'second' | 'missed'>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { playing, run } = usePlayback(play, `${title}-${answer}-${options.length}`)
  // Two choices: one guess. More choices: two guesses.
  const maxWrong = options.length <= 2 ? 1 : 2

  const choose = (id: string) => {
    if (result) {
      // Afterwards, tapping an option plays it, so you can compare sounds.
      hear(id)
      return
    }
    if (id === answer) {
      const clean = wrongs.length === 0
      setResult(clean ? 'clean' : 'second')
      sfx('correct')
      burst(cardRef.current, { count: 30 })
      onAnswer({ correct: true, clean })
      if (clean) window.setTimeout(onNext, 1500)
      return
    }
    if (wrongs.includes(id)) return
    sfx('wrong')
    const w = [...wrongs, id]
    setWrongs(w)
    if (w.length >= maxWrong) {
      setResult('missed')
      onAnswer({ correct: false, clean: false })
    }
  }

  return (
    <motion.div ref={cardRef} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-6 text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
        <p className="text-lg text-ink-soft">{prompt}</p>
        <ReplayButton onClick={run} playing={playing} />
        <FeedbackLine tone={result === 'clean' ? 'good' : result === 'second' ? 'info' : result === 'missed' ? 'bad' : 'neutral'} id={result ?? wrongs.length}>
          {result ? reveal() : wrongs.length ? 'Not that one. Listen again and try another.' : 'Tap the speaker to hear it again.'}
        </FeedbackLine>
      </div>
      <div className={`grid gap-3 ${options.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
        {options.map((o) => {
          const isAnswer = result !== null && o.id === answer
          const isWrong = wrongs.includes(o.id)
          return (
            <motion.button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              whileTap={{ scale: 0.96 }}
              animate={isWrong && !result ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              className={`min-h-16 rounded-2xl border-2 px-4 py-3 text-xl font-extrabold transition-colors ${
                isAnswer
                  ? 'border-good bg-good/20 text-good'
                  : isWrong
                    ? 'border-bad/70 bg-bad/12 text-bad'
                    : result
                      ? 'border-white/8 bg-night-800 text-ink-mute'
                      : 'border-white/10 bg-night-750 text-ink hover:border-white/30'
              }`}
            >
              {o.label}
              {result && (isAnswer || isWrong) && (
                <span className="mt-0.5 flex items-center justify-center gap-1 text-xs font-bold opacity-80">
                  <Volume2 size={13} /> tap to hear
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
      {result && keyboard && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-3">
          <Piano from={keyboard.from} to={keyboard.to} marks={keyboard.marks} labels="marked" height={150} />
        </motion.div>
      )}
      {result && result !== 'clean' && (
        <div className="flex justify-center">
          <Button size="lg" iconRight={ArrowRight} onClick={onNext}>
            Next
          </Button>
        </div>
      )}
    </motion.div>
  )
}

function EchoQuestion({ notes, onAnswer, onNext }: { notes: number[]; onAnswer: (o: Outcome) => void; onNext: () => void }) {
  const [pos, setPos] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [state, setState] = useState<'listening' | 'solved' | 'revealed'>('listening')
  const [shake, setShake] = useState(0)
  const [revealIndex, setRevealIndex] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { playing, run } = usePlayback(() => {
    setPos(0)
    return playSequence(notes, { gap: 0.55, dur: 0.8 })
  }, notes.join('-'))
  const first = fromMidi(notes[0])

  const reveal = () => {
    setState('revealed')
    onAnswer({ correct: false, clean: false })
    playSequence(notes, { gap: 0.55, dur: 0.8 })
    notes.forEach((_, i) => window.setTimeout(() => setRevealIndex(i), 50 + i * 550))
    window.setTimeout(() => setRevealIndex(null), notes.length * 550 + 400)
  }

  useNoteEvents((e) => {
    if (e.type !== 'on' || state !== 'listening') return
    if (samePitchClass(e.midi, notes[pos])) {
      const next = pos + 1
      setPos(next)
      if (next === notes.length) {
        setState('solved')
        sfx('correct')
        burst(cardRef.current, { count: 36 })
        onAnswer({ correct: true, clean: attempts === 0 })
        window.setTimeout(onNext, 1500)
      }
    } else {
      sfx('wrong')
      setShake((x) => x + 1)
      setPos(0)
      const a = attempts + 1
      setAttempts(a)
      if (a >= 3) reveal()
    }
  })

  const marks: Marks = { [notes[0]]: { kind: 'target', label: pitchName(first) } }
  if (state !== 'listening') notes.forEach((n, i) => (marks[n] = { kind: revealIndex === i ? 'root' : 'chord', label: String(i + 1) }))

  return (
    <motion.div ref={cardRef} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-6 text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Echo</h2>
        <p className="text-lg text-ink-soft">
          Listen, then play it back. It starts on <b className="text-gold"><MusicText text={pitchName(first)} /></b> (any octave is fine).
        </p>
        <ReplayButton onClick={run} playing={playing} />
        <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="flex gap-3">
          {notes.map((_, i) => (
            <motion.span
              key={i}
              animate={{ scale: i < pos || state === 'solved' ? [1, 1.35, 1] : 1 }}
              className={`size-5 rounded-full border-2 ${
                state === 'solved' || i < pos ? 'border-good bg-good' : state === 'revealed' ? 'border-gold bg-gold/40' : 'border-white/30'
              }`}
            />
          ))}
        </motion.div>
        <FeedbackLine tone={state === 'solved' ? 'good' : state === 'revealed' ? 'info' : attempts ? 'bad' : 'neutral'} id={`${state}-${attempts}`}>
          {state === 'solved'
            ? attempts === 0
              ? 'Perfect echo!'
              : 'Got it!'
            : state === 'revealed'
              ? 'Here it is. Play along with the numbers, then move on.'
              : attempts
                ? `Not quite. From the first note again (${3 - attempts} ${3 - attempts === 1 ? 'try' : 'tries'} left).`
                : 'Your turn whenever you’re ready.'}
        </FeedbackLine>
        <div className="flex flex-wrap justify-center gap-2">
          {state === 'listening' && (
            <Button variant="ghost" size="md" onClick={reveal}>
              Show me
            </Button>
          )}
          {state === 'revealed' && (
            <Button size="md" iconRight={ArrowRight} onClick={onNext}>
              Next
            </Button>
          )}
        </div>
      </div>
      <div className="glass rounded-3xl px-2 pb-2 pt-20 sm:px-4">
        <Piano from={48} to={84} marks={marks} sparks labels="c" height={190} />
      </div>
    </motion.div>
  )
}
