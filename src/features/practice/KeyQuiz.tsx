import { ArrowRight, Check, Hash, X } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { MicPrompt } from '../../components/layout/MicPrompt'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { Staff } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Segmented, Toggle } from '../../components/ui/controls'
import { useHandsFree } from '../../hooks/useHandsFree'
import { burst } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { enharmonicLabel, keyId, keyName } from '../../lib/theory'
import { usePref } from '../../state/prefs'
import {
  KEY_LEVELS,
  type KeyLevel,
  type KeyMode,
  type KeyQuestion,
  type QuizKey,
  describeKeyMiss,
  describeSignature,
  explainKey,
  keyItemName,
  keyPlan,
  levelKeys,
  makeKeyQuestion,
  playedOption,
} from './logic/keys'
import { FeedbackLine, GameMain, Hud, MissList, ResultsCard, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame, remember, sfx, starsFor, store } from './shared/finish'
import { useItemStats, usePracticeStats, weigher } from './shared/stats'
import { type ItemAnswer, msSince, weakest } from './shared/weak'

const ROUND = 10

/** A wrong answer, kept for the list on the results. */
interface WrongPick {
  q: KeyQuestion
  picked: number
}

export function KeyQuiz() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [mode, setMode] = useState<KeyMode>(() => remember('key-quiz-mode', 'name', ['name', 'find'] as const))
  const [levelId, setLevelId] = useState(() => remember('key-quiz-level', 'easy', KEY_LEVELS.map((l) => l.id)))
  const level = KEY_LEVELS.find((l) => l.id === levelId) ?? KEY_LEVELS[0]
  // Name the key by playing its keynote instead of tapping.
  const [byPlaying, setByPlaying] = usePref('key-quiz:play', false)
  const [question, setQuestion] = useState<KeyQuestion | null>(null)
  // Which question we're on (changes on "next", so answering doesn't remount the question).
  const [qIndex, setQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [finish, setFinish] = useState<FinishResult | null>(null)
  const [summary, setSummary] = useState({ clean: 0, best: 0, misses: [] as WrongPick[] })
  const tally = useRef({ answered: 0, clean: 0, score: 0, streak: 0, best: 0, misses: [] as WrongPick[], answers: [] as ItemAnswer[] })
  // The keys this round asks, in order (ids like "D" or "Bbm").
  const plan = useRef<string[]>([])
  // A drill of keys you missed (not a level record).
  const [drill, setDrill] = useState(false)
  const stats = useItemStats('key-quiz')

  const start = (missed?: string[], lv: KeyLevel = level) => {
    store('key-quiz-mode', mode)
    store('key-quiz-level', lv.id)
    // Keys you miss or are slow on come up more often; a drill is mostly the ones you just missed.
    const weak = weigher('key-quiz', levelKeys(lv).map((k) => k.id))
    plan.current = keyPlan(lv, ROUND, (k: QuizKey) => k.chance * weak(k.id), missed)
    setDrill(!!missed)
    tally.current = { answered: 0, clean: 0, score: 0, streak: 0, best: 0, misses: [], answers: [] }
    setQuestion(makeKeyQuestion(lv, null, Math.random, { ask: plan.current[0] }))
    setQIndex(0)
    setScore(0)
    setStreak(0)
    setFinish(null)
    setPhase('play')
  }

  const answered = (q: KeyQuestion, picked: number, ms: number) => {
    const t = tally.current
    const right = picked === q.answer
    t.answered++
    t.streak = right ? t.streak + 1 : 0
    t.best = Math.max(t.best, t.streak)
    if (right) {
      t.clean++
      t.score += 100 + 10 * Math.min(t.streak, 5)
    } else t.misses.push({ q, picked })
    t.answers.push({ id: keyId(q.key), missed: !right, ms: right ? ms : undefined })
    setScore(t.score)
    setStreak(t.streak)
  }

  const next = () => {
    const t = tally.current
    if (t.answered >= ROUND) {
      setFinish(finishGame('key-quiz', drill ? null : level.id, t.score, starsFor(t.clean / ROUND, 0.9, 0.7), { accuracy: (t.clean / ROUND) * 100 }))
      usePracticeStats.getState().recordAnswers('key-quiz', t.answers)
      setSummary({ clean: t.clean, best: t.best, misses: t.misses })
      setPhase('done')
      return
    }
    setQuestion((q) => makeKeyQuestion(level, q?.fifths ?? null, Math.random, { ask: plan.current[t.answered] }))
    setQIndex(t.answered)
  }

  const weak = weakest(stats, levelKeys(level).map((k) => k.id)).map(keyItemName)
  const stars = starsFor(summary.clean / ROUND, 0.9, 0.7)
  const nextLevel = KEY_LEVELS[KEY_LEVELS.indexOf(level) + 1]

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/practice" title="Key Signature Quiz" subtitle={phase === 'setup' ? 'Sharps, flats and the keys they make' : drill ? `Drill · ${level.name}` : level.name} />
      {phase === 'setup' && (
        <GameMain>
          <SetupCard
            icon={Hash}
            from="#5cc8ff"
            to="#9b8cff"
            title="Key Signature Quiz"
            blurb="The sharps or flats at the start of every line tell you the key. Learn to read them at a glance."
            gameId="key-quiz"
            levels={KEY_LEVELS}
            level={level.id}
            onLevel={setLevelId}
            onStart={() => start()}
            weakest={weak}
          >
            <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5">
              <span className="text-lg font-extrabold">Question type</span>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'name', label: 'Name the key' },
                  { value: 'find', label: 'Find the signature' },
                ]}
              />
            </div>
            {mode === 'name' && (
              <label className="glass flex items-center justify-between gap-4 rounded-3xl p-4 pl-5">
                <span>
                  <span className="block text-lg font-extrabold">Answer by playing</span>
                  <span className="text-sm text-ink-mute">Play the key’s keynote on your keyboard (any octave) instead of tapping.</span>
                </span>
                <Toggle checked={byPlaying} onChange={setByPlaying} label="Answer by playing" />
              </label>
            )}
          </SetupCard>
        </GameMain>
      )}
      {phase === 'play' && question && (
        <GameMain>
          <Hud step={qIndex} total={ROUND} score={score} streak={streak} />
          <Question
            key={qIndex}
            q={question}
            mode={mode}
            grand={level.grand}
            byPlaying={byPlaying && mode === 'name'}
            onAnswer={(picked, ms) => answered(question, picked, ms)}
            onNext={next}
          />
        </GameMain>
      )}
      {phase === 'done' && (
        <GameMain>
          <ResultsCard
            title={drill ? 'Drill done!' : summary.clean >= 9 ? 'Key master!' : 'Round complete'}
            score={score}
            stars={stars}
            result={finish}
            stats={[
              { label: 'Correct', value: `${summary.clean}/${ROUND}` },
              { label: 'Best streak', value: summary.best },
              { label: 'Mode', value: mode === 'name' ? 'Name it' : 'Find it' },
            ]}
            historyKey={drill ? undefined : `key-quiz:${level.id}`}
            // Three stars: on to the next level, straight away.
            next={
              stars === 3 && !drill && nextLevel
                ? {
                    label: `Next level: ${nextLevel.name}`,
                    onClick: () => {
                      setLevelId(nextLevel.id)
                      start(undefined, nextLevel)
                    },
                  }
                : undefined
            }
            onAgain={() => start()}
            onSetup={() => setPhase('setup')}
          >
            <MissList misses={summary.misses.map((m) => describeKeyMiss(m.q, m.picked, mode))} onDrill={() => start(summary.misses.map((m) => keyId(m.q.key)))} />
          </ResultsCard>
        </GameMain>
      )}
    </div>
  )
}

