import { Flame, Hand, Keyboard, Pause, Play, SkipForward, Timer, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { MicPrompt } from '../../components/layout/MicPrompt'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Staff } from '../../components/staff/Staff'
import { StaffSvg } from '../../components/staff/StaffSvg'
import type { Layout } from '../../components/staff/layout'
import { Button, IconButton } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { Segmented, Toggle } from '../../components/ui/controls'
import { useElementSize } from '../../hooks/useElementSize'
import { audio } from '../../lib/audio/engine'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { burst } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { pauseComputerKeys } from '../../lib/input/keys'
import { LETTERS, keyName, majorKey, mod, pitchName } from '../../lib/theory'
import { usePref } from '../../state/prefs'
import { useSettings } from '../../state/settings'
import {
  LEVELS,
  RUSH_KEYS,
  type RushChoice,
  type RushClef,
  type RushKey,
  type RushLevel,
  type RushNote,
  isCorrect,
  keyHint,
  keyboardRange,
  levelDetail,
  makeRound,
  multiplier,
  nameMatches,
  prettyName,
  rushChoices,
  rushGroup,
  rushItemId,
  rushShare,
  rushStars,
} from './noteRush/logic'
import { tapeLayout } from './noteRush/tape'
import { DrillButton, GameMain, ResultsCard, type ResultsAction, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame } from './shared/finish'
import { useItemStats, usePracticeStats, weigher } from './shared/stats'
import { type ItemAnswer, drillWeight, weakest } from './shared/weak'
import type { WorkoutPart } from './shared/workout'

type Phase = 'setup' | 'countdown' | 'play' | 'results'
type Mode = 'play' | 'name'

interface Config {
  clef: RushClef
  level: RushLevel
  mode: Mode
  /** Key signature: sharps (+) or flats (−). */
  key: RushKey
}

interface Result {
  score: number
  correct: number
  wrong: number
  bestCombo: number
  avgMs: number
  /** Misses per note, by clef and name ("treble:F#4"). */
  missed: Record<string, number>
  stars: number
  /** Null when the round isn't kept (nothing right). */
  finish: FinishResult | null
  /** A drill of notes missed before. */
  drill: boolean
}

const ROUND_MS = 60_000
const SP = 20

