import { ArrowUpDown, Hand, Minus, Play, Plus, RotateCcw, Square, Target, Timer, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MusicText } from '../../components/MusicText'
import { TimingStrip } from '../../components/TimingStrip'
import { TopBar } from '../../components/layout/TopBar'
import { type KeyMark, Piano } from '../../components/piano/Piano'
import type { NoteState, StaffNoteSpec } from '../../components/staff/Staff'
import { ScoreStaff } from '../../components/staff/ScoreStaff'
import { Button, IconButton } from '../../components/ui/Button'
import { Card, Paper } from '../../components/ui/Card'
import { Segmented, Slider, Toggle } from '../../components/ui/controls'
import { useHandsFree } from '../../hooks/useHandsFree'
import { type RunSummary, type TimedPlan, useTimedRun } from '../../hooks/useTimedRun'
import { audio } from '../../lib/audio/engine'
import { playSequence } from '../../lib/audio/play'
import { noteColor } from '../../lib/colors'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { burst } from '../../lib/fx'
import { useNoteEvents } from '../../lib/input/bus'
import { SCALE_TYPE, SCALE_TYPES, keyFifths, midiOf, mod, parseNote, pcOf, pitchName, stepPattern } from '../../lib/theory'
import { getPref, setPref, usePref } from '../../state/prefs'
import { useProgress } from '../../state/progress'
import { useSettings } from '../../state/settings'
import { OctavePicker } from './OctavePicker'
import { TimedResult } from './ScaleTimed'
import { type Hands, type Octaves, runScore, scaleRun, stepOfId } from './scales'
import { bestKey, readBests } from './scaleTiming'

const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
const TONIC_PCS = MAJOR_TONICS.map((_, pc) => pc)
const SCALE_IDS = SCALE_TYPES.map((s) => s.id)
const HANDS: Hands[] = ['rh', 'lh', 'both']
const OCTAVES: Octaves[] = [1, 2]
const HAND_WORDS: Record<Hands, string> = { rh: 'Right hand', lh: 'Left hand', both: 'Hands together' }
const MINORISH = new Set(['minor', 'harmonic-minor', 'melodic-minor', 'minor-pentatonic', 'blues', 'dorian'])
const KEY_SIG_MODE: Record<string, 'major' | 'minor'> = { major: 'major', minor: 'minor', 'harmonic-minor': 'minor', 'melodic-minor': 'minor' }

const tonicName = (pc: number, typeId: string) => (MINORISH.has(typeId) ? MINOR_TONICS : MAJOR_TONICS)[pc]
const clampScaleBpm = (bpm: number) => Math.round(Math.min(200, Math.max(40, bpm)))

interface Practice {
  idx: number
  mistakes: number
  done: boolean
  wrongAt: number | null
  /** Keys played so far for this note: hands together need one per hand. */
  got: number[]
}