function Question({
  q,
  mode,
  grand,
  byPlaying,
  onAnswer,
  onNext,
}: {
  q: KeyQuestion
  mode: KeyMode
  grand: boolean
  /** The keynote you play answers (name mode). */
  byPlaying: boolean
  onAnswer: (picked: number, ms: number) => void
  onNext: () => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const right = picked === q.answer
  const shownAt = useRef(0)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [])
  // A note that names none of the choices: said, not counted.
  const [stray, setStray] = useState<number | null>(null)
  // Hands-free Next after a wrong answer (a right one moves on by itself); while keynotes are answers, none.
  useHandsFree(picked !== null && !right ? onNext : null)

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    const ok = i === q.answer
    onAnswer(i, msSince(shownAt.current))
    if (ok) {
      sfx('correct')
      burst(cardRef.current, { count: 28 })
      window.setTimeout(onNext, 1900)
    } else sfx('wrong')
  }

  // A keynote you play counts just like tapping that key (F♯ and G♭ are the same key here: see playedOption).
  useNoteEvents((e) => {
    if (!byPlaying || picked !== null || e.type !== 'on') return
    const i = playedOption(q, e.midi)
    if (i === null) setStray(e.midi)
    else choose(i)
  })

  const modeWord = q.key.mode === 'minor' ? 'minor' : 'major'
  // What follows the answers: how it went, the mic, and once answered, why and Next.
  const tail = (
    <>
      <FeedbackLine tone={picked === null ? (stray === null ? 'neutral' : 'info') : right ? 'good' : 'bad'} id={picked === null ? `q${stray}` : 'a'}>
        {picked !== null ? (
          right ? (
            'Correct!'
          ) : (
            'Not quite.'
          )
        ) : stray !== null ? (
          <MusicText text={`${enharmonicLabel(stray)} isn’t the keynote of any of these.`} />
        ) : mode === 'name' ? (
          byPlaying ? (
            'Count the sharps or flats, use the trick, then play its keynote.'
          ) : (
            'Count the sharps or flats, then use the trick.'
          )
        ) : (
          'Picture the signature, then find it.'
        )}
      </FeedbackLine>
      {byPlaying && picked === null && <MicPrompt />}
      {picked !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-5 text-lg leading-relaxed text-ink-soft">
          <MusicText text={explainKey(q.fifths, q.key)} />
        </motion.div>
      )}
      {picked !== null && !right && (
        <div className="flex justify-center">
          <Button size="lg" iconRight={ArrowRight} onClick={onNext}>
            Next
          </Button>
        </div>
      )}
    </>
  )
  return (
    <motion.div ref={cardRef} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      {mode === 'name' ? (
        // Side by side on a laptop, so a grand staff and every answer fit the window.
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
          <div className="glass flex flex-col items-center gap-3 rounded-3xl p-5 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Which {modeWord} key is this?</h2>
            <div className="paper w-full max-w-md rounded-3xl px-4 py-2">
              <Staff clef={grand ? 'grand' : 'treble'} items={[]} keySig={q.fifths} sp={grand ? 20 : 26} className="flex justify-center" reserveAbove={1.5} reserveBelow={1.5} />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((o, i) => (
                <OptionButton key={o.label} state={picked === null ? 'idle' : i === q.answer ? 'right' : i === picked ? 'wrong' : 'off'} onClick={() => choose(i)}>
                  <span className="font-display text-2xl font-bold">
                    <MusicText text={o.label} />
                  </span>
                </OptionButton>
              ))}
            </div>
            {tail}
          </div>
        </div>
      ) : (
        <>
          <div className="glass rounded-3xl p-5 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Which signature is <MusicText text={keyName(q.key)} className="text-gold" />?
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((o, i) => (
              <OptionButton key={o.fifths} state={picked === null ? 'idle' : i === q.answer ? 'right' : i === picked ? 'wrong' : 'off'} onClick={() => choose(i)} label={describeSignature(o.fifths)}>
                <span className="paper block w-full rounded-2xl px-2 py-1">
                  <Staff clef="treble" items={[]} keySig={o.fifths} sp={16} className="flex justify-center" reserveAbove={1} reserveBelow={1} />
                </span>
              </OptionButton>
            ))}
          </div>
          {tail}
        </>
      )}
    </motion.div>
  )
}

