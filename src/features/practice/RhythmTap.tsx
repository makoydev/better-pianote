import { Drum, Hand, Play, RotateCcw, SkipForward, Volume2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Staff } from '../../components/staff/Staff'
import { Button } from '../../components/ui/Button'
import { Paper } from '../../components/ui/Card'
import { Slider, Toggle } from '../../components/ui/controls'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { useNoteEvents } from '../../lib/input/bus'
import { pauseComputerKeys } from '../../lib/input/keys'
import { type Grade, type NoteResult, RHYTHM_LEVELS, type RNote, makePattern, onsetBeats, patternToStaff, scoreTaps } from './logic/rhythm'
import { GameMain, Hud, ResultsCard, SetupCard } from './shared/GameParts'
import { type FinishResult, finishGame, remember, sfx, starsFor, store } from './shared/finish'

const PATTERNS = 5
const BARS = 2
const BEATS = BARS * 4
const LEVEL_IDS = RHYTHM_LEVELS.map((l) => l.id)

const GRADE_COLOR: Record<Grade, string> = { perfect: '#3ddc97', good: '#a3e635', ok: '#ffc857', miss: '#ff5c7a' }

/**
 * Convert a performance.now() time to the audio clock *as heard*: getOutputTimestamp maps the moment
 * sound leaves the speakers, so output latency is already accounted for.
 */
function perfToAudio(perfMs: number): number {
  const ctx = audio.ctx
  if (!ctx) return 0
  const ts = ctx.getOutputTimestamp?.()
  if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.contextTime + (perfMs - ts.performanceTime) / 1000
  }
  return ctx.currentTime - (performance.now() - perfMs) / 1000 - (ctx.outputLatency || ctx.baseLatency || 0)
}

export function RhythmTap() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [levelId, setLevelId] = useState(() => remember('rhythm-level', 'l1', LEVEL_IDS))
  const level = RHYTHM_LEVELS.find((l) => l.id === levelId) ?? RHYTHM_LEVELS[0]
  const [bpm, setBpm] = useState(level.bpm)
  const [clickOn, setClickOn] = useState(true)
  const [patterns, setPatterns] = useState<RNote[][]>([])
  const [scores, setScores] = useState<number[]>([])
  const [finish, setFinish] = useState<FinishResult | null>(null)

  // The computer keyboard belongs to tapping here (Space), not to playing notes.
  useEffect(() => pauseComputerKeys(), [])

  const pickLevel = (id: string) => {
    setLevelId(id)
    setBpm(RHYTHM_LEVELS.find((l) => l.id === id)?.bpm ?? 80)
  }

  const start = () => {
    store('rhythm-level', level.id)
    setPatterns(Array.from({ length: PATTERNS }, () => makePattern(level, BARS)))
    setScores([])
    setFinish(null)
    setPhase('play')
  }

  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const stars = starsFor(avg / 100, 0.85, 0.65)

  const onDone = (score: number) => {
    const all = [...scores, score]
    setScores(all)
    if (all.length >= PATTERNS) {
      const final = Math.round(all.reduce((a, b) => a + b, 0) / all.length)
      setFinish(finishGame('rhythm', level.id, final, starsFor(final / 100, 0.85, 0.65)))
      setPhase('done')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar back="/practice" title="Rhythm Tap" subtitle={phase === 'setup' ? 'Read it, tap it' : `${level.name} · ${bpm} BPM`} />
      {phase === 'setup' && (
        <GameMain>
          <SetupCard
            icon={Drum}
            from="#ff7b6b"
            to="#ffc857"
            title="Rhythm Tap"
            blurb={
              <>
                Read the rhythm, listen to four clicks, then tap it: the big pad, the <b>Space bar</b>, or <b>any key on your keyboard</b>. Each
                tap is graded to the millisecond.
              </>
            }
            gameId="rhythm"
            levels={RHYTHM_LEVELS}
            level={level.id}
            onLevel={pickLevel}
            onStart={start}
          >
            <TempoControls bpm={bpm} setBpm={setBpm} clickOn={clickOn} setClickOn={setClickOn} />
          </SetupCard>
        </GameMain>
      )}
      {phase === 'play' && patterns[scores.length] && (
        <GameMain wide>
          <Hud step={scores.length} total={PATTERNS} score={avg} streak={0} label="Rhythm" />
          <Round key={scores.length} pattern={patterns[scores.length]} bpm={bpm} clickOn={clickOn} onDone={onDone} />
        </GameMain>
      )}
      {phase === 'done' && (
        <GameMain>
          <ResultsCard
            title={avg >= 90 ? 'Rock-solid rhythm!' : avg >= 70 ? 'Nice groove!' : 'Round complete'}
            score={avg}
            scoreLabel="%"
            stars={stars}
            result={finish}
            stats={[
              { label: 'Best rhythm', value: `${Math.max(...scores)}%` },
              { label: 'Tempo', value: `${bpm} BPM` },
              { label: 'Level', value: level.name },
            ]}
            onAgain={start}
            onSetup={() => setPhase('setup')}
          >
            {avg < 70 && <p className="mt-5 text-ink-soft">Tip: slow the tempo down a little and count out loud: “1, 2, 3, 4”.</p>}
          </ResultsCard>
        </GameMain>
      )}
    </div>
  )
}

