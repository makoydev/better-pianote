import { ArrowRight, Check, Ear, Eraser, Music2, Repeat, Smile, Volume2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react'
import { MicPrompt } from '../../components/layout/MicPrompt'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Button } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/controls'
import { useHandsFree } from '../../hooks/useHandsFree'
import { useSpaceKey } from '../../components/widgets/fit'
import { playNotes } from '../../lib/audio/play'
import { burst } from '../../lib/fx'
import { heldNow, useNoteEvents } from '../../lib/input/bus'
import { useMicChords } from '../../lib/input/mic'
import { chordTones, enharmonicLabel, fromMidi, noteName, pitchName } from '../../lib/theory'
import { usePref } from '../../state/prefs'
import {
  ECHO_LEVELS,
  type EarMode,
  type EarOutcome,
  type EarQuestion,
  type EchoQ,
  INTERVAL_LEVELS,
  type IntervalQ,
  type Played,
  QUALITY_LABEL,
  QUALITY_LEVELS,
  type QualityQ,
  describeMiss,
  earItemId,
  earItemIds,
  earItemName,
  intervalCue,
  intervalName,
  intervalSpelling,
  makeEcho,
  makeInterval,
  makeQuality,
  optionNotes,
  qualityChord,
  qualityName,
  qualityNotes,
  readPlayed,
  rightOption,
  samePitchClass,
} from './logic/ear'
import { FeedbackLine, GameMain, Hud, KeysCard, type Miss, MissList, ResultsCard, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame, remember, sfx, starsFor } from './shared/finish'
import { useItemStats, usePracticeStats, weigher } from './shared/stats'
import { drillRound, msSince, weakest } from './shared/weak'
import type { WorkoutPart } from './shared/workout'

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

/** A mode's level until you pick one: the one you last played there (from before levels were kept per mode), or its first. */
function firstLevel(mode: EarMode): string {
  const ids = levelsFor(mode).map((l) => l.id)
  return remember('ear-level', ids[0], ids)
}

/**
 * A question at a level: the one a drill planned, otherwise a new one (weak spots more often), not the same as the
 * question before.
 */
function questionFor(mode: EarMode, levelId: string, prev: EarQuestion | null, planned?: string | EchoQ): EarQuestion {
  const { quality, interval, echo, itemIds } = levelParts(mode, levelId)
  if (mode === 'echo') return typeof planned === 'object' ? planned : makeEcho(echo)
  const weight = typeof planned === 'string' ? (id: string) => (id === planned ? 1 : 0) : weigher('ear', itemIds)
  if (mode === 'quality') return makeQuality(quality, prev?.kind === 'quality' ? prev : null, Math.random, weight)
  return makeInterval(interval, prev?.kind === 'interval' ? prev : null, Math.random, weight)
}

/** A level's question settings per mode, and the items it keeps weak spots on. */
function levelParts(mode: EarMode, levelId: string) {
  const lid = levelId.slice(mode.length + 1)
  const quality = QUALITY_LEVELS.find((l) => l.id === lid) ?? QUALITY_LEVELS[0]
  const interval = INTERVAL_LEVELS.find((l) => l.id === lid) ?? INTERVAL_LEVELS[0]
  const echo = ECHO_LEVELS.find((l) => l.id === lid) ?? ECHO_LEVELS[0]
  return { quality, interval, echo, itemIds: mode === 'quality' ? earItemIds(quality) : mode === 'interval' ? earItemIds(interval) : [] }
}

/** What a question reports when it's answered (the game adds the question itself). */
type Answer = Omit<EarOutcome, 'question'>

/**
 * Play notes the way a question asks them: a chord broken then together, an interval one after the other
 * or together, a tune note by note. Returns how long it takes, in seconds.
 */
