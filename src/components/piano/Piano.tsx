import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { audio } from '../../lib/audio/engine'
import { noteColor } from '../../lib/colors'
import { noteOff, noteOn } from '../../lib/input/bus'
import { SOLFEGE, fromMidi, isBlackKey, mod, pitchName } from '../../lib/theory'
import { useLive } from '../../state/live'
import { type KeyLabels, useSettings } from '../../state/settings'
import { MusicText } from '../MusicText'
import { Sparks } from './Sparks'
import { Trails } from './Trails'

export type MarkKind = 'target' | 'hint' | 'good' | 'bad' | 'scale' | 'root' | 'chord' | 'selected' | 'dim'
export interface KeyMark {
  kind: MarkKind
  /** Text on the key (e.g. "R", "3", a note name). */
  label?: string
}
export type Marks = Record<number, KeyMark | MarkKind>

export interface PianoProps {
  /** Lowest and highest MIDI notes to show (extended to white keys). */
  from: number
  to: number
  marks?: Marks
  /** Finger numbers (1 = thumb … 5 = pinky) drawn on keys. */
  fingers?: Record<number, number>
  labels?: KeyLabels | 'marked'
  interactive?: boolean
  /** "toggle": each tap selects/deselects a key (for building chords with a mouse). */
  mode?: 'play' | 'toggle'
  onToggle?: (midi: number) => void
  sparks?: boolean
  sparkHeight?: number
  /** Glowing light trails rising from held keys (Free Play). */
  trails?: boolean
  trailHeight?: number
  showPressed?: boolean
  middleC?: boolean
  octaveLabels?: boolean
  /** Height of the white keys in px. */
  height?: number
  /** Below this key width the keyboard scrolls sideways instead of shrinking. */
  minKeyWidth?: number
  className?: string
}

const BLACK_OFFSET: Record<number, number> = { 1: -0.07, 3: 0.07, 6: -0.09, 8: 0, 10: 0.09 }
const BLACK_W = 0.6

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

const normal = (m: KeyMark | MarkKind | undefined): KeyMark | undefined =>
  m === undefined ? undefined : typeof m === 'string' ? { kind: m } : m

