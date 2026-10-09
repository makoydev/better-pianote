import { Flame, Hand, Keyboard, Play, RotateCcw, Settings2, Timer, Trophy, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { MusicText } from '../../components/MusicText'
import { type Marks, Piano } from '../../components/piano/Piano'
import { Staff, type StaffItem } from '../../components/staff/Staff'
import type { Layout } from '../../components/staff/layout'
import { Button } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { Chips, Segmented, Toggle } from '../../components/ui/controls'
import { Stars } from '../../components/ui/progress'
import { useElementSize } from '../../hooks/useElementSize'
import { audio } from '../../lib/audio/engine'
import { letterColor } from '../../lib/colors'
import { burst, celebrate } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { pauseComputerKeys } from '../../lib/input/keys'
import { LETTERS, mod } from '../../lib/theory'
import { go } from '../../router'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import {
  LEVELS,
  type RushClef,
  type RushLevel,
  type RushNote,
  isCorrect,
  keyboardRange,
  makeRound,
  multiplier,
  nameMatches,
  prettyName,
} from './noteRush/logic'

type Phase = 'setup' | 'countdown' | 'play' | 'results'
type Mode = 'play' | 'name'

interface Config {
  clef: RushClef
  level: RushLevel
  mode: Mode
}

interface Result {
  score: number
  correct: number
  wrong: number
  bestCombo: number
  avgMs: number
  missed: Record<string, number>
  isBest: boolean
  prevBest: number
  xp: number
}

const ROUND_MS = 60_000
const SP = 20

export function NoteRush() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [config, setConfig] = useState<Config>({ clef: 'treble', level: 1, mode: 'play' })
  const [result, setResult] = useState<Result | null>(null)
  const [runId, setRunId] = useState(0)

  const start = () => {
    setRunId((r) => r + 1)
    setPhase('countdown')
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar back="/practice" title="Note Rush" subtitle={phase === 'setup' ? 'Sight-reading sprint' : `${LEVELS[config.level - 1].title} · ${config.clef === 'grand' ? 'both clefs' : `${config.clef} clef`}`} />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {phase === 'setup' && <Setup config={config} onChange={setConfig} onStart={start} />}
        {phase === 'countdown' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'play' && (
          <Round
            key={runId}
            config={config}
            onFinish={(r) => {
              setResult(r)
              setPhase('results')
            }}
          />
        )}
        {phase === 'results' && result && <Results result={result} onAgain={start} onSetup={() => setPhase('setup')} />}
      </div>
    </div>
  )
}

