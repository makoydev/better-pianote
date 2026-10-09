import { Hand, Minus, Play, Plus, Square } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '../../components/layout/TopBar'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chips, Slider, Toggle } from '../../components/ui/controls'
import { Clock } from '../../lib/audio/clock'
import { audio } from '../../lib/audio/engine'
import { softTick } from './drums'
import { MAX_BPM, METERS, MIN_BPM, clampBpm, tapTempo, tempoName } from './tempo'

const SUBDIVISIONS = [
  { value: 1, label: 'Beats' },
  { value: 2, label: 'Eighths' },
  { value: 3, label: 'Triplets' },
  { value: 4, label: 'Sixteenths' },
]

const STORE = 'tonic-metronome'

function loadSaved(): { bpm: number; meter: string } {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) {
      const v = JSON.parse(raw) as { bpm?: number; meter?: string }
      return { bpm: clampBpm(v.bpm ?? 90), meter: METERS.some((m) => m.id === v.meter) ? v.meter! : '4/4' }
    }
  } catch {
    /* storage unavailable: use defaults */
  }
  return { bpm: 90, meter: '4/4' }
}

export function Metronome() {
  const [saved] = useState(loadSaved)
  const [bpm, setBpm] = useState(saved.bpm)
  const [meterId, setMeterId] = useState(saved.meter)
  const [sub, setSub] = useState(1)
  const [accent, setAccent] = useState(true)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(-1)
  const [swing, setSwing] = useState(0)
  const taps = useRef<number[]>([])
  const meter = METERS.find((m) => m.id === meterId) ?? METERS[2]

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ bpm, meter: meterId }))
    } catch {
      /* ignore */
    }
  }, [bpm, meterId])

  const live = useRef({ bpm, meter, sub, accent })
  useEffect(() => {
    live.current = { bpm, meter, sub, accent }
  })

  const clock = useRef<Clock | null>(null)
  const timers = useRef<number[]>([])
  const stop = useCallback(() => {
    clock.current?.stop()
    clock.current = null
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setRunning(false)
    setBeat(-1)
  }, [])
  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    stop()
    const c = new Clock({
      interval: () => 60 / live.current.bpm / live.current.sub,
      onTick: (i, time) => {
        const L = live.current
        if (i % L.sub !== 0) {
          softTick(time)
          return
        }
        const n = Math.floor(i / L.sub)
        const b = n % L.meter.beats
        audio.click(L.accent && L.meter.accents.includes(b), time)
        timers.current = [
          ...timers.current.slice(-16),
          audio.at(time, () => {
            setBeat(b)
            setSwing(n)
          }),
        ]
      },
    })
    clock.current = c
    c.start(0.08)
    setRunning(true)
  }, [stop])

  // Subdivision or metre changes restart the count from beat 1.
  const restartWith = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    if (clock.current) window.setTimeout(start, 0)
  }

  const tap = () => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 8000), now]
    const t = tapTempo(taps.current)
    if (t) setBpm(t)
    audio.click(false)
  }

  // Space starts/stops, T taps the tempo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (clock.current) stop()
        else start()
      } else if (e.code === 'KeyT' && !e.repeat) tap()
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
              <Button size="xl" variant="danger" icon={Square} block onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button size="xl" icon={Play} block onClick={start}>
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
              <IconButton icon={Minus} label="Slower" size={52} onClick={() => setBpm((b) => clampBpm(b - 1))} />
              <Slider value={bpm} min={MIN_BPM} max={MAX_BPM} onChange={setBpm} label="Tempo in beats per minute" />
              <IconButton icon={Plus} label="Faster" size={52} onClick={() => setBpm((b) => clampBpm(b + 1))} />
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
            <p className="text-ink-soft">
              <b className="text-ink">Practice tip:</b> learn a hard passage slowly, at a tempo where you make no mistakes. Then go up by 4 BPM at a time. Slow
              and clean beats fast and messy.
            </p>
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
