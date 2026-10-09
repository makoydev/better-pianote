import { ArrowRight, Hash } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { Staff } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/controls'
import { burst } from '../../lib/fx'
import { keyName } from '../../lib/theory'
import { KEY_LEVELS, type KeyMode, type KeyQuestion, describeSignature, explainKey, makeKeyQuestion } from './logic/keys'
import { FeedbackLine, GameMain, Hud, ResultsCard, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame, remember, sfx, starsFor, store } from './shared/finish'

const ROUND = 10

export function KeyQuiz() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [mode, setMode] = useState<KeyMode>(() => remember('key-quiz-mode', 'name', ['name', 'find'] as const))
  const [levelId, setLevelId] = useState(() => remember('key-quiz-level', 'easy', KEY_LEVELS.map((l) => l.id)))
  const level = KEY_LEVELS.find((l) => l.id === levelId) ?? KEY_LEVELS[0]
  const [question, setQuestion] = useState<KeyQuestion | null>(null)
  // Which question we're on (changes on "next", so answering doesn't remount the question).
  const [qIndex, setQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [finish, setFinish] = useState<FinishResult | null>(null)
  const [summary, setSummary] = useState({ clean: 0, best: 0 })
  const tally = useRef({ answered: 0, clean: 0, score: 0, streak: 0, best: 0 })

  const start = () => {
    store('key-quiz-mode', mode)
    store('key-quiz-level', level.id)
    tally.current = { answered: 0, clean: 0, score: 0, streak: 0, best: 0 }
    setQuestion(makeKeyQuestion(level, null))
    setQIndex(0)
    setScore(0)
    setStreak(0)
    setFinish(null)
    setPhase('play')
  }

  const answered = (right: boolean) => {
    const t = tally.current
    t.answered++
    t.streak = right ? t.streak + 1 : 0
    t.best = Math.max(t.best, t.streak)
    if (right) {
      t.clean++
      t.score += 100 + 10 * Math.min(t.streak, 5)
    }
    setScore(t.score)
    setStreak(t.streak)
  }

  const next = () => {
    const t = tally.current
    if (t.answered >= ROUND) {
      setFinish(finishGame('key-quiz', level.id, t.score, starsFor(t.clean / ROUND, 0.9, 0.7)))
      setSummary({ clean: t.clean, best: t.best })
      setPhase('done')
      return
    }
    setQuestion((q) => makeKeyQuestion(level, q?.fifths ?? null))
    setQIndex(t.answered)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/practice" title="Key Signature Quiz" subtitle={phase === 'setup' ? 'Sharps, flats and the keys they make' : level.name} />
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
            onStart={start}
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
          </SetupCard>
        </GameMain>
      )}
      {phase === 'play' && question && (
        <GameMain>
          <Hud step={qIndex} total={ROUND} score={score} streak={streak} />
          <Question key={qIndex} q={question} mode={mode} grand={level.grand} onAnswer={answered} onNext={next} />
        </GameMain>
      )}
      {phase === 'done' && (
        <GameMain>
          <ResultsCard
            title={summary.clean >= 9 ? 'Key master!' : 'Round complete'}
            score={score}
            stars={starsFor(summary.clean / ROUND, 0.9, 0.7)}
            result={finish}
            stats={[
              { label: 'Correct', value: `${summary.clean}/${ROUND}` },
              { label: 'Best streak', value: summary.best },
              { label: 'Mode', value: mode === 'name' ? 'Name it' : 'Find it' },
            ]}
            onAgain={start}
            onSetup={() => setPhase('setup')}
          />
        </GameMain>
      )}
    </div>
  )
}

function Question({ q, mode, grand, onAnswer, onNext }: { q: KeyQuestion; mode: KeyMode; grand: boolean; onAnswer: (right: boolean) => void; onNext: () => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const right = picked === q.answer

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    const ok = i === q.answer
    onAnswer(ok)
    if (ok) {
      sfx('correct')
      burst(cardRef.current, { count: 28 })
      window.setTimeout(onNext, 1900)
    } else sfx('wrong')
  }

  const modeWord = q.key.mode === 'minor' ? 'minor' : 'major'
  return (
    <motion.div ref={cardRef} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
      {mode === 'name' ? (
        <>
          <div className="glass flex flex-col items-center gap-3 rounded-3xl p-5 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Which {modeWord} key is this?</h2>
            <div className="paper w-full max-w-md rounded-3xl px-4 py-2">
              <Staff clef={grand ? 'grand' : 'treble'} items={[]} keySig={q.fifths} sp={grand ? 20 : 26} className="flex justify-center" reserveAbove={1.5} reserveBelow={1.5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((o, i) => (
              <OptionButton key={o.label} state={picked === null ? 'idle' : i === q.answer ? 'right' : i === picked ? 'wrong' : 'off'} onClick={() => choose(i)}>
                <span className="font-display text-2xl font-bold">
                  <MusicText text={o.label} />
                </span>
              </OptionButton>
            ))}
          </div>
        </>
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
        </>
      )}
      <FeedbackLine tone={picked === null ? 'neutral' : right ? 'good' : 'bad'} id={picked === null ? 'q' : 'a'}>
        {picked === null ? (mode === 'name' ? 'Count the sharps or flats, then use the trick.' : 'Picture the signature, then find it.') : right ? 'Correct!' : 'Not quite.'}
      </FeedbackLine>
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
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={state === 'idle' ? { scale: 0.96 } : undefined}
      animate={state === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : state === 'right' ? { scale: [1, 1.05, 1] } : {}}
      className={`flex min-h-20 items-center justify-center rounded-2xl border-2 p-3 transition-colors ${
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
    </motion.button>
  )
}