function Setup({ config, onChange, onStart }: { config: Config; onChange: (c: Config) => void; onStart: () => void }) {
  const strict = useSettings((s) => s.strictOctave)
  const set = useSettings((s) => s.set)
  const best = useProgress((s) => s.games[`note-rush:${config.clef}:${config.level}`]?.best ?? 0)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-5 py-8">
      <div className="text-center">
        <motion.div initial={{ scale: 0.7, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} className="mx-auto mb-4 flex size-20 items-center justify-center rounded-3xl bg-linear-to-br from-sky to-violet text-night-900 shadow-[0_16px_40px_-12px_#5cc8ff]">
          <Zap size={40} strokeWidth={2.4} />
        </motion.div>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Note Rush</h1>
        <p className="mt-2 text-lg text-ink-soft">60 seconds. Read each note and play it. Streaks build your multiplier.</p>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-ink-mute">Clef</h2>
        <Segmented
          size="lg"
          className="w-full"
          value={config.clef}
          onChange={(clef) => onChange({ ...config, clef })}
          options={[
            { value: 'treble', label: 'Treble' },
            { value: 'bass', label: 'Bass' },
            { value: 'grand', label: 'Both' },
          ]}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-ink-mute">Level</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {LEVELS.map((l) => {
            const on = l.level === config.level
            return (
              <motion.button
                key={l.level}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange({ ...config, level: l.level })}
                className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors ${on ? 'border-gold bg-gold/10' : 'border-white/8 bg-night-750 hover:border-white/20'}`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl font-extrabold ${on ? 'bg-gold text-night-900' : 'bg-white/8 text-ink-soft'}`}>{l.level}</span>
                <span>
                  <span className="block text-lg font-extrabold">{l.title}</span>
                  <span className="block text-sm text-ink-mute">{l.detail}</span>
                </span>
              </motion.button>
            )
          })}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-ink-mute">How to answer</h2>
        <Chips
          value={config.mode}
          onChange={(mode) => onChange({ ...config, mode })}
          options={[
            {
              value: 'play',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Hand size={18} /> Play it on the keys
                </span>
              ),
            },
            {
              value: 'name',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Keyboard size={18} /> Tap the note name
                </span>
              ),
            },
          ]}
        />
        {config.mode === 'play' && (
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-night-850 p-4">
            <span>
              <span className="block font-extrabold">Exact octave</span>
              <span className="text-sm text-ink-mute">Off: any C counts as C. On: it has to be the C that's written.</span>
            </span>
            <Toggle checked={strict} onChange={(v) => set({ strictOctave: v })} label="Exact octave" />
          </label>
        )}
      </section>
      <div className="flex flex-col items-center gap-3">
        <Button size="xl" icon={Play} onClick={onStart} className="w-full max-w-sm">
          Start
        </Button>
        {best > 0 && (
          <span className="flex items-center gap-2 text-sm font-bold text-ink-mute">
            <Trophy size={16} className="text-gold" /> Best on this level: {best}
          </span>
        )}
      </div>
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

function Round({ config, onFinish }: { config: Config; onFinish: (r: Result) => void }) {
  const strict = useSettings((s) => s.strictOctave)
  const uiSounds = useSettings((s) => s.uiSounds)
  const round = useMemo(() => makeRound(config.clef, config.level, 260), [config.clef, config.level])
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
  const [left, setLeft] = useState(ROUND_MS)
  const missed = useRef<Record<string, number>>({})
  const times = useRef<number[]>([])
  const shownAt = useRef(0)
  const endAt = useRef(Infinity)
  useEffect(() => {
    shownAt.current = performance.now()
    endAt.current = performance.now() + ROUND_MS
  }, [])
  const finished = useRef(false)
  const staffRef = useRef<HTMLDivElement>(null)
  const [lo, hi] = keyboardRange(config.clef, config.level)
  const current: RushNote = round[i]

  const finish = () => {
    if (finished.current) return
    finished.current = true
    const p = useProgress.getState()
    const variant = `note-rush:${config.clef}:${config.level}`
    const { isBest, prevBest } = p.recordGame(variant, score)
    p.recordGame('note-rush', score)
    const xp = Math.max(5, Math.round(score / 20))
    p.addXp(xp)
    const avgMs = times.current.length ? times.current.reduce((a, b) => a + b, 0) / times.current.length : 0
    onFinish({ score, correct, wrong, bestCombo, avgMs, missed: missed.current, isBest: isBest && score > 0, prevBest, xp })
  }

  // The clock.
  useEffect(() => {
    const id = window.setInterval(() => {
      const l = endAt.current - performance.now()
      setLeft(Math.max(0, l))
      if (l <= 0) finish()
    }, 100)
    return () => window.clearInterval(id)
  })

  const flashKey = (m: number, kind: 'good' | 'bad') => {
    setFlash((f) => ({ ...f, [m]: kind }))
    window.setTimeout(() => setFlash((f) => {
      const n = { ...f }
      delete n[m]
      return n
    }), 380)
  }

  const answer = (ok: boolean, midi?: number) => {
    if (finished.current) return
    if (ok) {
      const nextCombo = combo + 1
      const mult = multiplier(nextCombo)
      const gained = 10 * mult
      setScore((s) => s + gained)
      setCombo(nextCombo)
      setBestCombo((b) => Math.max(b, nextCombo))
      setCorrect((c) => c + 1)
      setPop({ id: performance.now(), text: `+${gained}` })
      times.current.push(performance.now() - shownAt.current)
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
      missed.current[current.name] = (missed.current[current.name] ?? 0) + 1
      if (midi !== undefined) flashKey(midi, 'bad')
      if (uiSounds) audio.ui('wrong')
    }
  }

  useNoteEvents((e) => {
    if (config.mode !== 'play' || e.type !== 'on' || !current) return
    answer(isCorrect(current, e.midi, strict), e.midi)
  })

  // Name mode: letter keys on the computer keyboard answer too.
  useEffect(() => {
    if (config.mode !== 'name') return
    const resume = pauseComputerKeys()
    const onKey = (e: KeyboardEvent) => {
      const letter = 'CDEFGAB'.indexOf(e.key.toUpperCase())
      if (letter >= 0 && e.key.length === 1) answer(nameMatches(current, letter, acc))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      resume()
    }
  })

  // Hint after two misses: name under the note, key glowing.
  const showHint = misses >= 2
  const marks: Marks = { ...flash }
  if (showHint && current) {
    for (let m = lo; m <= hi; m++) if (strict ? m === current.midi : mod(m, 12) === mod(current.midi, 12)) marks[m] = marks[m] ?? 'hint'
  }

  const [kbArea, { height: kbH }] = useElementSize<HTMLDivElement>()
  const kbHeight = Math.round(Math.max(120, Math.min(hi - lo > 30 ? 180 : 220, kbH - 30)))
  const timeFrac = left / ROUND_MS
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
      </div>

      {/* The note tape */}
      <motion.div ref={staffRef} animate={wrongFlash ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
        <NoteTape config={config} round={round} index={i} wrong={wrongFlash} />
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
        <NameButtons level={config.level} acc={acc} setAcc={setAcc} onPick={(letter) => answer(nameMatches(current, letter, acc))} />
      ) : (
        <div ref={kbArea} className="flex min-h-[150px] flex-1 flex-col justify-end">
          <Piano from={lo} to={hi} marks={marks} labels="c" sparks sparkHeight={Math.max(30, Math.min(80, kbH - kbHeight - 26))} height={kbHeight} />
        </div>
      )}
    </div>
  )
}

