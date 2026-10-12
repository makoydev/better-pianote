import { motion } from 'motion/react'
import { type PointerEvent, useMemo, useRef, useState } from 'react'
import type { LaidEvent, NoteState, StaffId, StaffNoteSpec } from '../../components/staff/layout'
import { type ScoreLayout, type ScoreOptions, colX, layoutScore } from '../../components/staff/score'
import { StaffSvg, type StaffSvgProps } from '../../components/staff/StaffSvg'
import type { Song } from '../../content/songs'
import { useElementSize } from '../../hooks/useElementSize'
import { measureMusicText } from '../../lib/musicText'
import { LETTERS, type Note, SOLFEGE, accText } from '../../lib/theory'
import { useSettings } from '../../state/settings'
import type { Hands } from './results'
import { type ScoreLine, type ScoreSize, layoutLines, lineAt, linesThatFit, staffSpace, topLine } from './systems'
import { type Timeline, barAt, songScoreInput } from './timeline'

/** Room around the music inside the paper (px): sides, and top + bottom (the progress bar sits at the bottom). */
const PAD_X = 16
const PAD_Y = 12
const SPRING = { type: 'spring', stiffness: 110, damping: 22, mass: 0.9 } as const

export interface ScoreViewProps {
  song: Song
  tl: Timeline
  hands: Hands
  size: ScoreSize
  /** The moment (beats) the cursor marks. */
  cursorTime: number
  noteState: (spec: StaffNoteSpec) => NoteState | undefined
  eventState: (e: LaidEvent) => NoteState | undefined
  /** Fade one staff (the right hand's while you practise the left). */
  dim?: StaffId
  /** The looped bars, shaded. */
  loopBars: [number, number] | null
  /** Tapping a bar, or dragging across bars, picks them (first and last bar). */
  onPickBars: (bars: [number, number]) => void
  title: string
  className?: string
}

type Band = NonNullable<StaffSvgProps['bands']>[number]
type SvgProps = Pick<StaffSvgProps, 'colored' | 'animate' | 'title' | 'noteState' | 'eventState' | 'dim'>

/**
 * The song's music, using the room it's given: several lines filling the width when two or more fit (iPad
 * portrait), otherwise one long line that scrolls with the cursor, sized to fit the height. Bars are numbered as on
 * paper; tap a bar or drag across bars to pick them.
 */
