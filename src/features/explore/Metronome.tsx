import { Gauge, Hand, Minus, Play, Plus, Square } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chips, Slider, Toggle } from '../../components/ui/controls'
import { audio } from '../../lib/audio/engine'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'
import { pauseComputerKeys } from '../../lib/input/keys'
import { getPref, setPref, usePref, usePrefs } from '../../state/prefs'
import { type Trainer, restartMetronome, startMetronome, stopMetronome, toggleMetronome, trainerPref, useMetronome } from './metronomeEngine'
import { MAX_BPM, METERS, MIN_BPM, clampBpm, tapTempo, tempoName } from './tempo'

const SUBDIVISIONS = [
  { value: 1, label: 'Beats' },
  { value: 2, label: 'Eighths' },
  { value: 3, label: 'Triplets' },
  { value: 4, label: 'Sixteenths' },
]
const SUB_VALUES = SUBDIVISIONS.map((s) => s.value)
const METER_IDS = METERS.map((m) => m.id)

/** Older builds saved { bpm, meter } as "tonic-metronome": move it into prefs (which Export carries), once. */
function moveOldSave() {
  const old = getPref<{ bpm?: unknown; meter?: unknown } | null>('metronome', null)
  if (!old) return
  const { values } = usePrefs.getState()
  if (typeof old.bpm === 'number' && Number.isFinite(old.bpm) && !('metronome:bpm' in values)) setPref('metronome:bpm', clampBpm(old.bpm))
  if (typeof old.meter === 'string' && METER_IDS.includes(old.meter) && !('metronome:meter' in values)) setPref('metronome:meter', old.meter)
  try {
    localStorage.removeItem('tonic-metronome')
  } catch {
    /* storage unavailable: nothing to move */
  }
}
moveOldSave()

