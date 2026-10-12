import { Crosshair, type LucideIcon, Minus, Play, Plus, Repeat } from 'lucide-react'
import { type PointerEvent, useEffect, useRef } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/controls'
import type { Song } from '../../content/songs'
import { barName, barNumber, ordinal } from './bars'

/**
 * Section practice: loop some bars (picked here, or by tapping or dragging across bars on the music), loop around
 * where you are, or start from the first of them and play on to the end.
 */
export function LoopControls({
  song,
  loop,
  bars,
  onLoop,
  onBars,
  onAround,
  onStartFrom,
}: {
  song: Song
  loop: boolean
  bars: [number, number]
  onLoop: (on: boolean) => void
  onBars: (bars: [number, number]) => void
  /** Loop the bar you're on, with one either side. */
  onAround: () => void
  /** Play or practise from this bar to the end (the loop goes off). */
  onStartFrom: (bar: number) => void
}) {
  const last = song.rh.length - 1
  const [a, b] = bars
  return (
    <div
      className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl border border-white/8 bg-night-850 px-3 py-1.5"
      title="Tip: tap a bar on the music to loop it, or drag across bars"
    >
      <Toggle checked={loop} onChange={onLoop} label="Loop some bars" />
      <Repeat size={18} className={loop ? 'text-gold' : 'text-ink-mute'} />
      {loop ? (
        <>
          <span className="flex items-center gap-1 text-sm font-extrabold">
            <Stepper label="First bar" song={song} bar={a} onStep={(d) => onBars([Math.min(b, Math.max(0, a + d)), b])} min={0} max={b} />
            <span className="px-0.5 text-ink-mute">to</span>
            <Stepper label="Last bar" song={song} bar={b} onStep={(d) => onBars([a, Math.min(last, Math.max(a, b + d))])} min={a} max={last} />
          </span>
          <Button size="sm" variant="secondary" icon={Play} onClick={() => onStartFrom(a)} title="Loop off: play from here to the end">
            Start from {barName(song, a)}
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm font-extrabold text-ink-soft">Loop</span>
          <Button size="sm" variant="secondary" icon={Crosshair} onClick={onAround} title="Loop the bar you’re on, with one either side">
            Loop around here
          </Button>
        </>
      )}
    </div>
  )
}

/** − bar +, where holding − or + keeps stepping. */
function Stepper({ label, song, bar, onStep, min, max }: { label: string; song: Song; bar: number; onStep: (d: 1 | -1) => void; min: number; max: number }) {
  const n = barNumber(song, bar)
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <HoldButton icon={Minus} label={`${label} earlier`} onPress={() => onStep(-1)} disabled={bar <= min} />
      <span className="flex min-w-[3.2rem] flex-col items-center leading-tight" aria-live="polite">
        <span>{n ? n.number : 'Pickup'}</span>
        {n && n.pass > 1 && <span className="text-[0.65rem] font-bold text-ink-mute">{ordinal(n.pass)} time</span>}
      </span>
      <HoldButton icon={Plus} label={`${label} later`} onPress={() => onStep(1)} disabled={bar >= max} />
    </span>
  )
}

/** A 44 px round button that repeats while you hold it (after a short pause), like a keyboard's key repeat. */
function HoldButton({ icon, label, onPress, disabled }: { icon: LucideIcon; label: string; onPress: () => void; disabled: boolean }) {
  // Each repeat calls the newest handler (it moves on from the bar the last press reached).
  const latest = useRef(onPress)
  useEffect(() => {
    latest.current = onPress
  })
  const timer = useRef(0)
  const stop = () => {
    window.clearTimeout(timer.current)
    timer.current = 0
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (disabled) stop()
  }, [disabled])
  const start = (e: PointerEvent) => {
    if (e.button > 0) return
    stop()
    latest.current()
    const again = (ms: number) => {
      timer.current = window.setTimeout(() => {
        latest.current()
        again(110)
      }, ms)
    }
    again(420)
  }
  return (
    <IconButton
      icon={icon}
      label={label}
      size={44}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // A press from the keyboard (Enter or Space) steps once; pointer presses were handled on the way down.
      onClick={(e) => e.detail === 0 && latest.current()}
    />
  )
}