export function Piano({
  from,
  to,
  marks = {},
  fingers = {},
  labels,
  interactive = true,
  mode = 'play',
  onToggle,
  sparks = false,
  sparkHeight = 140,
  trails = false,
  trailHeight = 220,
  showPressed = true,
  middleC = true,
  octaveLabels = false,
  height = 200,
  minKeyWidth = 34,
  className = '',
}: PianoProps) {
  const keyLabels = useSettings((s) => s.keyLabels)
  const colorNotes = useSettings((s) => s.colorNotes)
  const naming = useSettings((s) => s.naming)
  const held = useLive((s) => s.held)
  const [wrapRef, { width }] = useElementSize<HTMLDivElement>()
  const labelMode = labels ?? keyLabels

  const lo = isBlackKey(from) ? from - 1 : from
  const hi = isBlackKey(to) ? to + 1 : to
  const whites = useMemo(() => range(lo, hi).filter((m) => !isBlackKey(m)), [lo, hi])
  const W = 100 / whites.length
  const blacks = useMemo(
    () =>
      range(lo, hi)
        .filter(isBlackKey)
        .map((m) => ({
          midi: m,
          left: (whites.indexOf(m - 1) + 1) * W - (W * BLACK_W) / 2 + BLACK_OFFSET[mod(m, 12)] * W,
        })),
    [lo, hi, whites, W],
  )
  const scroll = width > 0 && width / whites.length < minKeyWidth
  const keyPx = scroll ? minKeyWidth : width / whites.length || 40

  const keyX = useCallback(
    (m: number) => {
      if (m < lo || m > hi) return null
      if (isBlackKey(m)) {
        const b = blacks.find((k) => k.midi === m)
        return b ? (b.left + (W * BLACK_W) / 2) / 100 : null
      }
      return ((whites.indexOf(m) + 0.5) * W) / 100
    },
    [lo, hi, blacks, whites, W],
  )

  const keyGeom = useCallback(
    (m: number) => {
      const x = keyX(m)
      if (x === null) return null
      return { x, w: ((isBlackKey(m) ? BLACK_W : 0.94) * W) / 100 }
    },
    [keyX, W],
  )

  // Pointer handling: multi-touch, and sliding across keys plays a glissando.
  const active = useRef(new Map<number, number | null>())
  const keyAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)
    const k = el?.closest<HTMLElement>('[data-midi]')
    return k ? Number(k.dataset.midi) : null
  }
  const press = (m: number) => {
    if (mode === 'toggle') {
      onToggle?.(m)
      audio.play(m, { dur: 0.9, vel: 0.7 })
      return
    }
    noteOn(m, 0.78, 'screen')
  }
  const release = (m: number) => {
    if (mode === 'play') noteOff(m, 'screen')
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!interactive || e.button > 0) return
    const m = keyAt(e.clientX, e.clientY)
    if (m === null) return
    if (!scroll) e.preventDefault()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* not capturable */
    }
    active.current.set(e.pointerId, m)
    press(m)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (mode === 'toggle' || !active.current.has(e.pointerId)) return
    const prev = active.current.get(e.pointerId) ?? null
    const m = keyAt(e.clientX, e.clientY)
    if (m === prev) return
    if (prev !== null) release(prev)
    if (m !== null) press(m)
    active.current.set(e.pointerId, m)
  }
  const onPointerEnd = (e: ReactPointerEvent) => {
    const m = active.current.get(e.pointerId)
    if (m !== undefined && m !== null) release(m)
    active.current.delete(e.pointerId)
  }

  const showLabel = (m: number, mark?: KeyMark) => {
    if (labelMode === 'none') return false
    if (labelMode === 'marked') return !!mark && mark.kind !== 'dim'
    if (labelMode === 'c') return mod(m, 12) === 0 || (!!mark && mark.kind !== 'dim')
    return true
  }
  const nameOf = (m: number) => {
    const n = fromMidi(m)
    return naming === 'solfege' ? SOLFEGE[n.letter] + (n.acc ? (n.acc > 0 ? '♯' : '♭') : '') : pitchName(n)
  }
  const labelSize = Math.max(10, Math.min(20, keyPx * 0.38))
  const hasBelowRow = middleC || octaveLabels

  return (
    <div className={`relative select-none ${className}`}>
      <div
        ref={wrapRef}
        className={scroll ? 'overflow-x-auto scrollbar-none' : ''}
        style={{ touchAction: scroll ? 'pan-x' : 'none' }}
      >
        <div className="relative" style={{ width: scroll ? whites.length * minKeyWidth : '100%' }}>
          {trails && <Trails geom={keyGeom} height={trailHeight} />}
          {sparks && <Sparks keyX={keyX} height={sparkHeight} />}
          <div
            role="group"
            aria-label="Piano keyboard"
            className="relative"
            style={{ height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {whites.map((m, i) => {
              const mark = normal(marks[m])
              const pressed = showPressed && m in held
              const color = colorNotes ? noteColor(m) : '#ffc857'
              return (
                <div
                  key={m}
                  data-midi={m}
                  aria-label={nameOf(m) + (Math.floor(m / 12) - 1)}
                  className="absolute top-0 bottom-0 px-[1px]"
                  style={{ left: `${i * W}%`, width: `${W}%` }}
                >
                  <div className="relative h-full overflow-hidden rounded-b-[10px]" style={whiteStyle(pressed, mark, color)}>
                    <MarkLayer mark={mark} color={color} black={false} />
                    {fingers[m] !== undefined && (
                      <Finger n={fingers[m]} black={false} size={labelSize} bottom={showLabel(m, mark) ? labelSize * 2.6 : labelSize * 0.9} />
                    )}
                    {showLabel(m, mark) && (
                      <span
                        className="absolute inset-x-0 text-center font-extrabold leading-none"
                        style={{
                          bottom: labelSize * 0.6,
                          fontSize: labelSize,
                          color: pressed || mark?.kind === 'chord' || mark?.kind === 'root' || mark?.kind === 'selected' ? '#1f1b33' : colorNotes ? noteColor(m, true) : '#5b5676',
                        }}
                      >
                        <MusicText text={mark?.label ?? nameOf(m)} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {blacks.map(({ midi: m, left }) => {
              const mark = normal(marks[m])
              const pressed = showPressed && m in held
              const color = colorNotes ? noteColor(m) : '#ffc857'
              const wide = keyPx * BLACK_W >= 22
              return (
                <div
                  key={m}
                  data-midi={m}
                  aria-label={nameOf(m)}
                  className="absolute top-0 z-10"
                  style={{ left: `${left}%`, width: `${W * BLACK_W}%`, height: '62%' }}
                >
                  <div className="relative h-full overflow-hidden rounded-b-[7px]" style={blackStyle(pressed, mark, color)}>
                    <MarkLayer mark={mark} color={color} black />
                    {fingers[m] !== undefined && <Finger n={fingers[m]} black size={labelSize * 0.9} bottom={labelSize * 0.5} />}
                    {wide && (mark || (labelMode === 'all' && keyPx > 44)) && mark?.kind !== 'dim' && fingers[m] === undefined && (
                      <span
                        className="absolute inset-x-0 text-center font-bold leading-none"
                        style={{ bottom: labelSize * 0.5, fontSize: labelSize * 0.72, color: mark ? '#fff' : '#bdb8dc' }}
                      >
                        <MusicText text={mark?.label ?? nameOf(m)} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {hasBelowRow && (
            <div className="relative h-6 text-[0.7rem] font-bold text-ink-mute">
              {whites.map((m, i) =>
                mod(m, 12) === 0 && (octaveLabels || (middleC && m === 60)) ? (
                  <span
                    key={m}
                    className={`absolute top-1 -translate-x-1/2 whitespace-nowrap ${m === 60 ? 'text-gold' : ''}`}
                    style={{ left: `${(i + 0.5) * W}%` }}
                  >
                    {m === 60 && middleC ? '▲ Middle C' : `C${Math.floor(m / 12) - 1}`}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function whiteStyle(pressed: boolean, mark: KeyMark | undefined, color: string): CSSProperties {
  const tint =
    mark?.kind === 'chord' || mark?.kind === 'root' || mark?.kind === 'selected'
      ? 0.55
      : mark?.kind === 'scale'
        ? 0.22
        : mark?.kind === 'good'
          ? 0
          : 0
  let bg = 'linear-gradient(180deg, #e4ddcf 0%, #fffdf8 5%, #f8f3e9 72%, #ece5d6 100%)'
  if (tint) bg = `linear-gradient(180deg, #f3eee4 0%, color-mix(in oklab, ${color} ${tint * 100}%, #fffdf8) 100%)`
  if (mark?.kind === 'good') bg = 'linear-gradient(180deg, #e9fff3 0%, #6fe3ae 100%)'
  if (mark?.kind === 'bad') bg = 'linear-gradient(180deg, #fff0f2 0%, #ff8fa0 100%)'
  if (pressed) bg = `linear-gradient(180deg, #f3eee4 0%, color-mix(in oklab, ${color} 70%, #fffdf8) 100%)`
  return {
    background: bg,
    transform: pressed ? 'translateY(2px)' : undefined,
    boxShadow: pressed
      ? `inset 0 -3px 0 #d6ccb9, inset 0 0 0 1px rgba(20,18,40,.28), 0 0 28px -2px ${color}`
      : 'inset 0 -7px 0 #dcd3c2, inset 0 0 0 1px rgba(20,18,40,.28), 0 6px 14px -8px rgba(0,0,0,.6)',
    opacity: mark?.kind === 'dim' ? 0.5 : 1,
    transition: 'transform 60ms, box-shadow 120ms, background 120ms',
  }
}

function blackStyle(pressed: boolean, mark: KeyMark | undefined, color: string): CSSProperties {
  let bg = 'linear-gradient(180deg, #3a3856 0%, #1d1c34 50%, #111024 100%)'
  if (mark?.kind === 'chord' || mark?.kind === 'root' || mark?.kind === 'selected')
    bg = `linear-gradient(180deg, #2a2840 0%, color-mix(in oklab, ${color} 80%, #2a2840) 100%)`
  if (mark?.kind === 'scale') bg = `linear-gradient(180deg, #2a2840 0%, color-mix(in oklab, ${color} 45%, #1d1c34) 100%)`
  if (mark?.kind === 'good') bg = 'linear-gradient(180deg, #1d3b31 0%, #2fbf80 100%)'
  if (mark?.kind === 'bad') bg = 'linear-gradient(180deg, #3b1d25 0%, #e0405f 100%)'
  if (pressed) bg = `linear-gradient(180deg, #2a2840 0%, ${color} 130%)`
  return {
    background: bg,
    transform: pressed ? 'translateY(3px)' : undefined,
    boxShadow: pressed
      ? `0 2px 0 #06050f, 0 0 24px 0 ${color}`
      : '0 5px 0 #06050f, inset 0 1px 0 rgba(255,255,255,.18), inset 0 -4px 0 rgba(255,255,255,.07), 0 8px 12px -4px rgba(0,0,0,.7)',
    opacity: mark?.kind === 'dim' ? 0.6 : 1,
    transition: 'transform 60ms, box-shadow 120ms, background 120ms',
  }
}

function MarkLayer({ mark, color, black }: { mark?: KeyMark; color: string; black: boolean }) {
  if (!mark) return null
  if (mark.kind === 'target' || mark.kind === 'root') {
    return (
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ bottom: black ? '14%' : '30%', width: '46%', aspectRatio: '1' }}>
        <span className="absolute inset-0 animate-pulse-ring rounded-full" style={{ background: color }} />
        <span className="absolute inset-0 rounded-full border-2 border-white/70" style={{ background: color, boxShadow: `0 0 14px ${color}` }} />
      </span>
    )
  }
  if (mark.kind === 'hint') {
    return <span className="pointer-events-none absolute inset-0 animate-pulse rounded-b-[inherit]" style={{ boxShadow: `inset 0 0 0 3px #ffc857, inset 0 -30px 30px -20px #ffc857` }} />
  }
  if (mark.kind === 'scale') {
    return (
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{ bottom: black ? '12%' : '34%', width: '22%', aspectRatio: '1', background: color, boxShadow: `0 0 10px ${color}` }}
      />
    )
  }
  return null
}

function Finger({ n, black, size, bottom }: { n: number; black: boolean; size: number; bottom: number }) {
  const d = Math.max(18, size * 1.5)
  return (
    <span
      className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full font-extrabold leading-none"
      style={{
        bottom,
        width: d,
        height: d,
        fontSize: d * 0.6,
        background: black ? '#fffdf8' : '#1f1b33',
        color: black ? '#1f1b33' : '#fffdf8',
        boxShadow: '0 2px 6px rgba(0,0,0,.35)',
      }}
    >
      {n}
    </span>
  )
}