/** Notes slide past a fixed clef; the current note sits near the left with a glow. */
function NoteTape({ config, round, index, wrong }: { config: Config; round: RushNote[]; index: number; wrong: boolean }) {
  const [box, { width }] = useElementSize<HTMLDivElement>()
  const [bg, setBg] = useState<Layout | null>(null)
  const [tape, setTape] = useState<{ slot: number; start: number } | null>(null)
  const s = Math.max(0, index - 3)
  const windowNotes = round.slice(s, index + 10)
  const reserve = config.level === 4 ? 4.2 : config.level === 5 ? 2.8 : 2.2
  const clef = config.clef

  const items: StaffItem[] = windowNotes.map((n, k) => {
    const g = s + k
    return {
      key: n.id,
      notes: [n.name],
      dur: 'w',
      staff: clef === 'grand' ? n.staff : undefined,
      state: g < index ? 'correct' : g === index ? (wrong ? 'wrong' : 'active') : 'normal',
    }
  })

  const clefW = bg ? bg.contentStart - 0.3 * SP : 120
  const anchor = Math.min(220, Math.max(90, (width - clefW) * 0.2))
  const x = tape ? anchor - (tape.start + index * tape.slot + tape.slot / 2) : 0
  const common = { clef, sp: SP, minSp: SP, reserveAbove: reserve, reserveBelow: reserve, labels: false, fingers: false } as const

  return (
    <Paper className="relative overflow-hidden !px-0">
      <div ref={box} className="relative px-3">
        {/* Static staff with the clef; its height sizes the card. */}
        <Staff {...common} items={[{ key: 'bg', dur: 'w', hidden: true }]} justify onLayout={setBg} animate={false} />
        {/* Moving notes, clipped so they pass under the clef. */}
        <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ left: clefW + 12 }}>
          <motion.div className="absolute left-0 top-0" initial={false} animate={{ x }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
            <div className="absolute top-0" style={{ left: tape ? s * tape.slot : 0 }}>
              <Staff
                {...common}
                natural
                lines={false}
                showClef={false}
                minSlot={6}
                items={items}
                onLayout={(l) => {
                  const slot = l.events[0]?.width ?? 0
                  if (slot && (!tape || tape.slot !== slot || tape.start !== l.contentStart)) setTape({ slot, start: l.contentStart })
                }}
              />
            </div>
          </motion.div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-paper to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-paper to-transparent" />
        </div>
      </div>
    </Paper>
  )
}