function OptionButton({
  state,
  onClick,
  children,
  label,
}: {
  state: 'idle' | 'right' | 'wrong' | 'off'
  onClick: () => void
  children: ReactNode
  label?: string
}) {
  const verdict = state === 'right' ? 'right answer' : state === 'wrong' ? 'wrong' : null
  return (
    <motion.button
      type="button"
      aria-label={label && (verdict ? `${label} (${verdict})` : label)}
      onClick={onClick}
      whileTap={state === 'idle' ? { scale: 0.96 } : undefined}
      animate={state === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : state === 'right' ? { scale: [1, 1.05, 1] } : {}}
      className={`relative flex min-h-20 items-center justify-center rounded-2xl border-2 p-3 transition-colors ${
        state === 'right'
          ? 'border-good bg-good/18 text-good'
          : state === 'wrong'
            ? 'border-bad/70 bg-bad/12 text-bad'
            : state === 'off'
              ? 'border-white/6 bg-night-800 opacity-50'
              : 'border-white/10 bg-night-750 text-ink hover:border-white/30'
      }`}
    >
      {children}
      {/* A tick or cross as well as the colour, so right and wrong don't rely on colour alone. */}
      {verdict && (
        <span
          aria-hidden
          className={`absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full text-night-900 shadow-lg ${state === 'right' ? 'bg-good' : 'bg-bad'}`}
        >
          {state === 'right' ? <Check size={18} strokeWidth={3.5} /> : <X size={18} strokeWidth={3.5} />}
        </span>
      )}
      {verdict && !label && <span className="sr-only">({verdict})</span>}
    </motion.button>
  )
}
