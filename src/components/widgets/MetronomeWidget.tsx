import { Minus, Play, Plus, Square } from 'lucide-react'
import { LayoutGroup, AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, useId } from 'react'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { useNoteEvents } from '../../lib/input/bus'
import { Button, IconButton } from '../ui/Button'
import { Segmented, Slider } from '../ui/controls'

/** A metronome you can tap along to: it tells you if each tap was early, late or right on the beat. */

type Verdict = { label: string; color: string; ms: number }

/** Approximate classical tempo words for a BPM. */
function tempoWord(bpm: number): string {
  if (bpm < 61) return 'Largo · very slow'
  if (bpm < 77) return 'Adagio · slow'
  if (bpm < 109) return 'Andante · walking pace'
  if (bpm < 121) return 'Moderato · moderate'
  if (bpm < 169) return 'Allegro · fast'
  return 'Presto · very fast'
}

function judge(offsetSec: number): Verdict {
  const ms = Math.round(offsetSec * 1000)
  const a = Math.abs(ms)
  if (a <= 45) return { label: 'Perfect!', color: '#3ddc97', ms }
  if (a <= 100) return { label: ms < 0 ? 'A bit early' : 'A bit late', color: '#ffc857', ms }
  return { label: ms < 0 ? 'Early' : 'Late', color: '#ff7b6b', ms }
}