function NameButtons({ level, acc, setAcc, onPick }: { level: RushLevel; acc: number; setAcc: (a: number) => void; onPick: (letter: number) => void }) {
  return (
    <div className="mt-auto space-y-3 pb-2">
      {level === 5 && (
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
      <div className="grid grid-cols-7 gap-2">
        {LETTERS.map((l, i) => (
          <motion.button
            key={l}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onPick(i)}
            className="flex h-20 items-center justify-center rounded-2xl border-2 bg-night-750 font-display text-4xl font-bold sm:h-24"
            style={{ color: letterColor(i), borderColor: `${letterColor(i)}55` }}
          >
            {l}
          </motion.button>
        ))}
      </div>
      <p className="text-center text-sm font-semibold text-ink-mute">Tip: you can also type the letter on your computer keyboard.</p>
    </div>
  )
}

function Results({ result, onAgain, onSetup }: { result: Result; onAgain: () => void; onSetup: () => void }) {
  const total = result.correct + result.wrong
  const accuracy = total ? Math.round((result.correct / total) * 100) : 0
  const stars = accuracy >= 95 && result.correct >= 25 ? 3 : accuracy >= 85 && result.correct >= 15 ? 2 : result.correct > 0 ? 1 : 0
  const missed = Object.entries(result.missed).sort((a, b) => b[1] - a[1]).slice(0, 6)

  useEffect(() => {
    if (result.isBest || stars === 3) celebrate()
    if (useSettings.getState().uiSounds) audio.ui(result.isBest ? 'levelup' : 'complete')
  }, [result.isBest, stars])

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-5 py-8 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        {result.isBest && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold px-4 py-1.5 text-sm font-extrabold text-night-900">
            <Trophy size={16} /> New best!
          </div>
        )}
        <div className="font-display text-7xl font-bold text-gradient">{result.score}</div>
        <div className="mt-1 text-lg font-bold text-ink-mute">points</div>
        <div className="mt-3 flex justify-center">
          <Stars value={stars} size={44} animate />
        </div>
      </motion.div>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Notes', String(result.correct)],
          ['Accuracy', `${accuracy}%`],
          ['Best combo', String(result.bestCombo)],
          ['Avg. time', result.avgMs ? `${(result.avgMs / 1000).toFixed(1)}s` : '–'],
        ].map(([label, value], k) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.08 }} className="glass rounded-2xl p-4">
            <div className="text-3xl font-extrabold">{value}</div>
            <div className="text-sm font-bold text-ink-mute">{label}</div>
          </motion.div>
        ))}
      </div>
      <div className="text-sm font-bold text-gold">+{result.xp} XP</div>
      {missed.length > 0 && (
        <div className="w-full">
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-ink-mute">Notes to review</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {missed.map(([name, n]) => (
              <span key={name} className="rounded-xl border border-white/10 bg-night-750 px-3 py-2 text-lg font-extrabold">
                <MusicText text={prettyName(name)} /> <span className="text-sm text-ink-mute">×{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button variant="secondary" icon={Settings2} onClick={onSetup} className="sm:flex-1">
          Change level
        </Button>
        <Button icon={RotateCcw} onClick={onAgain} className="sm:flex-1">
          Play again
        </Button>
      </div>
      <button type="button" onClick={() => go('/practice')} className="text-sm font-bold text-ink-mute hover:text-ink">
        Back to practice
      </button>
    </div>
  )
}