function playAs(q: EarQuestion, notes: number[], delay = 0): number {
  const sequence = (gap: number, dur: number) => {
    notes.forEach((n, i) => playNotes([n], { dur, delay: delay + i * gap }))
    return notes.length * gap + dur
  }
  if (q.kind === 'quality') {
    sequence(0.32, 1.1)
    playNotes(notes, { dur: 1.8, delay: delay + 1.05 })
    return 1.05 + 1.8
  }
  if (q.kind === 'interval' && q.harmonic) {
    playNotes(notes, { dur: 1.8, delay })
    return 1.8
  }
  return q.kind === 'interval' ? sequence(0.75, 1.3) : sequence(0.55, 0.8)
}

/** The chord on the keys, each tone named as it's spelled in that chord (G♯ minor: G♯ B D♯). */
function chordMarks(q: QualityQ): Marks {
  const c = qualityChord(q)
  const tones = chordTones(c.root, c.type)
  return Object.fromEntries(qualityNotes(q).map((m, i) => [m, { kind: i === 0 ? 'root' : 'chord', label: pitchName(tones[i]) }]))
}

/** The interval's two keys, named as that interval (D♭–F for a major 3rd, not C♯–F). */
function intervalMarks(q: IntervalQ): Marks {
  const [low, top] = intervalSpelling(q.low, q.semis)
  return { [q.low]: { kind: 'root', label: pitchName(low) }, [q.low + q.semis]: { kind: 'chord', label: pitchName(top) } }
}

/** "G3", or both names of a black key: "C♯4 / D♭4" (before the answer, either could be the one it's spelled as). */
function bothNames(m: number): string {
  const sharp = noteName(fromMidi(m, 'sharp'))
  const flat = noteName(fromMidi(m, 'flat'))
  return sharp === flat ? sharp : `${sharp} / ${flat}`
}

/** A miss for the results list; tapping it plays the right answer, then yours. */
function toMiss(o: EarOutcome): Miss {
  const q = o.question
  const { asked, said } = describeMiss(o)
  const right = q.kind === 'echo' ? q.notes : optionNotes(q, rightOption(q))
  const yours = q.kind === 'echo' ? o.played : o.said === undefined ? undefined : optionNotes(q, o.said)
  return {
    asked,
    verb: q.kind !== 'echo' ? 'you said' : said ? 'you played' : 'you tapped Show me',
    said,
    onPlay: () => {
      const secs = playAs(q, right)
      if (yours?.length) playAs(q, yours, secs + 0.4)
    },
  }
}