function TempoControls({ bpm, setBpm, clickOn, setClickOn }: { bpm: number; setBpm: (n: number) => void; clickOn: boolean; setClickOn: (v: boolean) => void }) {
  return (
    <div className="glass flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:gap-8">
      <label className="flex flex-1 items-center gap-4">
        <span className="w-28 shrink-0 font-extrabold">
          Tempo <span className="block text-2xl text-gold">{bpm} BPM</span>
        </span>
        <Slider value={bpm} min={50} max={120} step={2} onChange={setBpm} label="Tempo" />
      </label>
      <label className="flex items-center gap-3 font-bold text-ink-soft">
        <Toggle checked={clickOn} onChange={setClickOn} label="Metronome while tapping" />
        Click while I tap
      </label>
    </div>
  )
}

type RoundPhase = 'ready' | 'listen' | 'countin' | 'run' | 'review'

function Round({ pattern, bpm, clickOn, onDone }: { pattern: RNote[]; bpm: number; clickOn: boolean; onDone: (score: number) => void }) {
  const [phase, setPhase] = useState<RoundPhase>('ready')
  const phaseRef = useRef<RoundPhase>('ready')
  const [beat, setBeat] = useState<number | null>(null)
  const [tapMarks, setTapMarks] = useState<number[]>([])
  const [result, setResult] = useState<ReturnType<typeof scoreTaps> | null>(null)
  const [best, setBest] = useState(0)
  const [cursor, setCursor] = useState<number | undefined>(undefined)
  const [pulse, setPulse] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const run = useRef({ t0: 0, beatSec: 60 / bpm, end: 0 })
  const [span, setSpan] = useState({ t0: 0, end: 1 })
  const taps = useRef<number[]>([])
  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])
  const playheadRef = useRef<HTMLDivElement>(null)

  const setP = (p: RoundPhase) => {
    phaseRef.current = p
    setPhase(p)
  }

  const stopAll = () => {
    clock.current?.stop()
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  useEffect(() => stopAll, [])

  const busy = phase === 'countin' || phase === 'run' || phase === 'listen'

  // Follow along: move the playhead and the staff cursor while the rhythm runs.
  useEffect(() => {
    if (!busy) return
    let id = 0
    const tick = () => {
      const { t0, end, beatSec } = run.current
      const now = perfToAudio(performance.now())
      if (playheadRef.current) playheadRef.current.style.left = `${Math.max(0, Math.min(1, (now - t0) / (end - t0))) * 100}%`
      const b = (now - t0) / beatSec
      let idx: number | undefined
      for (let i = 0; i < pattern.length; i++) if (pattern[i].start <= b + 1e-6) idx = i
      setCursor(b >= 0 && b < BEATS ? idx : undefined)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [busy, pattern])

  /** Count in one bar, then either play the rhythm (listen) or wait for taps. */
  const begin = async (listen: boolean) => {
    stopAll()
    const ctx = audio.unlock()
    const running = () => ctx.state === 'running'
    if (!running()) {
      // Browsers keep audio paused until a real tap; wait a moment for it to start.
      await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 600))])
      if (!running()) {
        setBlocked(true)
        return
      }
    }
    setBlocked(false)
    const beatSec = 60 / bpm
    const startAt = ctx.currentTime + 0.25
    const t0 = startAt + 4 * beatSec
    run.current = { t0, beatSec, end: t0 + BEATS * beatSec }
    setSpan({ t0, end: t0 + BEATS * beatSec })
    taps.current = []
    setTapMarks([])
    setResult(null)
    setP(listen ? 'listen' : 'countin')
    if (listen) {
      for (const b of onsetBeats(pattern)) audio.play(84, { dur: 0.16, vel: 0.8, when: t0 + b * beatSec })
    }
    const c = new Clock({
      interval: () => beatSec,
      onTick: (i, time) => {
        if (i < 4 + BEATS) {
          if (i < 4 || clickOn || listen) audio.click(i % 4 === 0, time)
          timers.current.push(
            audio.at(time, () => {
              setBeat(i - 4)
              if (i === 4 && !listen) setP('run')
            }),
          )
        } else {
          c.stop()
          timers.current.push(audio.at(time, () => (listen ? finishListen() : review())))
        }
      },
    })
    clock.current = c
    c.start(startAt - ctx.currentTime)
  }

  const finishListen = () => {
    setBeat(null)
    setCursor(undefined)
    setP('ready')
  }

  const review = () => {
    const { t0, beatSec } = run.current
    const expected = onsetBeats(pattern).map((b) => t0 + b * beatSec)
    const r = scoreTaps(expected, taps.current)
    setResult(r)
    setBest((b) => Math.max(b, r.score))
    setBeat(null)
    setCursor(undefined)
    setP('review')
    sfx(r.score >= 80 ? 'correct' : r.score >= 50 ? 'tap' : 'wrong')
  }

  const tap = (perfMs: number, latency = 0) => {
    const p = phaseRef.current
    if (p === 'ready' || p === 'review') {
      if (p === 'ready') void begin(false)
      return
    }
    if (p !== 'countin' && p !== 'run') return
    const t = perfToAudio(perfMs) - latency
    const { t0, end } = run.current
    // Taps along with the count-in are fine; only the rhythm itself is graded.
    if (t < t0 - 0.25 || t > end + 0.25) return
    taps.current.push(t)
    setTapMarks((m) => [...m, t])
    setPulse((x) => x + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      tap(e.timeStamp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useNoteEvents((e) => {
    if (e.type === 'on' && e.source !== 'screen') tap(e.time, e.source === 'mic' ? 0.07 : 0)
  })

  // Colour the notes on the staff once graded.
  const staffItems = useMemo(() => {
    if (!result) return patternToStaff(pattern)
    const noteResults: (NoteResult | null)[] = []
    let k = 0
    for (const n of pattern) noteResults.push(n.rest ? null : result.results[k++])
    const states = noteResults.map((r) => (!r ? 'normal' : r.grade === 'miss' ? 'wrong' : r.grade === 'ok' ? 'normal' : 'correct') as 'normal' | 'wrong' | 'correct')
    return patternToStaff(pattern, states)
  }, [pattern, result])
  const counts = result?.results.reduce<Record<Grade, number>>((acc, r) => ({ ...acc, [r.grade]: acc[r.grade] + 1 }), { perfect: 0, good: 0, ok: 0, miss: 0 })

  const xOf = (t: number) => `${Math.max(0, Math.min(1, (t - span.t0) / (span.end - span.t0))) * 100}%`

  return (
    <>
      <Paper className="pt-4">
        <Staff clef="rhythm" items={staffItems} time={[4, 4]} spacing="proportional" sp={17} colorNotes={false} cursor={cursor} reserveAbove={2} reserveBelow={2} />
      </Paper>

      {/* Timeline: beats, expected notes and your taps */}
      <div className="glass relative rounded-3xl px-5 pb-8 pt-6">
        <div className="relative h-16">
          {Array.from({ length: BEATS + 1 }, (_, b) => (
            <div key={b} className={`absolute bottom-0 top-0 w-px ${b % 4 === 0 ? 'bg-white/35' : 'bg-white/10'}`} style={{ left: `${(b / BEATS) * 100}%` }}>
              {b < BEATS && (
                <span className="absolute -bottom-6 left-1 text-xs font-extrabold text-ink-mute" style={{ color: beat !== null && Math.floor(beat) === b ? '#ffc857' : undefined }}>
                  {(b % 4) + 1}
                </span>
              )}
            </div>
          ))}
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/15" />
          {onsetBeats(pattern).map((b, i) => {
            const r = result?.results[i]
            return (
              <div key={i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(b / BEATS) * 100}%` }}>
                <span className="block size-4 rotate-45 rounded-[3px] border-2" style={{ borderColor: r ? GRADE_COLOR[r.grade] : '#cdc9e6', background: r && r.grade !== 'miss' ? GRADE_COLOR[r.grade] : 'transparent' }} />
                {r && (
                  <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[0.7rem] font-extrabold" style={{ color: GRADE_COLOR[r.grade] }}>
                    {r.error === null ? 'miss' : `${r.error > 0 ? '+' : ''}${Math.round(r.error * 1000)}`}
                  </span>
                )}
              </div>
            )
          })}
          {phase !== 'ready' &&
            tapMarks.map((t, i) => {
              const matched = result?.results.find((r) => r.tap === t)
              const color = result ? (matched ? GRADE_COLOR[matched.grade] : '#ff5c7a') : '#9b8cff'
              return (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-0 size-3 -translate-x-1/2 rounded-full"
                  style={{ left: xOf(t), background: color, boxShadow: `0 0 10px ${color}` }}
                />
              )
            })}
          {busy && <div ref={playheadRef} className="absolute bottom-[-6px] top-[-6px] w-0.5 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_12px_#ffc857]" />}
        </div>
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_1.1fr]">
        <motion.button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            tap(e.timeStamp)
          }}
          whileTap={{ scale: 0.97 }}
          className="relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-coral/40 bg-linear-to-b from-coral/25 to-gold/10 text-center"
          aria-label="Tap pad"
        >
          <AnimatePresence>
            <motion.span
              key={pulse}
              initial={{ scale: 0.2, opacity: 0.7 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute size-32 rounded-full bg-coral/50"
            />
          </AnimatePresence>
          <Hand size={44} className="relative text-coral" />
          <span className="relative mt-2 font-display text-3xl font-bold">
            {phase === 'countin' ? (beat !== null && beat < 0 ? 4 + beat + 1 : 'Ready…') : phase === 'run' ? 'Tap!' : phase === 'listen' ? 'Listen…' : 'Tap here'}
          </span>
          <span className="relative mt-1 text-sm font-bold text-ink-soft">or Space, or any piano key</span>
        </motion.button>

        <div className="glass flex flex-col justify-center gap-4 rounded-3xl p-5">
          {phase === 'review' && result && counts ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-5xl font-bold" style={{ color: result.score >= 80 ? '#3ddc97' : result.score >= 50 ? '#ffc857' : '#ff5c7a' }}>
                  {result.score}%
                </span>
                <span className="text-right text-lg font-extrabold text-ink-soft">
                  {result.score >= 90 ? 'Perfect timing!' : result.score >= 75 ? 'Nice groove!' : result.score >= 50 ? 'Getting there' : 'Try it again?'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-extrabold">
                {(['perfect', 'good', 'ok', 'miss'] as Grade[]).map((g) => (
                  <span key={g} className="rounded-full px-3 py-1" style={{ background: `${GRADE_COLOR[g]}22`, color: GRADE_COLOR[g] }}>
                    {counts[g]} {g === 'ok' ? 'close' : g === 'miss' ? 'missed' : g}
                  </span>
                ))}
                {result.extras.length > 0 && <span className="rounded-full bg-bad/15 px-3 py-1 text-bad">{result.extras.length} extra</span>}
              </div>
              <p className="text-sm text-ink-mute">Numbers under the notes are milliseconds: minus = early, plus = late.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="md" variant="secondary" icon={RotateCcw} onClick={() => void begin(false)}>
                  Try again
                </Button>
                <Button size="md" iconRight={SkipForward} onClick={() => onDone(Math.max(best, result.score))}>
                  Next
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-ink-soft">
                {blocked
                  ? 'Sound is still off in this browser. Tap the pad once, then press Start again.'
                  : busy
                    ? 'Keep the beat: tap on each note, stay quiet on rests.'
                    : 'Read it first. Count “1, 2, 3, 4” as you look along the notes.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" icon={Play} onClick={() => void begin(false)} disabled={busy}>
                  Start
                </Button>
                <Button size="lg" variant="secondary" icon={Volume2} onClick={() => void begin(true)} disabled={busy}>
                  Listen first
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
