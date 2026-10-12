import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import type { LaidEvent, NoteState, StaffId, StaffNoteSpec } from '../../components/staff/layout'
import { type ScoreLayout, type ScoreOptions, colX, layoutScore } from '../../components/staff/score'
import { StaffSvg } from '../../components/staff/StaffSvg'
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
  title: string
  className?: string
}

/**
 * The song's music, using the room it's given: several lines filling the width when two or more fit (iPad
 * portrait), otherwise one long line that scrolls with the cursor, sized to fit the height.
 */
export function ScoreView({ song, tl, hands, size, cursorTime, noteState, eventState, dim, title, className = '' }: ScoreViewProps) {
  const [ref, box] = useElementSize<HTMLDivElement>()
  const labels = useSettings((s) => s.staffLabels)
  const naming = useSettings((s) => s.naming)
  const colored = useSettings((s) => s.colorNotes)

  const input = useMemo(() => songScoreInput(song, tl, { hands }), [song, tl, hands])
  const grand = input.staves.length > 1
  const opts = useMemo<ScoreOptions>(() => {
    const labelFor = (n: Note) => (naming === 'solfege' ? SOLFEGE[n.letter] : LETTERS[n.letter]) + accText(n.acc)
    return { sp: staffSpace(size, grand), labels, fingers: true, labelFor, measure: measureMusicText, reserveBelow: grand ? 1.2 : 2.5 }
  }, [size, grand, labels, naming])
  const full = useMemo(() => layoutScore(input, opts), [input, opts])
  const width = Math.max(0, box.width - 2 * PAD_X)
  const height = Math.max(0, box.height - PAD_Y)
  const lines = useMemo(
    () => (width > 0 ? layoutLines((a, b) => songScoreInput(song, tl, { hands, bars: [a, b] }), full, width, opts) : []),
    [song, tl, hands, full, width, opts],
  )
  const shown = linesThatFit(lines, height)

  // One line: as big as the size you chose, smaller when the height is short, a little bigger when there's room.
  const tapeSp = height > 0 ? Math.round(Math.min(opts.sp * 1.25, Math.max(7, (opts.sp * height * 0.97) / full.height)) * 2) / 2 : opts.sp
  const tape = useMemo(() => (shown > 1 ? null : tapeSp === opts.sp ? full : layoutScore(input, { ...opts, sp: tapeSp })), [shown, tapeSp, full, input, opts])

  const svg = { colored, animate: false, title, noteState, eventState, dim }
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {tape ? (
        <Tape layout={tape} cursorTime={cursorTime} viewWidth={box.width} svg={svg} />
      ) : (
        <Lines lines={lines} shown={shown} slot={height / shown} width={width} cursorTime={cursorTime} barOf={(t) => barAt(tl, t)} svg={svg} />
      )}
    </div>
  )
}

type SvgProps = Pick<Parameters<typeof StaffSvg>[0], 'colored' | 'animate' | 'title' | 'noteState' | 'eventState' | 'dim'>

/** One long line that slides along with the cursor (a third of the way in), drawing only what's near the screen. */
function Tape({ layout, cursorTime, viewWidth, svg }: { layout: ScoreLayout; cursorTime: number; viewWidth: number; svg: SvgProps }) {
  const cursorX = colX(layout, cursorTime)
  const max = Math.max(0, layout.width + 2 * PAD_X - viewWidth)
  const scrollX = viewWidth ? Math.max(0, Math.min(max, cursorX - viewWidth * 0.33)) : 0
  const clip: [number, number] | undefined = viewWidth ? [scrollX - viewWidth, scrollX + 2 * viewWidth] : undefined
  return (
    <>
      <div className="absolute inset-0 flex items-center pb-1.5">
        <motion.div className="w-max px-4" initial={false} animate={{ x: -scrollX }} transition={SPRING}>
          <StaffSvg layout={layout} cursorX={cursorX} clip={clip} {...svg} />
        </motion.div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-paper to-transparent" />
    </>
  )
}

/** Several lines, each in an equal slot; they move up a line at a time as you read down them. */
function Lines(props: { lines: ScoreLine[]; shown: number; slot: number; width: number; cursorTime: number; barOf: (t: number) => number; svg: SvgProps }) {
  const { lines, shown, slot, width, cursorTime, barOf, svg } = props
  const cur = lineAt(lines, barOf, cursorTime)
  const [top, setTop] = useState(0)
  const next = topLine(top, cur, shown, lines.length)
  // Remember which line is on top between renders (it depends on where it was, not just on the cursor).
  if (next !== top) setTop(next)
  return (
    <motion.div className="absolute inset-x-0 top-0 pt-1" initial={false} animate={{ y: -next * slot }} transition={SPRING}>
      {lines.map((l, i) => {
        const near = i >= next - 1 && i <= next + shown
        const here = i === cur
        return (
          <div key={`${l.from}-${l.to}`} className="flex items-center px-4" style={{ height: slot }}>
            {near && <StaffSvg layout={l.layout} cursorX={here ? colX(l.layout, cursorTime) : undefined} maxWidth={width} {...svg} />}
          </div>
        )
      })}
    </motion.div>
  )
}