/** The game, or (`workout`) a few questions of it, in the mode and level you last played, as a part of the daily workout. */
export function EarTraining({ workout }: { workout?: WorkoutPart } = {}) {
  const size = workout?.size ?? ROUND
  // In the workout the questions start straight away, in the mode and at the level you last played.
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>(workout ? 'play' : 'setup')
  const [mode, setMode] = usePref<EarMode>('ear-mode', 'quality', ['quality', 'interval', 'echo'])
  const levels = levelsFor(mode)
  // Each mode remembers its own level, so switching modes doesn't reset it.
  const [levelId, setLevelId] = usePref(`ear-level:${mode}`, firstLevel(mode), levels.map((l) => l.id))
  const level = levels.find((l) => l.id === levelId) ?? levels[0]
  // Answer on the keys instead of tapping (Echo always is).
  const [byPlaying, setByPlaying] = usePref('ear:play', false)
  const [question, setQuestion] = useState<EarQuestion | null>(() => (workout ? questionFor(mode, level.id, null) : null))
  // Which question we're on (changes on "next", so answering doesn't remount the question).
  const [qIndex, setQIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<EarOutcome[]>([])
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [finish, setFinish] = useState<FinishResult | null>(null)
  // Answers can arrive from timers, so the running tally lives in a ref too.
  const tally = useRef({ outcomes: [] as EarOutcome[], score: 0, streak: 0, best: 0 })
  // A drill's questions, planned up front: item ids ("quality:min"), or for Echo the tunes themselves.
  const plan = useRef<(string | EchoQ)[] | null>(null)
  const [drill, setDrill] = useState(false)
  const stats = useItemStats('ear')

  const parts = levelParts(mode, level.id)

  const makeQuestion = (prev: EarQuestion | null, i: number, levelId = level.id) => questionFor(mode, levelId, prev, plan.current?.[i])

  const start = (drillPlan: (string | EchoQ)[] | null = null, levelId = level.id) => {
    plan.current = drillPlan
    setDrill(!!drillPlan)
    tally.current = { outcomes: [], score: 0, streak: 0, best: 0 }
    setQuestion(makeQuestion(null, 0, levelId))
    setQIndex(0)
    setOutcomes([])
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setFinish(null)
    setPhase('play')
  }

  /** A round built from the questions you just missed. */
  const drillMissed = () => {
    const missed = outcomes.filter((o) => !o.clean).map((o) => o.question)
    if (mode === 'echo') {
      const fresh = Array.from({ length: size }, () => makeEcho(parts.echo))
      return start(drillRound(missed as EchoQ[], fresh, size, () => 1, (q) => q.notes.join('-')))
    }
    const ids = missed.flatMap((q) => earItemId(q) ?? [])
    // With two or four answers, a strict back-and-forth would give it away, so repeats are allowed.
    start(drillRound(ids, parts.itemIds, size, weigher('ear', parts.itemIds), (id) => id, Math.random, mode === 'quality'))
  }

  const answered = (o: EarOutcome) => {
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
    if (t.outcomes.length >= size) {
      const clean = t.outcomes.filter((o) => o.clean).length
      usePracticeStats.getState().recordAnswers(
        'ear',
        t.outcomes.flatMap((o) => {
          const id = earItemId(o.question)
          return id ? [{ id, missed: !o.clean, ms: o.clean ? o.ms : undefined }] : []
        }),
      )
      if (workout) return workout.onDone({ score: clean / size, stars: starsFor(clean / size, 0.9, 0.7), detail: `${clean} of ${size} right first time` })
      setFinish(finishGame('ear', drill ? null : level.id, t.score, starsFor(clean / size, 0.9, 0.7), { accuracy: (clean / size) * 100 }))
      setPhase('done')
      return
    }
    setQuestion((q) => makeQuestion(q, t.outcomes.length))
    setQIndex(t.outcomes.length)
  }

  const modeInfo = MODES.find((m) => m.id === mode)!
  const qualityOptions = parts.quality.types.map((t) => t.id)
  const clean = outcomes.filter((o) => o.clean).length
  const stars = starsFor(clean / size, 0.9, 0.7)
  const nextLevel = levels[levels.findIndex((l) => l.id === level.id) + 1]

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        back="/practice"
        title={workout ? 'Daily workout' : 'Ear Training'}
        subtitle={
          workout
            ? `${workout.step} · ${modeInfo.title} · ${level.name}`
            : phase === 'setup'
              ? 'Train the ear you already have'
              : `${drill ? 'Drill · ' : ''}${modeInfo.title} · ${level.name}`
        }
      />
      {/* A keyboard takes the height that's left, so the page only scrolls on very short screens. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {phase === 'setup' && !workout && (
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
              onStart={() => start()}
              weakest={weakest(stats, parts.itemIds).map(earItemName)}
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
                      onClick={() => setMode(m.id)}
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
              {mode !== 'echo' && (
                <label className="glass flex items-center justify-between gap-4 rounded-3xl p-4 pl-5">
                  <span>
                    <span className="block text-lg font-extrabold">Answer by playing</span>
                    <span className="text-sm text-ink-mute">
                      {mode === 'quality'
                        ? 'Play the chord you hear on the root it shows, on your keyboard or on screen.'
                        : 'Play the top note: the low one is shown on the keys.'}
                    </span>
                  </span>
                  <Toggle checked={byPlaying} onChange={setByPlaying} label="Answer by playing" />
                </label>
              )}
            </SetupCard>
          </GameMain>
        )}
        {phase === 'play' && question && (
          <GameMain wide={mode === 'echo'} fill>
            <Hud step={qIndex} total={size} score={score} streak={streak} />
            {question.kind === 'quality' && (
              <ChoiceQuestion
                key={qIndex}
                title="Major or minor?"
                prompt="Is this chord happy, sad… or something stranger?"
                play={() => playAs(question, qualityNotes(question))}
                options={qualityOptions.map((id) => ({ id, label: QUALITY_LABEL[id] }))}
                answer={rightOption(question)}
                hear={(id) => playAs(question, optionNotes(question, id))}
                reveal={() => <MusicText text={qualityName(question)} />}
                keyboard={byPlaying ? { from: 48, to: 84, marks: chordMarks(question) } : undefined}
                byPlaying={
                  byPlaying
                    ? {
                        given: question.root,
                        chord: true,
                        ask: `Play the chord on ${enharmonicLabel(question.root)}, or tap an answer.`,
                        stray: `That’s not one of the chords on ${enharmonicLabel(question.root)}.`,
                        read: (notes, latest, viaMic) => readPlayed(question, notes, latest, qualityOptions, viaMic),
                      }
                    : undefined
                }
                onAnswer={(a) => answered({ ...a, question })}
                onNext={next}
              />
            )}
            {question.kind === 'interval' && (
              <ChoiceQuestion
                key={qIndex}
                title="Name the interval"
                prompt={question.harmonic ? 'Two notes played together. How far apart?' : 'Two notes, low then high. How far apart?'}
                play={() => playAs(question, optionNotes(question, rightOption(question)))}
                options={parts.interval.semis.map((s) => ({ id: String(s), label: intervalName(s) }))}
                answer={rightOption(question)}
                // Played the way the question was: together for a harmonic interval.
                hear={(id) => playAs(question, optionNotes(question, id))}
                reveal={() => (
                  <span>
                    {intervalName(question.semis)} · {question.semis} half step{question.semis > 1 ? 's' : ''}
                    {intervalCue(question.semis) && <span className="mt-1 block text-base font-bold text-ink-soft">Like {intervalCue(question.semis)}</span>}
                  </span>
                )}
                keyboard={{ from: 48, to: 84, marks: intervalMarks(question) }}
                byPlaying={
                  byPlaying
                    ? {
                        given: question.low,
                        chord: false,
                        ask: `Play the top note, above ${bothNames(question.low)}, or tap an answer.`,
                        stray: `Play a note above ${bothNames(question.low)}, at most an octave higher.`,
                        read: (notes, latest) => readPlayed(question, notes, latest, parts.interval.semis.map(String)),
                      }
                    : undefined
                }
                onAnswer={(a) => answered({ ...a, question })}
                onNext={next}
              />
            )}
            {question.kind === 'echo' && <EchoQuestion key={qIndex} q={question} onAnswer={(a) => answered({ ...a, question })} onNext={next} />}
          </GameMain>
        )}
        {phase === 'done' && (
          <GameMain>
            <ResultsCard
              title={drill ? 'Drill done!' : clean >= 9 ? 'Golden ears!' : clean >= 7 ? 'Great listening!' : 'Round complete'}
              score={score}
              stars={stars}
              result={finish}
              stats={[
                { label: 'First try', value: `${clean}/${size}` },
                { label: 'Correct', value: `${outcomes.filter((o) => o.correct).length}/${size}` },
                { label: 'Best streak', value: bestStreak },
              ]}
              historyKey={drill ? undefined : `ear:${level.id}`}
              // Three stars: on to the next level of this kind, straight away.
              next={
                stars === 3 && !drill && nextLevel
                  ? {
                      label: `Next level: ${nextLevel.name}`,
                      onClick: () => {
                        setLevelId(nextLevel.id)
                        start(null, nextLevel.id)
                      },
                    }
                  : undefined
              }
              onAgain={() => start()}
              onSetup={() => setPhase('setup')}
            >
              <MissList misses={outcomes.filter((o) => !o.clean).map(toMiss)} onDrill={drillMissed} />
            </ResultsCard>
          </GameMain>
        )}
      </div>
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
  // Space hears it again, like the big button.
  useSpaceKey(run, true)
  useEffect(() => {
    // Play each new question once it appears (the cleanup cancels the duplicate in dev strict mode).
    const t = window.setTimeout(autoPlay, 350)
    return () => window.clearTimeout(t)
  }, [autoKey])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { playing, run }
}

/** Answering on the keys: the note you're given, and how to read what you play as an answer. */
interface ByPlaying {
  /** The root (or the interval's low note), marked on the keyboard. */
  given: number
  /** A chord: build it (tap keys on screen to select them; the mic listens for chords). Otherwise one note. */
  chord: boolean
  /** What to do, said until you play. */
  ask: string
  /** Said when what you play can't be an answer. */
  stray: string
  read: (notes: number[], latest: number, viaMic: boolean) => Played
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
  byPlaying,
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
  /** The answer on the keys, shown once it's answered. */
  keyboard?: { from: number; to: number; marks: Marks }
  byPlaying?: ByPlaying
  onAnswer: (a: Answer) => void
  onNext: () => void
}) {
  const [wrongs, setWrongs] = useState<string[]>([])
  const [result, setResult] = useState<null | 'clean' | 'second' | 'missed'>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { playing, run } = usePlayback(play, `${title}-${answer}-${options.length}`)
  // Two choices: one guess. More choices: two guesses.
  const maxWrong = options.length <= 2 ? 1 : 2
  const shownAt = useRef(0)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [])
  // Playing an answer: keys selected on screen, keys still held from an answer already given (they don't count
  // until they're let go), and what the last notes said ("2 of 3 notes…").
  const [selected, setSelected] = useState<number[]>([])
  const selectedRef = useRef<number[]>([])
  const stale = useRef(new Set(heldNow()))
  const [heard, setHeard] = useState<{ text: string; tone: 'neutral' | 'info'; id: string } | null>(null)
  useMicChords(!!byPlaying?.chord && !result)
  // Hands-free Next once it's answered (a first-try answer moves on by itself); while notes are answers, none.
  useHandsFree(result && result !== 'clean' ? onNext : null)

  const choose = (id: string) => {
    if (result) {
      // Afterwards, tapping an option plays it, so you can compare sounds.
      hear(id)
      return
    }
    setHeard(null)
    if (id === answer) {
      const clean = wrongs.length === 0
      setResult(clean ? 'clean' : 'second')
      sfx('correct')
      burst(cardRef.current, { count: 30 })
      onAnswer({ correct: true, clean, said: wrongs[0], ms: msSince(shownAt.current) })
      if (clean) window.setTimeout(onNext, 1500)
      return
    }
    if (wrongs.includes(id)) return
    sfx('wrong')
    const w = [...wrongs, id]
    setWrongs(w)
    if (w.length >= maxWrong) {
      setResult('missed')
      onAnswer({ correct: false, clean: false, said: w[0] })
    }
  }

  /** What you're playing, read as an answer: one counts just like a tap (a wrong one too). */
  const judge = (latest: number, viaMic: boolean) => {
    if (!byPlaying || result) return
    const notes = [...new Set([...heldNow().filter((m) => !stale.current.has(m)), ...selectedRef.current])]
    const r = byPlaying.read(notes, latest, viaMic)
    if ('id' in r) {
      // The next answer starts from fresh keys.
      for (const m of heldNow()) stale.current.add(m)
      selectedRef.current = []
      setSelected([])
      choose(r.id)
    } else if ('stray' in r) {
      const text = r.said ? `That’s ${/^[aeiou]/.test(r.said) ? 'an' : 'a'} ${r.said}: not one of these.` : byPlaying.stray
      setHeard({ text, tone: 'info', id: `stray${latest}-${notes.join('-')}` })
    }
    else if (byPlaying.chord) setHeard({ text: `${r.partial} of ${r.of} notes… keep going.`, tone: 'neutral', id: `part${r.partial}` })
    else setHeard({ text: 'Now the top note.', tone: 'neutral', id: 'top' })
  }

  useNoteEvents((e) => {
    if (!byPlaying || result) return
    if (e.type === 'off') {
      stale.current.delete(e.midi)
      return
    }
    judge(e.midi, e.source === 'mic')
  })

  const toggle = (m: number) => {
    if (result) return
    const had = selectedRef.current.includes(m)
    selectedRef.current = had ? selectedRef.current.filter((x) => x !== m) : [...selectedRef.current, m]
    setSelected(selectedRef.current)
    if (!had) judge(m, false)
  }

  const clear = () => {
    selectedRef.current = []
    setSelected([])
    setHeard(null)
  }

  const live: Marks = {}
  if (byPlaying) live[byPlaying.given] = 'target'
  for (const m of selected) live[m] = 'selected'
  const many = options.length > 6
  const grid = options.length <= 4 ? (byPlaying ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2') : many ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <QuestionCard cardRef={cardRef} title={title} prompt={prompt} replay={<ReplayButton onClick={run} playing={playing} />}>
        <FeedbackLine
          start
          tone={result === 'clean' ? 'good' : result === 'second' ? 'info' : result === 'missed' ? 'bad' : heard ? heard.tone : wrongs.length ? 'bad' : 'neutral'}
          id={result ?? heard?.id ?? wrongs.length}
        >
          {result ? (
            reveal()
          ) : heard ? (
            <MusicText text={heard.text} />
          ) : wrongs.length ? (
            'Not that one. Listen again and try another.'
          ) : (
            <MusicText text={byPlaying ? byPlaying.ask : 'Tap the speaker to hear it again.'} />
          )}
        </FeedbackLine>
        {result && result !== 'clean' && (
          <Button size="lg" iconRight={ArrowRight} onClick={onNext}>
            Next
          </Button>
        )}
        {byPlaying?.chord && !result && selected.length > 0 && (
          <Button variant="ghost" size="md" icon={Eraser} onClick={clear}>
            Clear
          </Button>
        )}
      </QuestionCard>
      <div className={`grid gap-3 ${grid}`}>
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
              className={`rounded-2xl border-2 px-4 font-extrabold transition-colors ${byPlaying || many ? 'min-h-14 py-2 text-lg' : 'min-h-16 py-3 text-xl'} ${
                isAnswer
                  ? 'border-good bg-good/20 text-good'
                  : isWrong
                    ? 'border-bad/70 bg-bad/12 text-bad'
                    : result
                      ? 'border-white/8 bg-night-800 text-ink-mute'
                      : 'border-white/10 bg-night-750 text-ink hover:border-white/30'
              }`}
            >
              {/* A tick or cross as well as the colour, so right and wrong don't rely on colour alone. */}
              <span className="inline-flex items-center justify-center gap-2">
                {isAnswer && <Check size={22} strokeWidth={3} aria-hidden />}
                {isWrong && <X size={22} strokeWidth={3} aria-hidden />}
                {o.label}
                {(isAnswer || isWrong) && <span className="sr-only">{isAnswer ? '(right answer)' : '(wrong)'}</span>}
              </span>
              {result && (isAnswer || isWrong) && (
                <span className="mt-0.5 flex items-center justify-center gap-1 text-xs font-bold opacity-80">
                  <Volume2 size={13} /> tap to hear
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
      {(byPlaying || (result && keyboard)) && (
        <KeysCard top={byPlaying && <MicPrompt />} max={byPlaying ? 200 : 170}>
          {(fit) =>
            result && keyboard ? (
              <Piano from={keyboard.from} to={keyboard.to} marks={keyboard.marks} labels="marked" height={fit.keys} />
            ) : (
              <Piano
                from={48}
                to={84}
                marks={live}
                labels="c"
                mode={byPlaying?.chord ? 'toggle' : 'play'}
                onToggle={toggle}
                sparks
                sparkHeight={fit.sparks}
                height={fit.keys}
              />
            )
          }
        </KeysCard>
      )}
    </div>
  )
}

/** The question: the big replay button, then its title, prompt and feedback (beside the button on wider screens). */
function QuestionCard({ cardRef, title, prompt, replay, children }: { cardRef: RefObject<HTMLDivElement | null>; title: string; prompt: ReactNode; replay: ReactNode; children: ReactNode }) {
  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-col items-center gap-4 rounded-3xl p-5 text-center sm:flex-row sm:gap-7 sm:p-6 sm:text-left"
    >
      {replay}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>
        <p className="text-lg text-ink-soft">{prompt}</p>
        {children}
      </div>
    </motion.div>
  )
}

function EchoQuestion({ q, onAnswer, onNext }: { q: EchoQ; onAnswer: (a: Answer) => void; onNext: () => void }) {
  const { notes } = q
  const [pos, setPos] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [state, setState] = useState<'listening' | 'solved' | 'revealed'>('listening')
  const [shake, setShake] = useState(0)
  const [revealIndex, setRevealIndex] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  // The notes of the try in progress, and your first wrong try (listed on the results).
  const tryNotes = useRef<number[]>([])
  const firstMiss = useRef<number[] | undefined>(undefined)
  const { playing, run } = usePlayback(() => {
    setPos(0)
    tryNotes.current = []
    return playAs(q, notes)
  }, notes.join('-'))
  const first = fromMidi(notes[0])
  // While you're echoing, notes are answers; once it's shown, Enter, a pedal tap or the top C go on.
  useHandsFree(state === 'revealed' ? onNext : null)

  const reveal = () => {
    setState('revealed')
    onAnswer({ correct: false, clean: false, played: firstMiss.current })
    playAs(q, notes)
    notes.forEach((_, i) => window.setTimeout(() => setRevealIndex(i), 50 + i * 550))
    window.setTimeout(() => setRevealIndex(null), notes.length * 550 + 400)
  }

  useNoteEvents((e) => {
    if (e.type !== 'on' || state !== 'listening') return
    if (samePitchClass(e.midi, notes[pos])) {
      tryNotes.current.push(e.midi)
      const next = pos + 1
      setPos(next)
      if (next === notes.length) {
        setState('solved')
        sfx('correct')
        burst(cardRef.current, { count: 36 })
        onAnswer({ correct: true, clean: attempts === 0, played: firstMiss.current })
        window.setTimeout(onNext, 1500)
      }
    } else {
      if (!firstMiss.current) firstMiss.current = [...tryNotes.current, e.midi]
      tryNotes.current = []
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <QuestionCard
        cardRef={cardRef}
        title="Echo"
        prompt={
          <>
            Listen, then play it back. It starts on{' '}
            <b className="text-gold">
              <MusicText text={pitchName(first)} />
            </b>{' '}
            (any octave is fine).
          </>
        }
        replay={<ReplayButton onClick={run} playing={playing} />}
      >
        <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="flex gap-3 py-1">
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
        <FeedbackLine start tone={state === 'solved' ? 'good' : state === 'revealed' ? 'info' : attempts ? 'bad' : 'neutral'} id={`${state}-${attempts}`}>
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
        {state === 'listening' && (
          <Button variant="ghost" size="md" onClick={reveal}>
            Show me
          </Button>
        )}
        {state === 'revealed' && (
          <Button size="lg" iconRight={ArrowRight} onClick={onNext}>
            Next
          </Button>
        )}
      </QuestionCard>
      <KeysCard top={<MicPrompt />}>
        {(fit) => <Piano from={48} to={84} marks={marks} sparks sparkHeight={fit.sparks} labels="c" height={fit.keys} />}
      </KeysCard>
    </div>
  )
}