/** The game, or (`workout`) a round of it at your level as a part of the daily workout, straight after the count. */
export function NoteRush({ workout }: { workout?: WorkoutPart } = {}) {
  const [phase, setPhase] = useState<Phase>(workout ? 'countdown' : 'setup')
  // Clef, level, how you answer and the key signature are remembered between visits.
  const [clef, setClef] = usePref<RushClef>('note-rush:clef', 'treble', ['treble', 'bass', 'grand'])
  const [level, setLevel] = usePref<RushLevel>('note-rush:level', 1, [1, 2, 3, 4, 5])
  const [mode, setMode] = usePref<Mode>('note-rush:mode', 'play', ['play', 'name'])
  const [key, setKey] = usePref<RushKey>('note-rush:key', 0, RUSH_KEYS)
  const config: Config = { clef, level, mode, key }
  const [result, setResult] = useState<Result | null>(null)
  const [runId, setRunId] = useState(0)
  // The notes a drill is made of ("treble:F#4"), or null for a normal round.
  const [drill, setDrill] = useState<string[] | null>(null)
  const stats = useItemStats('note-rush')

  const start = (drillIds: string[] | null = null) => {
    setDrill(drillIds)
    setRunId((r) => r + 1)
    setPhase('countdown')
  }

  const where = [drill ? 'Drill' : '', LEVELS[level - 1].title, clef === 'grand' ? 'both clefs' : `${clef} clef`, key ? keyName(majorKey(key)) : '']
    .filter(Boolean)
    .join(' · ')
  const weak = phase === 'setup' ? weakest(stats, rushChoices(clef, level, key).map(rushItemId)).map((id) => missLabel(id, clef)) : []

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        back="/practice"
        title={workout ? 'Daily workout' : 'Note Rush'}
        subtitle={<MusicText text={workout ? `${workout.step} · Note Rush · ${where}` : phase === 'setup' ? 'Sight-reading sprint' : where} />}
      />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {phase === 'setup' && (
          <GameMain>
            <SetupCard
              icon={Zap}
              from="#5cc8ff"
              to="#9b8cff"
              title="Note Rush"
              blurb="60 seconds. Read each note and play it, or name it. Streaks build your multiplier."
              gameId={`note-rush:${rushGroup(clef, key)}`}
              metric="score"
              levels={LEVELS.map((l) => ({ id: String(l.level), name: l.title, description: levelDetail(l.level, key) }))}
              level={String(level)}
              onLevel={(id) => setLevel(Number(id) as RushLevel)}
              onStart={() => start()}
              weakest={weak}
            >
              <RushOptions config={config} setClef={setClef} setMode={setMode} setKey={setKey} />
            </SetupCard>
          </GameMain>
        )}
        {phase === 'countdown' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'play' && (
          <Round
            key={runId}
            config={config}
            drill={drill}
            ms={workout ? workout.size * 1000 : ROUND_MS}
            save={!workout}
            onFinish={(r) => {
              if (workout) return workout.onDone({ score: rushShare(r.correct, r.wrong), stars: r.stars, detail: `${r.correct} notes right` })
              setResult(r)
              setPhase('results')
            }}
          />
        )}
        {phase === 'results' && result && (
          <GameMain>
            <Results
              result={result}
              clef={clef}
              historyKey={result.drill ? undefined : `note-rush:${rushGroup(clef, key)}:${level}`}
              // Three stars: on to the next level, straight away.
              next={
                result.stars === 3 && !result.drill && level < 5
                  ? {
                      label: `Next level: ${LEVELS[level].title}`,
                      onClick: () => {
                        setLevel((level + 1) as RushLevel)
                        start()
                      },
                    }
                  : undefined
              }
              onAgain={() => start()}
              onDrill={start}
              onSetup={() => setPhase('setup')}
            />
          </GameMain>
        )}
      </div>
    </div>
  )
}

function Field({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="px-1 text-sm font-extrabold uppercase tracking-wider text-ink-mute">{label}</span>
      {children}
      {note && <span className="px-1 text-sm font-semibold text-ink-mute">{note}</span>}
    </div>
  )
}