export function Metronome() {
  const [savedBpm, setBpm] = usePref('metronome:bpm', 90)
  const bpm = clampBpm(savedBpm)
  const [meterId, setMeterId] = usePref('metronome:meter', '4/4', METER_IDS)
  const [sub, setSub] = usePref('metronome:sub', 1, SUB_VALUES)
  const [accent, setAccent] = usePref('metronome:accent', true)
  // The clock itself lives in metronomeEngine, so it keeps going when you leave this page.
  const running = useMetronome((s) => s.running)
  const beat = useMetronome((s) => s.beat)
  const swing = useMetronome((s) => s.count)
  usePrefs((p) => p.values['metronome:trainer'])
  const trainer = trainerPref()
  const setTrainer = (patch: Partial<Trainer>) => setPref('metronome:trainer', { ...trainer, ...patch })
  const taps = useRef<number[]>([])
  const meter = METERS.find((m) => m.id === meterId) ?? METERS[2]

  // Subdivision or metre changes restart the count from beat 1.
  const restartWith = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    restartMetronome()
  }

  const tap = () => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 8000), now]
    const t = tapTempo(taps.current)
    if (t) setBpm(t)
    audio.click(false)
  }

  // The computer keyboard belongs to the shortcuts here (T would also play F♯ on the computer-keys piano).
  useEffect(() => pauseComputerKeys(), [])

  // Space starts/stops, T taps the tempo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainKey(e)) return
      // The tempo slider keeps focus after a drag but has no use for Space, so Space still starts and stops.
      const slider = e.target instanceof HTMLInputElement && e.target.type === 'range'
      if (isTypingTarget(e.target) && !slider) return
      if (e.code === 'Space') {
        // A button focused with Tab gets Space as its click.
        if (isButtonTarget(e.target)) return
        e.preventDefault()
        toggleMetronome()
      } else if (e.code === 'KeyT') tap()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const beatLen = 60 / bpm
  const accented = beat >= 0 && accent && meter.accents.includes(beat)

  return (
    <div className="min-h-dvh pb-10">
      <TopBar back="/explore" title="Metronome" subtitle="Keep steady time (Space to start and stop)" />
      <main className="mx-auto grid max-w-[1300px] gap-5 px-3 pt-5 sm:px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="relative flex flex-col items-center overflow-hidden py-8">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            animate={{ opacity: beat >= 0 ? [0.55, 0] : 0 }}
            transition={{ duration: Math.min(0.5, beatLen * 0.8) }}
            key={`flash-${swing}`}
            style={{ background: `radial-gradient(circle at 50% 40%, ${accented ? '#ffc85755' : '#9b8cff3a'}, transparent 65%)` }}
          />
          <Pendulum swing={swing} running={running} beatLen={beatLen} />
          <div className="relative mt-6 text-center">
            <div className="font-display text-8xl font-bold leading-none tracking-tight sm:text-9xl">{bpm}</div>
            <div className="mt-1 text-lg font-extrabold uppercase tracking-[0.2em] text-gold">{tempoName(bpm)}</div>
          </div>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3" aria-hidden>
            {Array.from({ length: meter.beats }, (_, b) => {
              const on = b === beat
              const acc = accent && meter.accents.includes(b)
              return (
                <motion.span
                  key={b}
                  animate={{ scale: on ? 1.4 : 1, opacity: on ? 1 : 0.35 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                  className={`flex size-10 items-center justify-center rounded-full text-sm font-extrabold ${acc ? 'bg-gold text-night-900' : 'bg-violet text-night-900'}`}
                  style={on ? { boxShadow: `0 0 26px ${acc ? '#ffc857' : '#9b8cff'}` } : undefined}
                >
                  {b + 1}
                </motion.span>
              )
            })}
          </div>
          <div className="relative mt-8 flex w-full max-w-md gap-3 px-4">
            {running ? (
              <Button size="xl" variant="danger" icon={Square} block onClick={stopMetronome}>
                Stop
              </Button>
            ) : (
              <Button size="xl" icon={Play} block onClick={startMetronome}>
                Start
              </Button>
            )}
            <Button size="xl" variant="secondary" icon={Hand} onClick={tap} title="Tap along to set the tempo (or press T)">
              Tap
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Tempo</h2>
            <div className="flex items-center gap-3">
              <IconButton icon={Minus} label="Slower" size={52} onClick={() => setBpm(clampBpm(bpm - 1))} />
              <Slider value={bpm} min={MIN_BPM} max={MAX_BPM} onChange={setBpm} label="Tempo in beats per minute" />
              <IconButton icon={Plus} label="Faster" size={52} onClick={() => setBpm(clampBpm(bpm + 1))} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[60, 72, 80, 92, 100, 120].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBpm(v)}
                  className={`min-h-11 rounded-xl border px-3 font-extrabold transition-colors ${v === bpm ? 'border-gold bg-gold text-night-900' : 'border-white/10 bg-night-750 text-ink-soft hover:text-ink'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Time signature</h2>
            <Chips value={meterId} onChange={restartWith(setMeterId)} options={METERS.map((m) => ({ value: m.id, label: m.label }))} />
            <label className="mt-4 flex items-center justify-between gap-3 font-extrabold text-ink-soft">
              Accent the first beat
              <Toggle checked={accent} onChange={setAccent} label="Accent the first beat" />
            </label>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink-mute">Clicks per beat</h2>
            <Chips value={sub} onChange={restartWith(setSub)} options={SUBDIVISIONS} />
            <p className="mt-3 text-sm text-ink-mute">
              Softer clicks between the beats help you place eighth notes (“1 &”), triplets (“1 trip-let”) and sixteenths (“1 e & a”).
            </p>
          </Card>
          <Card>
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-ink-mute">
                <Gauge size={18} /> Speed trainer
              </span>
              <Toggle checked={trainer.on} onChange={(on) => setTrainer({ on })} label="Speed trainer" />
            </label>
            <p className="mt-2 text-ink-soft">
              Learn a passage slowly, then let the metronome speed up by itself: slow and clean beats fast and messy.
            </p>
            {trainer.on && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 font-bold text-ink-soft">
                  Add
                  <Chips value={trainer.step} onChange={(step) => setTrainer({ step })} options={[2, 4, 6, 8].map((v) => ({ value: v, label: `+${v}` }))} />
                  BPM
                </div>
                <div className="flex flex-wrap items-center gap-2 font-bold text-ink-soft">
                  every
                  <Chips value={trainer.every} onChange={(every) => setTrainer({ every })} options={[2, 4, 8].map((v) => ({ value: v, label: String(v) }))} />
                  bars
                </div>
                <div className="flex items-center gap-3 font-bold text-ink-soft">
                  up to
                  <IconButton icon={Minus} label="Lower target" size={48} onClick={() => setTrainer({ target: clampBpm(trainer.target - 4) })} />
                  <span className="w-14 text-center font-display text-2xl text-ink">{trainer.target}</span>
                  <IconButton icon={Plus} label="Higher target" size={48} onClick={() => setTrainer({ target: clampBpm(trainer.target + 4) })} />
                  BPM
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}

/** A classic wind-up metronome whose arm swings to each click. */
function Pendulum({ swing, running, beatLen }: { swing: number; running: boolean; beatLen: number }) {
  const angle = running ? (swing % 2 === 0 ? 26 : -26) : 0
  return (
    <div className="relative h-56 w-48" aria-hidden>
      <svg viewBox="0 0 120 140" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="metronome-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3070" />
            <stop offset="1" stopColor="#1d1a40" />
          </linearGradient>
        </defs>
        <path d="M40 8 L80 8 L108 132 L12 132 Z" fill="url(#metronome-body)" stroke="rgba(255,255,255,.12)" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="22" y="112" width="76" height="20" rx="4" fill="#ffc857" opacity="0.9" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1="56" x2="64" y1={22 + i * 9} y2={22 + i * 9} stroke="rgba(255,255,255,.18)" strokeWidth="1.2" />
        ))}
      </svg>
      <motion.div
        className="absolute bottom-[19%] left-1/2 h-[72%] w-1.5 origin-bottom -translate-x-1/2 rounded-full bg-ink"
        animate={{ rotate: angle }}
        transition={{ duration: running ? beatLen : 0.4, ease: 'easeInOut' }}
      >
        <span className="absolute left-1/2 top-[16%] block h-5 w-7 -translate-x-1/2 rounded-md bg-coral shadow-[0_0_14px_#ff7b6b]" />
      </motion.div>
    </div>
  )
}