export function ScaleExplorer() {
  const [pc, setPc] = usePref('scale:tonic', 0, TONIC_PCS)
  const [typeId, setTypeId] = usePref('scale:type', 'major', SCALE_IDS)
  const [hand, setHand] = usePref<Hands>('scale:hand', 'rh', HANDS)
  const [upDown, setUpDown] = usePref('scale:up-down', true)
  const [octaves, setOctaves] = usePref<Octaves>('scale:octaves', 1, OCTAVES)
  // Practice at any pace, or in time with a count-in and a click (judged early or late).
  const [inTime, setInTime] = usePref('scale:in-time', false)
  const [savedBpm, setBpm] = usePref('scale:bpm', 72)
  const bpm = clampScaleBpm(savedBpm)
  const [click, setClick] = usePref('scale:click', true)
  const [bestsRaw] = usePref<unknown>('scale:best-bpm', {})
  const [playIdx, setPlayIdx] = useState<number | null>(null)
  const [practice, setPractice] = useState<Practice | null>(null)
  const [result, setResult] = useState<{ bpm: number; best: number | null; newBest: boolean } | null>(null)
  const timers = useRef<number[]>([])
  const scoreRef = useRef<HTMLDivElement>(null)
  const addXp = useProgress((s) => s.addXp)
  const strict = useSettings((s) => s.strictOctave)

  const type = SCALE_TYPE[typeId]
  // The tonic's name; scaleRun picks the octaves each hand plays in.
  const tonic = useMemo(() => parseNote(`${tonicName(pc, typeId)}4`), [pc, typeId])
  const run = useMemo(() => scaleRun(tonic, type, hand, octaves, upDown), [tonic, type, hand, octaves, upDown])
  const { steps, fingering } = run
  // The scale going up, as the chips show it (both hands play the same names).
  const upNotes = hand === 'lh' ? run.lh : run.rh
  const pattern = useMemo(() => {
    const one = stepPattern(type)
    return octaves === 2 ? [...one, ...one] : one
  }, [type, octaves])
  const keyMode = KEY_SIG_MODE[typeId]
  const keySig = keyMode ? keyFifths({ tonic, mode: keyMode }) : 0
  const title = `${pitchName(tonic)} ${type.name.toLowerCase()}`
  const score = useMemo(() => runScore(steps, keySig), [steps, keySig])

  // Enough keyboard for both hands: from the C below the lowest note, at least two octaves.
  const allMidis = [...run.rh, ...run.lh].map(midiOf)
  const lo = Math.min(...allMidis)
  const hi = Math.max(...allMidis)
  const from = lo - mod(lo, 12)
  const to = Math.max(from + 24, hi + mod(12 - mod(hi, 12), 12))

  const best = readBests(bestsRaw)[bestKey(pc, typeId, hand, octaves, upDown)] ?? null

  /** A run in time is over: keep a clean run's tempo if it beats your best for this scale (and these settings). */
  const timedDone = (s: RunSummary) => {
    const bests = readBests(getPref<unknown>('scale:best-bpm', {}))
    const key = bestKey(pc, typeId, hand, octaves, upDown)
    const before = bests[key] ?? null
    const newBest = s.clean && (before === null || bpm > before)
    if (newBest) setPref('scale:best-bpm', { ...bests, [key]: bpm })
    setResult({ bpm, best: before, newBest })
    if (useSettings.getState().uiSounds) audio.ui(s.clean ? 'complete' : 'tap')
    if (s.clean) burst(scoreRef.current, { count: 70 })
    // XP like the other games: nothing for a run with nothing on the right note.
    if (s.total - s.wrong - s.missed > 0) addXp(s.clean ? 10 : 5)
  }
  // In time: one note on each click, both hands' keys together when it's hands together.
  const timedPlan = useMemo<TimedPlan>(
    () => ({
      targets: steps.map((s) => ({ pc: mod((s.rh ?? s.lh)!.midi, 12), midis: [s.rh?.midi, s.lh?.midi].filter((m): m is number => m !== undefined) })),
      meter: 4,
      hands: hand === 'both' ? 2 : 1,
      strict,
    }),
    [steps, hand, strict],
  )
  const timed = useTimedRun({ plan: timedPlan, bpm, click, onDone: timedDone })

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  /** Changing the scale stops any playback or practice run. */
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      clearTimers()
      setPlayIdx(null)
      setPractice(null)
      timed.stop()
      set(v)
    }

  const play = () => {
    clearTimers()
    setPractice(null)
    timed.stop()
    // In time, Listen plays it at your tempo.
    const gap = inTime ? 60 / bpm : 0.36
    playSequence(
      steps.map((s) => [s.rh?.midi, s.lh?.midi].filter((m): m is number => m !== undefined)),
      { gap, dur: 0.6 },
    )
    steps.forEach((_, k) => timers.current.push(window.setTimeout(() => setPlayIdx(k), k * gap * 1000 + 30)))
    timers.current.push(window.setTimeout(() => setPlayIdx(null), steps.length * gap * 1000 + 400))
  }

  const startPractice = () => {
    clearTimers()
    setPlayIdx(null)
    setResult(null)
    if (inTime) {
      setPractice(null)
      timed.start()
    } else {
      timed.stop()
      setPractice({ idx: 0, mistakes: 0, done: false, wrongAt: null, got: [] })
    }
  }
  const running = (!!practice && !practice.done) || timed.running
  const stopPractice = () => {
    setPractice(null)
    timed.stop()
  }

  useNoteEvents((e) => {
    if (e.type !== 'on' || !practice || practice.done) return
    const step = steps[practice.idx]
    if (mod(e.midi, 12) !== pcOf((step.rh ?? step.lh)!.note)) {
      setPractice({ ...practice, mistakes: practice.mistakes + 1, wrongAt: e.midi })
      return
    }
    // Hands together need a key from each hand; the mic hears them as one note.
    const need = hand === 'both' && e.source !== 'mic' ? 2 : 1
    const got = practice.got.includes(e.midi) ? practice.got : [...practice.got, e.midi]
    if (got.length < need) {
      setPractice({ ...practice, got, wrongAt: null })
      return
    }
    const idx = practice.idx + 1
    if (idx >= steps.length) {
      setPractice({ ...practice, idx, done: true, wrongAt: null, got: [] })
      if (useSettings.getState().uiSounds) audio.ui('complete')
      burst(scoreRef.current, { count: 70 })
      addXp(practice.mistakes === 0 ? 10 : 5)
    } else setPractice({ ...practice, idx, wrongAt: null, got: [] })
  })

  // Clear the red flash on a wrong key after a moment.
  useEffect(() => {
    if (practice?.wrongAt == null) return
    const t = window.setTimeout(() => setPractice((p) => (p ? { ...p, wrongAt: null } : p)), 450)
    return () => window.clearTimeout(t)
  }, [practice?.wrongAt])

  // Space starts and stops a run (letter keys play notes on the computer keyboard, so they're left alone).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isPlainKey(e) || isTypingTarget(e.target) || isButtonTarget(e.target)) return
      e.preventDefault()
      if (running) stopPractice()
      else startPractice()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // Enter, a deliberate pedal tap or the top C starts one (and starts it again after a run).
  useHandsFree(running ? null : startPractice)

  const tr = timed.run
  const stepIdx = tr ? tr.step : practice && !practice.done ? practice.idx : playIdx
  const cur = stepIdx !== null ? steps[stepIdx] : null
  const wrongAt = tr ? tr.wrongAt : (practice?.wrongAt ?? null)

  const marks: Record<number, KeyMark> = {}
  for (const n of [...run.rh, ...run.lh]) marks[midiOf(n)] = { kind: pcOf(n) === pcOf(tonic) ? 'root' : 'scale', label: pitchName(n) }
  for (const h of [cur?.rh, cur?.lh]) if (h) marks[h.midi] = { kind: practice || tr ? 'target' : 'chord', label: pitchName(h.note) }
  if (wrongAt !== null) marks[wrongAt] = { ...marks[wrongAt], kind: 'bad' }

  // Fingers on the keys. Two hands share keys in places, so then only the note being played shows its fingers.
  const pianoFingers: Record<number, number> = {}
  if (fingering && hand !== 'both') upNotes.forEach((n, i) => (pianoFingers[midiOf(n)] = fingering[hand][i]))
  if (fingering && hand === 'both') for (const h of [cur?.rh, cur?.lh]) if (h?.finger) pianoFingers[h.midi] = h.finger

  // On the staff: green for the right note, red for a wrong or missed one (in time, the strip shows early or late).
  const noteState = (spec: StaffNoteSpec): NoteState | undefined => {
    if (spec.id === undefined) return undefined
    const k = stepOfId(spec.id)
    if (tr) {
      const v = tr.results[k]?.verdict
      if (v) return v === 'wrong' || v === 'miss' || v === 'oneHand' ? 'wrong' : 'correct'
      return k === tr.step ? 'active' : 'normal'
    }
    if (practice) return k < practice.idx ? 'correct' : k === practice.idx && !practice.done ? 'active' : 'normal'
    return k === playIdx ? 'active' : 'normal'
  }
  const stepNames = steps.map((s) => pitchName((s.rh ?? s.lh)!.note))

  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/explore" title="Scale Explorer" subtitle="Every scale, with fingering and a practice mode" />
      <main className="mx-auto grid max-w-[1500px] gap-5 px-3 pt-5 sm:px-5 lg:grid-cols-[minmax(320px,410px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Starting note</h2>
            <OctavePicker value={pc} onChange={change(setPc)} label="Starting note" names={(p) => ({ main: tonicName(p, typeId).replace('#', '♯').replace('b', '♭') })} />
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Scale</h2>
            <div className="flex flex-wrap gap-2">
              {SCALE_TYPES.map((s) => (
                <motion.button
                  key={s.id}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => change(setTypeId)(s.id)}
                  aria-pressed={s.id === typeId}
                  className={`min-h-11 rounded-2xl border px-3.5 text-base font-extrabold transition-colors ${
                    s.id === typeId ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:border-white/25 hover:text-ink'
                  }`}
                >
                  {s.name}
                </motion.button>
              ))}
            </div>
          </Card>
          <Card className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Hand</h2>
              <Segmented
                value={hand}
                onChange={change(setHand)}
                options={[
                  { value: 'rh', label: 'Right' },
                  { value: 'lh', label: 'Left' },
                  { value: 'both', label: 'Both' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Range</h2>
              <Segmented
                value={octaves}
                onChange={change(setOctaves)}
                options={[
                  { value: 1, label: '1 octave' },
                  { value: 2, label: '2 octaves' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Direction</h2>
              <Segmented
                value={upDown ? 'both' : 'up'}
                onChange={(v) => change(setUpDown)(v === 'both')}
                options={[
                  { value: 'up', label: 'Up' },
                  { value: 'both', label: 'Up & down' },
                ]}
                className="w-full"
              />
            </div>
          </Card>
          <Card className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Practice</h2>
              <Segmented
                value={inTime ? 'time' : 'pace'}
                onChange={(v) => change(setInTime)(v === 'time')}
                options={[
                  { value: 'pace', label: 'Any pace' },
                  { value: 'time', label: 'In time' },
                ]}
                className="w-full"
              />
              <p className="mt-2 text-sm text-ink-mute">
                {inTime ? 'Four clicks count you in, then play a note on each click. Each one is checked for early or late.' : 'Take your time: each note waits for you.'}
              </p>
            </div>
            {inTime && (
              <>
                <div>
                  <div className="mb-2 flex items-end justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wider text-ink-mute">
                      <Timer size={16} /> Tempo
                    </span>
                    <span className="font-display text-3xl font-bold leading-none">
                      {bpm}
                      <span className="ml-1 font-sans text-sm font-extrabold text-ink-mute">BPM</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <IconButton icon={Minus} label="Slower" size={48} onClick={() => change(setBpm)(clampScaleBpm(bpm - 4))} />
                    <Slider value={bpm} min={40} max={200} step={2} onChange={change(setBpm)} label="Tempo" />
                    <IconButton icon={Plus} label="Faster" size={48} onClick={() => change(setBpm)(clampScaleBpm(bpm + 4))} />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-ink-mute">
                    <Trophy size={14} className="text-gold" />
                    {best !== null ? `Best clean run of this scale: ${best} BPM` : 'A clean run (every note within 90 ms) sets your best tempo for this scale.'}
                  </p>
                </div>
                <label className="flex items-center justify-between gap-3 font-extrabold text-ink-soft">
                  Click while I play
                  <Toggle checked={click} onChange={setClick} label="Click while I play" />
                </label>
              </>
            )}
          </Card>
        </section>

        <section className="flex min-w-0 flex-col gap-5">
          <Card className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: noteColor(pc) }} />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
                  <MusicText text={title.charAt(0).toUpperCase() + title.slice(1)} />
                </div>
                <div className="mt-1 text-lg font-extrabold text-gold">{type.mood}</div>
                <p className="mt-2 max-w-2xl text-ink-soft">{type.about}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={upDown ? ArrowUpDown : Play} onClick={play}>
                  Listen
                </Button>
                {running ? (
                  <Button variant="secondary" icon={Square} onClick={stopPractice}>
                    Stop
                  </Button>
                ) : (
                  <Button variant="good" icon={inTime ? Timer : Target} onClick={startPractice} title="Space, Enter or a tap of the pedal">
                    {inTime ? 'Play in time' : 'Practice'}
                  </Button>
                )}
              </div>
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-1">
              {upNotes.map((n, i) => {
                const c = noteColor(pcOf(n))
                const lit = cur?.pos === i
                return (
                  <div key={`${title}-${i}`} className="flex items-center gap-1">
                    {i > 0 && (
                      <span
                        className={`rounded-lg px-1.5 py-0.5 text-xs font-extrabold ${pattern[i - 1] === 'H' ? 'bg-coral/20 text-coral' : pattern[i - 1] === 'W' ? 'bg-teal/15 text-teal' : 'bg-violet/20 text-violet'}`}
                        title={pattern[i - 1] === 'H' ? 'Half step' : pattern[i - 1] === 'W' ? 'Whole step' : 'Step and a half'}
                      >
                        {pattern[i - 1] === 'W+H' ? '1½' : pattern[i - 1]}
                      </span>
                    )}
                    <motion.span
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1, scale: lit ? 1.18 : 1 }}
                      transition={{ delay: lit ? 0 : i * 0.04, type: 'spring', stiffness: 420, damping: 20 }}
                      className="flex min-w-12 flex-col items-center rounded-xl border px-2 py-1 font-display text-2xl font-bold"
                      style={{ color: c, borderColor: `${c}66`, background: lit ? `${c}38` : `${c}14` }}
                    >
                      <MusicText text={pitchName(n)} />
                      {fingering && hand !== 'both' && <span className="font-sans text-xs font-extrabold text-ink-mute">{fingering[hand][i]}</span>}
                      {fingering && hand === 'both' && (
                        <span className="flex flex-col items-center font-sans text-xs font-extrabold leading-tight text-ink-mute">
                          <span>{fingering.rh[i]}</span>
                          <span>{fingering.lh[i]}</span>
                        </span>
                      )}
                    </motion.span>
                  </div>
                )
              })}
            </div>
            <p className="relative mt-3 text-sm text-ink-mute">
              <b className="text-teal">W</b> = whole step (2 keys), <b className="text-coral">H</b> = half step (next key)
              {pattern.includes('W+H') && (
                <>
                  , <b className="text-violet">1½</b> = three half steps
                </>
              )}
              .{' '}
              {fingering ? (
                <>
                  {hand === 'both' ? 'Small numbers are fingers: right hand above, left hand below.' : `Small numbers are ${hand === 'rh' ? 'right' : 'left'}-hand fingers.`}
                  {octaves === 2 && ' Over two octaves the pattern carries on from the middle note.'}
                </>
              ) : (
                <>No standard fingering here: keep your thumb off the black keys and cross under after 3 or 4 notes.</>
              )}
            </p>
          </Card>

          <Card className="pt-4">
            {tr && (
              <div className="mb-3 space-y-3">
                {tr.phase === 'done' && tr.summary && result ? (
                  <TimedResult summary={tr.summary} bpm={result.bpm} best={result.best} newBest={result.newBest} onAgain={startPractice} />
                ) : (
                  <div className="flex min-h-11 items-center gap-3 font-extrabold text-ink-soft" aria-live="polite">
                    {tr.phase === 'count' ? (
                      <>
                        <span>Get ready:</span>
                        <motion.span key={tr.count} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-4xl font-bold text-gold">
                          {tr.count || ''}
                        </motion.span>
                      </>
                    ) : (
                      <span>
                        A note on each click{hand === 'both' ? ', both hands' : ''}: {(tr.step ?? 0) + 1} of {steps.length}
                      </span>
                    )}
                  </div>
                )}
                <TimingStrip results={tr.results} step={tr.step} names={stepNames} />
              </div>
            )}
            <div ref={scoreRef} className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-ink-mute">
                <Hand size={18} />
                {running
                  ? hand === 'both'
                    ? `Play each lit note with both hands (${strict && tr ? 'the octaves shown' : 'any octave'})`
                    : `Play each lit note on your keyboard (${strict && tr ? 'the octave shown' : 'any octave'})`
                  : `${HAND_WORDS[hand]}, ${upDown ? 'up and back down' : 'going up'}${octaves === 2 ? ', two octaves' : ''}`}
              </div>
              <AnimatePresence mode="wait">
                {practice && (
                  <motion.div
                    key={practice.done ? 'done' : 'go'}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                    {practice.done ? (
                      <>
                        <span className="flex items-center gap-2 font-extrabold text-good">
                          <Trophy size={20} /> {practice.mistakes === 0 ? 'Clean run!' : `Done with ${practice.mistakes} slip${practice.mistakes > 1 ? 's' : ''}`}
                        </span>
                        <Button size="sm" variant="secondary" icon={RotateCcw} onClick={startPractice}>
                          Again
                        </Button>
                      </>
                    ) : (
                      <span className="rounded-full bg-white/6 px-3 py-1.5 text-sm font-extrabold text-ink-soft">
                        {practice.idx}/{steps.length} · {practice.mistakes} slip{practice.mistakes === 1 ? '' : 's'}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Names only on the scale's keys, spelled for the scale: the content here, not reading help. */}
            <Piano from={from} to={to} marks={marks} fingers={pianoFingers} labels="marked" sparks sparkHeight={90} height={190} minKeyWidth={26} octaveLabels />
          </Card>

          <Paper>
            <ScoreStaff input={score} fit sp={18} minSp={7} noteState={noteState} title={`${title}, ${HAND_WORDS[hand].toLowerCase()}`} />
            <p className="mt-1 text-center text-sm font-bold text-paper-ink/60">
              {keyMode ? (
                <>
                  Written with the key signature of <MusicText text={`${pitchName(tonic)} ${keyMode}`} />
                  {typeId !== keyMode && typeId !== 'minor' ? '; the raised notes get accidentals.' : '.'}
                </>
              ) : (
                <>Written with accidentals (no key signature).</>
              )}
            </p>
          </Paper>
        </section>
      </main>
    </div>
  )
}