function RushOptions({
  config,
  setClef,
  setMode,
  setKey,
}: {
  config: Config
  setClef: (c: RushClef) => void
  setMode: (m: Mode) => void
  setKey: (k: RushKey) => void
}) {
  const strict = useSettings((s) => s.strictOctave)
  const set = useSettings((s) => s.set)
  return (
    <div className="glass grid gap-x-6 gap-y-5 rounded-3xl p-5 md:grid-cols-2">
      <Field label="Clef">
        <Segmented
          className="w-full"
          value={config.clef}
          onChange={setClef}
          options={[
            { value: 'treble', label: 'Treble' },
            { value: 'bass', label: 'Bass' },
            { value: 'grand', label: 'Both' },
          ]}
        />
      </Field>
      <Field label="How to answer">
        <Segmented
          className="w-full"
          value={config.mode}
          onChange={setMode}
          options={[
            {
              value: 'play',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Hand size={18} /> Play it
                </span>
              ),
            },
            {
              value: 'name',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Keyboard size={18} /> Name it
                </span>
              ),
            },
          ]}
        />
      </Field>
      <Field label="Key signature" note={<MusicText text={keyHint(config.key)} />}>
        <Segmented
          className="w-full"
          value={config.key}
          onChange={setKey}
          options={RUSH_KEYS.map((k) => ({ value: k, label: k ? <MusicText text={pitchName(majorKey(k).tonic)} /> : 'None' }))}
        />
      </Field>
      {config.mode === 'play' && (
        <label className="flex items-center justify-between gap-4 self-start rounded-2xl bg-night-850 p-3 pl-4 md:mt-7">
          <span>
            <span className="block font-extrabold">Exact octave</span>
            <span className="text-sm text-ink-mute">Off: any C counts as C. On: it has to be the C that's written.</span>
          </span>
          <Toggle checked={strict} onChange={(v) => set({ strictOctave: v })} label="Exact octave" />
        </label>
      )}
    </div>
  )
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  const done = useEffectEvent(onDone)
  useEffect(() => {
    audio.click(n === 0)
    const id = window.setTimeout(() => (n === 0 ? done() : setN(n - 1)), n === 0 ? 450 : 650)
    return () => window.clearTimeout(id)
  }, [n])
  return (
    <div className="flex h-full items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={n}
          initial={{ scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="font-display text-[10rem] font-bold leading-none text-gradient"
        >
          {n === 0 ? 'Go!' : n}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** One round of `ms`; `save` keeps it as a round of the game (not in the workout, which has its own summary). */
function Round({ config, drill, ms, save, onFinish }: { config: Config; drill: string[] | null; ms: number; save: boolean; onFinish: (r: Result) => void }) {
  const strict = useSettings((s) => s.strictOctave)
  const uiSounds = useSettings((s) => s.uiSounds)
  const round = useMemo(() => {
    const choices = rushChoices(config.clef, config.level, config.key)
    // A drill gives the notes you missed about 60% of the round; otherwise weak and slow notes come up more often.
    const weak = weigher('note-rush', choices.map(rushItemId))
    const weight = drill ? drillWeight(choices, (c) => c.chance, (c) => drill.includes(rushItemId(c))) : (c: RushChoice) => weak(rushItemId(c))
    return makeRound(config.clef, config.level, 260, Math.random, { key: config.key, weight })
  }, [config.clef, config.level, config.key, drill])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [misses, setMisses] = useState(0)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [flash, setFlash] = useState<Record<number, 'good' | 'bad'>>({})
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
  const [acc, setAcc] = useState(0)
  const [left, setLeft] = useState(ms)
  // Notes you skipped, drawn as missed once they slide past.
  const [skipped, setSkipped] = useState<number[]>([])
  const [paused, setPaused] = useState(false)
  const pausedAt = useRef<number | null>(null)
  const missed = useRef<Record<string, number>>({})
  // Each note's outcome, for your weak spots, and whether the note on screen was missed already.
  const answers = useRef<ItemAnswer[]>([])
  const slipped = useRef(false)
  const times = useRef<number[]>([])
  const shownAt = useRef(0)
  const endAt = useRef(Infinity)
  useEffect(() => {
    shownAt.current = performance.now()
    endAt.current = performance.now() + ms
  }, [ms])
  const finished = useRef(false)
  const staffRef = useRef<HTMLDivElement>(null)
  const [lo, hi] = keyboardRange(config.clef, config.level, config.key)
  const current: RushNote = round[i]
  // Sharps and flats to name: level 5's accidentals, or the key signature's.
  const accidentals = config.level === 5 || config.key !== 0

  const finish = () => {
    if (finished.current) return
    finished.current = true
    const stars = rushStars(correct, wrong)
    // A round with nothing right isn't saved: no best or last score, no XP (so no streak either), no weak spots.
    // Otherwise it records "note-rush" and "note-rush:<clef>[:<key>]:<level>" (a drill only the first), with XP on
    // the same scale as the other games. In the workout only the weak spots are kept (its summary has the rest).
    const accuracy = (correct / Math.max(1, correct + wrong)) * 100
    const saved = correct > 0 && save ? finishGame('note-rush', drill ? null : `${rushGroup(config.clef, config.key)}:${config.level}`, score, stars, { accuracy }) : null
    if (correct > 0) {
      // The note on screen when time ran out counts too if you'd already missed it.
      if (slipped.current && current) answers.current.push({ id: rushItemId(current), missed: true })
      usePracticeStats.getState().recordAnswers('note-rush', answers.current)
    }
    const avgMs = times.current.length ? times.current.reduce((a, b) => a + b, 0) / times.current.length : 0
    onFinish({ score, correct, wrong, bestCombo, avgMs, missed: missed.current, stars, finish: saved, drill: !!drill })
  }

  // The clock. While paused it stands still, and resuming moves the end time on by the pause.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedAt.current !== null) return
      const l = endAt.current - performance.now()
      setLeft(Math.max(0, l))
      if (l <= 0) finish()
    }, 100)
    return () => window.clearInterval(id)
  })

  const pause = () => {
    if (finished.current || pausedAt.current !== null) return
    pausedAt.current = performance.now()
    setPaused(true)
  }

  const resume = () => {
    if (pausedAt.current === null) return
    const away = performance.now() - pausedAt.current
    endAt.current += away
    shownAt.current += away
    pausedAt.current = null
    setPaused(false)
  }

  // Switching apps or locking the iPad pauses the round.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause()
    }
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const flashKey = (m: number, kind: 'good' | 'bad') => {
    setFlash((f) => ({ ...f, [m]: kind }))
    window.setTimeout(() => setFlash((f) => {
      const n = { ...f }
      delete n[m]
      return n
    }), 380)
  }

  const miss = (note: RushNote) => {
    const id = rushItemId(note)
    missed.current[id] = (missed.current[id] ?? 0) + 1
  }

  const answer = (ok: boolean, midi?: number) => {
    if (finished.current || pausedAt.current !== null) return
    // The ♭/♯ choice is part of one answer; the next one starts from natural again.
    setAcc(0)
    if (ok) {
      const nextCombo = combo + 1
      const mult = multiplier(nextCombo)
      const gained = 10 * mult
      setScore((s) => s + gained)
      setCombo(nextCombo)
      setBestCombo((b) => Math.max(b, nextCombo))
      setCorrect((c) => c + 1)
      setPop({ id: performance.now(), text: `+${gained}` })
      const took = performance.now() - shownAt.current
      times.current.push(took)
      answers.current.push({ id: rushItemId(current), missed: slipped.current, ms: slipped.current ? undefined : took })
      slipped.current = false
      shownAt.current = performance.now()
      setMisses(0)
      setI((x) => x + 1)
      if (midi !== undefined) flashKey(midi, 'good')
      if (uiSounds && config.mode === 'name') audio.ui('tap')
      if (multiplier(nextCombo) > multiplier(combo)) burst(staffRef.current, { count: 30 })
    } else {
      setCombo(0)
      setWrong((w) => w + 1)
      setMisses((m) => m + 1)
      setWrongFlash(true)
      window.setTimeout(() => setWrongFlash(false), 380)
      miss(current)
      slipped.current = true
      if (midi !== undefined) flashKey(midi, 'bad')
      if (uiSounds) audio.ui('wrong')
    }
  }

  // Skip: on to the next note. It counts as missed and breaks the combo.
  const skip = () => {
    if (finished.current || pausedAt.current !== null || !current) return
    setAcc(0)
    setCombo(0)
    setWrong((w) => w + 1)
    setMisses(0)
    miss(current)
    answers.current.push({ id: rushItemId(current), missed: true })
    slipped.current = false
    setSkipped((s) => [...s, i])
    shownAt.current = performance.now()
    setI((x) => x + 1)
  }

  useNoteEvents((e) => {
    if (e.type !== 'on') return
    // A note ends a pause; it doesn't answer.
    if (pausedAt.current !== null) {
      resume()
      return
    }
    if (config.mode !== 'play' || !current) return
    answer(isCorrect(current, e.midi, strict), e.midi)
  })

  // Name mode: letter keys answer, so they stop playing notes meanwhile.
  useEffect(() => (config.mode === 'name' ? pauseComputerKeys() : undefined), [config.mode])

  // Keys: any key ends a pause, Space skips, and in name mode the letters answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A held key repeats, and ⌘C is a copy, not an answer.
      if (!isPlainKey(e)) return
      const space = e.code === 'Space'
      if (pausedAt.current !== null) {
        // A focused button (normally the pause screen itself) gets Enter and Space as a click.
        if ((space || e.key === 'Enter') && isButtonTarget(e.target)) return
        if (space) e.preventDefault()
        resume()
        return
      }
      if (space) {
        if (isButtonTarget(e.target) || isTypingTarget(e.target)) return
        e.preventDefault()
        skip()
        return
      }
      if (config.mode !== 'name') return
      // "−" then a letter names a flat.
      if (accidentals && (e.key === '-' || e.key === '_')) {
        setAcc(-1)
        return
      }
      const letter = 'CDEFGAB'.indexOf(e.key.toUpperCase())
      if (letter < 0 || e.key.length !== 1) return
      // Shift + letter is the sharp.
      answer(nameMatches(current, letter, e.shiftKey && accidentals ? 1 : acc))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Hint after two misses: name under the note, key glowing.
  const showHint = misses >= 2
  const marks: Marks = { ...flash }
  if (showHint && current) {
    for (let m = lo; m <= hi; m++) if (strict ? m === current.midi : mod(m, 12) === mod(current.midi, 12)) marks[m] = marks[m] ?? 'hint'
  }

  const [kbArea, { height: kbH }] = useElementSize<HTMLDivElement>()
  const kbHeight = Math.round(Math.max(120, Math.min(hi - lo > 30 ? 180 : 220, kbH - 30)))
  const timeFrac = left / ms
  const mult = multiplier(combo)

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-4 pb-4 pt-3 sm:px-6">
      {/* HUD */}
      <div className="flex items-center gap-4">
        <div className="min-w-28">
          <div className="text-xs font-extrabold uppercase tracking-widest text-ink-mute">Score</div>
          <div className="relative font-display text-4xl font-bold tabular-nums">
            {score}
            <AnimatePresence>
              {pop && (
                <motion.span
                  key={pop.id}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -26 }}
                  transition={{ duration: 0.7 }}
                  className="absolute left-full top-0 ml-2 text-xl text-gold"
                >
                  {pop.text}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-sm font-extrabold">
            <span className="flex items-center gap-1.5 text-ink-mute">
              <Timer size={16} /> {Math.ceil(left / 1000)}s
            </span>
            <span className="text-ink-mute">
              {correct} right · {wrong} missed
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-[width] duration-100 ${timeFrac < 0.2 ? 'bg-bad' : 'bg-linear-to-r from-sky to-violet'}`} style={{ width: `${timeFrac * 100}%` }} />
          </div>
        </div>
        <motion.div
          key={mult}
          initial={{ scale: 1.6 }}
          animate={{ scale: 1 }}
          className={`flex min-w-24 flex-col items-center rounded-2xl px-3 py-1.5 ${combo >= 5 ? 'bg-coral/15 text-coral' : 'bg-white/6 text-ink-mute'}`}
        >
          <span className="flex items-center gap-1 text-2xl font-extrabold">
            {combo >= 5 && <Flame size={20} className="animate-flicker" />}×{mult}
          </span>
          <span className="text-xs font-bold">combo {combo}</span>
        </motion.div>
        <Button size="lg" variant="secondary" icon={SkipForward} onClick={skip} aria-label="Skip" title="Skip this note (Space)">
          <span className="hidden sm:inline">Skip</span>
        </Button>
        <IconButton icon={Pause} label="Pause" size={56} onClick={pause} />
      </div>

      {/* The note tape */}
      <motion.div ref={staffRef} animate={wrongFlash ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
        <NoteTape config={config} round={round} index={i} skipped={skipped} wrong={wrongFlash} />
      </motion.div>

      <div className="flex h-9 items-center justify-center">
        <AnimatePresence>
          {showHint && current && (
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-gold/15 px-4 py-1.5 text-lg font-extrabold text-gold"
            >
              Hint: it’s <MusicText text={prettyName(current.name).replace(/\d+$/, '')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {config.mode === 'name' ? (
        <NameButtons accidentals={accidentals} acc={acc} setAcc={setAcc} onPick={(letter) => answer(nameMatches(current, letter, acc))} />
      ) : (
        <div className="flex min-h-[200px] flex-1 flex-col gap-2">
          <MicPrompt />
          <div ref={kbArea} className="flex min-h-0 flex-1 flex-col justify-end">
            <Piano from={lo} to={hi} marks={marks} labels="c" sparks sparkHeight={Math.max(30, Math.min(80, kbH - kbHeight - 26))} height={kbHeight} />
          </div>
        </div>
      )}

      <AnimatePresence>{paused && <PausedOverlay onResume={resume} />}</AnimatePresence>
    </div>
  )
}

/** Covers the whole round below the top bar, so the note can't be studied while the clock is stopped. */
function PausedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <motion.button
      type="button"
      // Focused, so Enter and Space click it rather than whatever had focus before.
      autoFocus
      onClick={onResume}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-night-900/85 px-6 text-center backdrop-blur-md"
    >
      <span className="flex size-24 items-center justify-center rounded-full bg-linear-to-b from-gold to-gold-deep text-night-900 shadow-[0_5px_0_#b9761f]">
        <Play size={44} strokeWidth={2.5} className="ml-1" />
      </span>
      <span className="font-display text-5xl font-bold">Paused</span>
      <span className="text-lg font-bold text-ink-soft">Tap, press any key or play a note to resume</span>
    </motion.button>
  )
}

/** Notes slide past a fixed clef and key signature; the current note sits near the left with a glow. */
function NoteTape({ config, round, index, skipped, wrong }: { config: Config; round: RushNote[]; index: number; skipped: number[]; wrong: boolean }) {
  const [box, { width }] = useElementSize<HTMLDivElement>()
  const [bg, setBg] = useState<Layout | null>(null)
  const s = Math.max(0, index - 3)
  const reserve = config.level === 4 ? 4.2 : config.level === 5 ? 2.8 : 2.2
  const { clef, key } = config

  const tape = useMemo(
    () =>
      tapeLayout(
        round.slice(s, index + 10).map((n, k) => {
          const g = s + k
          return {
            key: n.id,
            name: n.name,
            staff: clef === 'grand' ? n.staff : undefined,
            state: g < index ? (skipped.includes(g) ? 'wrong' : 'correct') : g === index ? (wrong ? 'wrong' : 'active') : 'normal',
          }
        }),
        { clef, keySig: key, sp: SP, reserve },
      ),
    [round, s, index, skipped, wrong, clef, key, reserve],
  )

  // Every note takes the same room, so a note's place on the whole tape is its place in this window plus `s` steps.
  const [first, second] = tape.events
  const step = first && second ? second.x - first.x : 0
  const clefW = bg ? bg.contentStart - 0.3 * SP : 120
  const anchor = Math.min(220, Math.max(90, (width - clefW) * 0.2))
  const x = first ? anchor - (first.x + index * step + first.width / 2) : 0
  // No names and no letter colours on the notes: either one gives the answer away.
  const common = { clef, sp: SP, minSp: SP, reserveAbove: reserve, reserveBelow: reserve, labels: false, colorNotes: false, fingers: false } as const

  return (
    <Paper className="relative overflow-hidden !px-0">
      <div ref={box} className="relative px-3">
        {/* Static staff with the clef and key signature; its height sizes the card. */}
        <Staff {...common} keySig={key} items={[{ key: 'bg', dur: 'w', hidden: true }]} justify onLayout={setBg} animate={false} />
        {/* Moving notes, clipped so they pass under the clef. */}
        <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ left: clefW + 12 }}>
          <motion.div className="absolute left-0 top-0" initial={false} animate={{ x }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
            <div className="absolute top-0" style={{ left: s * step }}>
              <StaffSvg layout={tape} colored={false} />
            </div>
          </motion.div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-paper to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-paper to-transparent" />
        </div>
      </div>
    </Paper>
  )
}

function NameButtons({ accidentals, acc, setAcc, onPick }: { accidentals: boolean; acc: number; setAcc: (a: number) => void; onPick: (letter: number) => void }) {
  return (
    <div className="mt-auto space-y-3 pb-2">
      {accidentals && (
        <div className="flex justify-center">
          <Segmented
            size="lg"
            value={acc}
            onChange={setAcc}
            options={[
              { value: -1, label: <MusicText text="♭ flat" /> },
              { value: 0, label: 'natural' },
              { value: 1, label: <MusicText text="♯ sharp" /> },
            ]}
          />
        </div>
      )}
      {/* Plain buttons: with the rainbow colours you'd match colours instead of reading the note. */}
      <div className="grid grid-cols-7 gap-2">
        {LETTERS.map((l, i) => (
          <motion.button
            key={l}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onPick(i)}
            className="flex h-20 items-center justify-center rounded-2xl border-2 border-white/10 bg-night-750 font-display text-4xl font-bold text-ink transition-colors hover:border-white/30 sm:h-24"
          >
            {l}
          </motion.button>
        ))}
      </div>
      <p className="text-center text-sm font-semibold text-ink-mute">
        {accidentals
          ? 'Tip: you can also type the letter on your computer keyboard (Shift + letter for a sharp, − then the letter for a flat).'
          : 'Tip: you can also type the letter on your computer keyboard.'}
      </p>
    </div>
  )
}

/** "F♯4", or "F♯4 (bass)" when both clefs are in play. */
function missLabel(id: string, clef: RushClef): string {
  const [staff, name] = id.split(':')
  return clef === 'grand' ? `${prettyName(name)} (${staff})` : prettyName(name)
}

function Results({
  result,
  clef,
  historyKey,
  next,
  onAgain,
  onDrill,
  onSetup,
}: {
  result: Result
  clef: RushClef
  historyKey?: string
  next?: ResultsAction
  onAgain: () => void
  onDrill: (ids: string[]) => void
  onSetup: () => void
}) {
  const total = result.correct + result.wrong
  const accuracy = total ? Math.round((result.correct / total) * 100) : 0
  const missed = Object.entries(result.missed).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <ResultsCard
      title={result.drill ? 'Drill done!' : result.stars === 3 ? 'Lightning reader!' : result.stars === 2 ? 'Nice reading!' : 'Round complete'}
      score={result.score}
      scoreNote={result.finish ? undefined : 'No notes right this time, so this round isn’t saved.'}
      stars={result.stars}
      result={result.finish}
      stats={[
        { label: 'Notes', value: result.correct },
        { label: 'Accuracy', value: `${accuracy}%` },
        { label: 'Best combo', value: result.bestCombo },
        { label: 'Avg. time', value: result.avgMs ? `${(result.avgMs / 1000).toFixed(1)}s` : '–' },
      ]}
      onAgain={onAgain}
      onSetup={onSetup}
      next={next}
      historyKey={historyKey}
      metric="score"
    >
      {missed.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Notes to review</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {missed.map(([id, n]) => (
              <span key={id} className="rounded-xl border border-white/10 bg-night-750 px-3 py-2 text-lg font-extrabold">
                <MusicText text={missLabel(id, clef)} /> <span className="text-sm text-ink-mute">×{n}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <DrillButton onClick={() => onDrill(missed.map(([id]) => id))} />
          </div>
        </div>
      )}
    </ResultsCard>
  )
}