export function MetronomeWidget({ bpm: startBpm = 80, beats: startBeats = 4 }: { bpm?: number; beats?: number }) {
  const [bpm, setBpm] = useState(startBpm)
  const [beats, setBeats] = useState(startBeats)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(-1)
  const [pulse, setPulse] = useState(0)
  const [verdict, setVerdict] = useState<(Verdict & { id: number }) | null>(null)
  const [streak, setStreak] = useState(0)
  const bpmRef = useRef(bpm)
  const beatsRef = useRef(beats)
  const ticks = useRef<number[]>([])
  const timers = useRef<number[]>([])
  const clock = useRef<Clock | null>(null)

  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])
  useEffect(() => {
    beatsRef.current = beats
  }, [beats])

  const stop = () => {
    clock.current?.stop()
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    ticks.current = []
    setRunning(false)
    setBeat(-1)
  }

  const start = () => {
    stop()
    clock.current = new Clock({
      interval: () => 60 / bpmRef.current,
      onTick: (i, time) => {
        const b = i % beatsRef.current
        audio.click(b === 0, time)
        ticks.current = [...ticks.current.slice(-5), time]
        timers.current.push(
          audio.at(time, () => {
            setBeat(b)
            setPulse((p) => p + 1)
          }),
        )
        if (timers.current.length > 32) timers.current = timers.current.slice(-16)
      },
    })
    clock.current.start(0.15)
    setRunning(true)
    setStreak(0)
    setVerdict(null)
  }

  useEffect(() => () => stop(), [])

  // Restart on a new time signature so beat 1 stays accented.
  useEffect(() => {
    if (clock.current?.running) start()
  }, [beats])

  /** Judge a tap that happened at `perfTime` (performance.now()). */
  const tap = (perfTime = performance.now()) => {
    const ctx = audio.ctx
    if (!running || !ctx || ticks.current.length === 0) return
    // Taps follow what you hear, which comes out of the speakers a little after it's scheduled.
    const heardDelay = (ctx.outputLatency || ctx.baseLatency || 0) as number
    const t = ctx.currentTime - (performance.now() - perfTime) / 1000 - heardDelay
    const interval = 60 / bpmRef.current
    const last = ticks.current[ticks.current.length - 1]
    const candidates = [...ticks.current, last + interval]
    const nearest = candidates.reduce((best, c) => (Math.abs(c - t) < Math.abs(best - t) ? c : best), candidates[0])
    const v = judge(t - nearest)
    setVerdict({ ...v, id: perfTime })
    setStreak((s) => (v.label === 'Perfect!' ? s + 1 : 0))
  }

  useNoteEvents((e) => {
    if (e.type === 'on') tap(e.time)
  })

  // Space bar taps too, while the metronome runs.
  useEffect(() => {
    if (!running) return
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      tap(e.timeStamp || performance.now())
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const changeBpm = (v: number) => setBpm(Math.max(40, Math.min(200, Math.round(v))))

  // Scope animated highlights so two copies of this widget don't share them.
  const layoutGroup = useId()
  return (
    <LayoutGroup id={layoutGroup}>
      <div className="space-y-5">
        <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
          <div className="relative mx-auto flex size-40 items-center justify-center">
            <motion.span
              key={pulse}
              className="absolute inset-0 rounded-full"
              style={{ background: beat === 0 ? '#ffc857' : '#9b8cff' }}
              initial={{ scale: 0.8, opacity: running ? 0.55 : 0 }}
              animate={{ scale: 1.25, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <motion.div
              key={`c${pulse}`}
              className="relative flex size-36 flex-col items-center justify-center rounded-full border-4 bg-night-850"
              style={{ borderColor: beat === 0 ? '#ffc857' : running ? '#9b8cff' : 'rgba(255,255,255,.12)' }}
              initial={{ scale: running ? 1.08 : 1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              <span className="font-display text-5xl font-bold leading-none">{bpm}</span>
              <span className="mt-1 text-sm font-extrabold uppercase tracking-wider text-ink-mute">BPM</span>
            </motion.div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <IconButton icon={Minus} label="Slower" onClick={() => changeBpm(bpm - 4)} />
              <Slider value={bpm} min={40} max={200} onChange={changeBpm} label="Tempo" />
              <IconButton icon={Plus} label="Faster" onClick={() => changeBpm(bpm + 4)} />
            </div>
            <p className="text-center text-base font-bold text-ink-soft sm:text-left">{tempoWord(bpm)}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                size="sm"
                value={beats}
                onChange={setBeats}
                options={[2, 3, 4, 6].map((b) => ({ value: b, label: `${b} beats` }))}
              />
              <Button size="md" variant={running ? 'secondary' : 'primary'} icon={running ? Square : Play} onClick={running ? stop : start}>
                {running ? 'Stop' : 'Start'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-2.5">
          {Array.from({ length: beats }, (_, b) => (
            <motion.span
              key={b}
              className="flex size-11 items-center justify-center rounded-full text-lg font-extrabold"
              animate={{
                scale: beat === b ? 1.18 : 1,
                backgroundColor: beat === b ? (b === 0 ? '#ffc857' : '#9b8cff') : 'rgba(255,255,255,0.07)',
                color: beat === b ? '#0d0c24' : '#938fbb',
              }}
              transition={{ duration: 0.08 }}
            >
              {b + 1}
            </motion.span>
          ))}
        </div>

        <motion.button
          type="button"
          onPointerDown={(e) => {
            if (!running) start()
            else tap(e.timeStamp || performance.now())
          }}
          whileTap={{ scale: 0.97 }}
          className="relative flex h-32 w-full select-none flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-white/15 bg-night-850 text-center"
          style={{ touchAction: 'manipulation' }}
        >
          <AnimatePresence mode="popLayout">
            {verdict ? (
              <motion.span
                key={verdict.id}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                className="flex flex-col items-center"
              >
                <span className="font-display text-4xl font-bold" style={{ color: verdict.color }}>
                  {verdict.label}
                </span>
                <span className="text-sm font-bold text-ink-mute">
                  {verdict.ms === 0 ? 'right on it' : `${Math.abs(verdict.ms)} ms ${verdict.ms < 0 ? 'early' : 'late'}`}
                  {streak > 1 && ` · ${streak} perfect in a row`}
                </span>
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 text-lg font-extrabold text-ink-soft">
                {running ? 'Tap here on every click (or press Space, or any key on your keyboard)' : 'Tap to start, then tap along with the clicks'}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </LayoutGroup>
  )
}