export function ScoreView(props: ScoreViewProps) {
  const { song, tl, hands, size, cursorTime, noteState, eventState, dim, loopBars, onPickBars, title, className = '' } = props
  const [ref, box] = useElementSize<HTMLDivElement>()
  const labels = useSettings((s) => s.staffLabels)
  const naming = useSettings((s) => s.naming)
  const colored = useSettings((s) => s.colorNotes)

  const input = useMemo(() => songScoreInput(song, tl, { hands, barNumbers: true }), [song, tl, hands])
  const grand = input.staves.length > 1
  const opts = useMemo<ScoreOptions>(() => {
    const labelFor = (n: Note) => (naming === 'solfege' ? SOLFEGE[n.letter] : LETTERS[n.letter]) + accText(n.acc)
    return { sp: staffSpace(size, grand), labels, fingers: true, labelFor, measure: measureMusicText, reserveBelow: grand ? 1.2 : 2.5 }
  }, [size, grand, labels, naming])
  const full = useMemo(() => layoutScore(input, opts), [input, opts])
  const width = Math.max(0, box.width - 2 * PAD_X)
  const height = Math.max(0, box.height - PAD_Y)
  const lines = useMemo(
    () => (width > 0 ? layoutLines((a, b) => songScoreInput(song, tl, { hands, bars: [a, b], barNumbers: true }), tl.bars.length, width, opts) : []),
    [song, tl, hands, width, opts],
  )
  const shown = linesThatFit(lines, height)

  // One line: as big as the size you chose, smaller when the height is short, a little bigger when there's room.
  const tapeSp = height > 0 ? Math.round(Math.min(opts.sp * 1.25, Math.max(7, (opts.sp * height * 0.97) / full.height)) * 2) / 2 : opts.sp
  const tape = useMemo(() => (shown > 1 ? null : tapeSp === opts.sp ? full : layoutScore(input, { ...opts, sp: tapeSp })), [shown, tapeSp, full, input, opts])

  // ---- Picking bars: press on a bar, drag to another, let go ----
  const drag = useRef<{ id: number; from: number; to: number } | null>(null)
  const [picking, setPicking] = useState<[number, number] | null>(null)
  /** The bar under a point on screen (each line of music is marked with its first bar). */
  const barUnder = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-first-bar]')
    const svg = el?.querySelector('svg')
    const layout = el && (tape ?? lines.find((l) => l.from === Number(el.dataset.firstBar))?.layout)
    if (!el || !svg || !layout) return null
    const r = svg.getBoundingClientRect()
    const lx = ((x - r.left) * layout.width) / Math.max(1, r.width)
    const i = layout.barX.findIndex((b) => lx < b.x1)
    return Number(el.dataset.firstBar) + (i < 0 ? layout.barX.length - 1 : i)
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return
    const bar = barUnder(e.clientX, e.clientY)
    if (bar === null) return
    drag.current = { id: e.pointerId, from: bar, to: bar }
    setPicking([bar, bar])
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const bar = d && d.id === e.pointerId ? barUnder(e.clientX, e.clientY) : null
    if (!d || bar === null || bar === d.to) return
    d.to = bar
    setPicking([Math.min(d.from, bar), Math.max(d.from, bar)])
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setPicking(null)
    onPickBars([Math.min(d.from, d.to), Math.max(d.from, d.to)])
  }
  const onCancel = () => {
    drag.current = null
    setPicking(null)
  }

  /** The shaded stretches inside a layout whose first bar is `from`. */
  const bandsFor = (layout: ScoreLayout, from: number): Band[] => {
    const out: Band[] = []
    const add = (range: [number, number] | null, kind: Band['kind']) => {
      if (!range) return
      const a = Math.max(range[0], from) - from
      const b = Math.min(range[1], from + layout.barX.length - 1) - from
      if (a <= b) out.push({ x0: layout.barX[a].x0, x1: layout.barX[b].x1, kind })
    }
    add(picking ? null : loopBars, 'loop')
    add(picking, 'pick')
    return out
  }

  const svg: SvgProps = { colored, animate: false, title, noteState, eventState, dim }
  return (
    <div
      ref={ref}
      className={`relative cursor-pointer touch-none overflow-hidden select-none ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      {tape ? (
        <Tape layout={tape} cursorTime={cursorTime} viewWidth={box.width} bands={bandsFor(tape, 0)} svg={svg} />
      ) : (
        <Lines lines={lines} shown={shown} slot={height / shown} width={width} cursorTime={cursorTime} barOf={(t) => barAt(tl, t)} bandsFor={bandsFor} svg={svg} />
      )}
    </div>
  )
}

/** One long line that slides along with the cursor (a third of the way in), drawing only what's near the screen. */
function Tape({ layout, cursorTime, viewWidth, bands, svg }: { layout: ScoreLayout; cursorTime: number; viewWidth: number; bands: Band[]; svg: SvgProps }) {
  const cursorX = colX(layout, cursorTime)
  const max = Math.max(0, layout.width + 2 * PAD_X - viewWidth)
  const scrollX = viewWidth ? Math.max(0, Math.min(max, cursorX - viewWidth * 0.33)) : 0
  const clip: [number, number] | undefined = viewWidth ? [scrollX - viewWidth, scrollX + 2 * viewWidth] : undefined
  return (
    <>
      <div data-first-bar={0} className="absolute inset-0 flex items-center pb-1.5">
        <motion.div className="w-max px-4" initial={false} animate={{ x: -scrollX }} transition={SPRING}>
          <StaffSvg layout={layout} cursorX={cursorX} clip={clip} bands={bands} {...svg} />
        </motion.div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-paper to-transparent" />
    </>
  )
}

/** Several lines, each in an equal slot; they move up a line at a time as you read down them. */
function Lines(props: {
  lines: ScoreLine[]
  shown: number
  slot: number
  width: number
  cursorTime: number
  barOf: (t: number) => number
  bandsFor: (layout: ScoreLayout, from: number) => Band[]
  svg: SvgProps
}) {
  const { lines, shown, slot, width, cursorTime, barOf, bandsFor, svg } = props
  const cur = lineAt(lines, barOf, cursorTime)
  const [top, setTop] = useState(0)
  const next = topLine(top, cur, shown, lines.length)
  // Remember which line is on top between renders (it depends on where it was, not just on the cursor).
  if (next !== top) setTop(next)
  return (
    <motion.div className="absolute inset-x-0 top-0 pt-1" initial={false} animate={{ y: -next * slot }} transition={SPRING}>
      {lines.map((l, i) => (
        <div key={`${l.from}-${l.to}`} data-first-bar={l.from} className="flex items-center px-4" style={{ height: slot }}>
          {i >= next - 1 && i <= next + shown && (
            <StaffSvg
              layout={l.layout}
              cursorX={i === cur ? colX(l.layout, cursorTime) : undefined}
              maxWidth={width}
              bands={bandsFor(l.layout, l.from)}
              {...svg}
            />
          )}
        </div>
      ))}
    </motion.div>
  )
}
