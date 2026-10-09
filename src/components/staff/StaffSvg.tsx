import { AnimatePresence, motion } from 'motion/react'
import { letterColor } from '../../lib/colors'
import { SvgMusicText } from '../MusicText'
import type { ScoreLayout } from './score'
import type { LaidEvent, Layout, NoteState, StaffNoteSpec } from './layout'
import { WIDTH } from './glyphs'

const STATE_COLOR: Partial<Record<NoteState, string>> = { correct: '#15a34a', wrong: '#e11d48' }

export interface StaffSvgProps {
  layout: Layout | ScoreLayout
  ink?: string
  colored: boolean
  /** Fade/slide notes in and out as the music changes (off for long scrolling music). */
  animate?: boolean
  /** Event index to mark with a playhead … */
  cursor?: number
  /** … or an x position for it. */
  cursorX?: number
  title?: string
  /** Highlight per note and per event, applied when drawing (so the layout itself doesn't change). */
  noteState?: (spec: StaffNoteSpec, e: LaidEvent) => NoteState | undefined
  eventState?: (e: LaidEvent) => NoteState | undefined
  /** Only draw what lies within this x range. */
  clip?: [number, number]
}

/** Draws a laid-out staff (from layoutStaff or layoutScore) as SVG. */
export function StaffSvg({ layout, ink = '#1f1b33', colored, animate = true, cursor, cursorX, title, noteState, eventState, clip }: StaffSvgProps) {
  const headColor = (state: NoteState, letter: number, override?: string) =>
    STATE_COLOR[state] ?? override ?? (colored ? letterColor(letter, true) : ink)
  const inView = (x0: number, x1: number) => !clip || (x1 >= clip[0] && x0 <= clip[1])
  const events = clip ? layout.events.filter((e) => inView(e.x - 3 * layout.sp, e.x + e.width + 3 * layout.sp)) : layout.events
  const extras = 'extras' in layout ? layout.extras : null
  const cursorAt =
    cursorX !== undefined
      ? { x: cursorX, w: WIDTH.black * layout.sp }
      : cursor !== undefined && layout.events[cursor]
        ? { x: layout.events[cursor].headX, w: layout.events[cursor].headW }
        : null

  const drawEvent = (e: LaidEvent) => {
    const evState = eventState?.(e) ?? e.state
    const states = e.notes.map((n) => noteState?.(n.spec, e) ?? n.state)
    const body = (
      <>
        {e.notes.map((n, i) =>
          states[i] === 'active' ? (
            <g key={`halo${i}`} transform={`translate(${n.x + e.headW / 2} ${n.y})`}>
              <circle r={e.headW * 1.15} fill="#ffc857" opacity={0.45} />
              <circle
                r={e.headW * 1.0}
                fill="none"
                stroke="#f0a43a"
                strokeWidth={e.headW * 0.16}
                className="animate-pulse-ring"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            </g>
          ) : null,
        )}
        {e.lines.map((l, i) => (
          <line key={`l${i}`} x1={l.x1} x2={l.x2} y1={l.y1} y2={l.y2} stroke={ink} strokeWidth={l.w} />
        ))}
        {e.glyphs.map((g, i) => (
          <text key={`g${i}`} x={g.x} y={g.y} fontFamily="Bravura" fontSize={g.size} fill={g.color ?? ink}>
            {g.ch}
          </text>
        ))}
        {e.heads.map((h, i) => {
          const st = noteState ? (states[i] ?? h.state) : h.state
          return (
            <motion.text
              key={`n${i}-${st}`}
              x={h.x}
              y={h.y}
              fontFamily="Bravura"
              fontSize={h.size}
              fill={headColor(st, h.letter, h.color)}
              initial={st === 'correct' ? { scale: 1.7 } : st === 'wrong' ? { x: -6 } : false}
              animate={st === 'wrong' ? { x: [-6, 6, -4, 4, 0] } : { scale: 1, x: 0 }}
              transition={{ duration: 0.38 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              {h.ch}
            </motion.text>
          )
        })}
        {e.dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={ink} />
        ))}
        {e.texts.map((t, i) => (
          <TextItem key={`t${i}`} t={t} ink={ink} colored={colored} />
        ))}
      </>
    )
    const opacity = evState === 'ghost' ? 0.3 : evState === 'done' ? 0.42 : 1
    return animate ? (
      <motion.g
        key={e.key}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity, x: 0 }}
        exit={{ opacity: 0, y: -14, transition: { duration: 0.22 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        {body}
      </motion.g>
    ) : (
      <motion.g key={e.key} initial={false} animate={{ opacity }} transition={{ duration: 0.25 }}>
        {body}
      </motion.g>
    )
  }

  return (
    <svg
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={title ?? 'Music notation'}
      className="block"
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(0 ${layout.offsetY})`} fill={ink}>
        {layout.staffLines.map((l, i) => (
          <line key={`s${i}`} x1={l.x1} x2={l.x2} y1={l.y1} y2={l.y2} stroke={ink} strokeWidth={l.w} />
        ))}
        {cursorAt && (
          <motion.rect
            initial={false}
            animate={{ x: cursorAt.x - cursorAt.w * 0.75 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            y={layout.staffTop[layout.staves[0]] - 2 * layout.sp}
            width={cursorAt.w * 2.5}
            height={layout.staffTop[layout.staves[layout.staves.length - 1]] - layout.staffTop[layout.staves[0]] + 8 * layout.sp}
            rx={layout.sp * 0.6}
            fill="#ffc857"
            opacity={0.28}
          />
        )}
        {layout.header.map((g, i) => (
          <text key={`h${i}`} x={g.x} y={g.y} fontFamily="Bravura" fontSize={g.size}>
            {g.ch}
          </text>
        ))}
        {layout.bars.map((l, i) => (inView(l.x1, l.x2) ? <line key={`b${i}`} x1={l.x1} x2={l.x2} y1={l.y1} y2={l.y2} stroke={ink} strokeWidth={l.w} /> : null))}
        {animate ? <AnimatePresence initial={false}>{events.map(drawEvent)}</AnimatePresence> : events.map(drawEvent)}
        {layout.beams.map((b) => (b.x0 === undefined || inView(b.x0, b.x1 ?? b.x0) ? <polygon key={b.key} points={b.points} fill={ink} /> : null))}
        {layout.ties.map((t) => (t.x0 === undefined || inView(t.x0, t.x1 ?? t.x0) ? <path key={t.key} d={t.d} fill={ink} /> : null))}
        {extras && (
          <>
            {extras.lines.map((l, i) => (inView(l.x1, l.x2) ? <line key={`xl${i}`} x1={l.x1} x2={l.x2} y1={l.y1} y2={l.y2} stroke={ink} strokeWidth={l.w} /> : null))}
            {extras.glyphs.map((g, i) =>
              inView(g.x, g.x + 2 * layout.sp) ? (
                <text key={`xg${i}`} x={g.x} y={g.y} fontFamily="Bravura" fontSize={g.size} fill={g.color ?? ink}>
                  {g.ch}
                </text>
              ) : null,
            )}
            {extras.texts.map((t, i) => (inView(t.x - 4 * layout.sp, t.x + 12 * layout.sp) ? <TextItem key={`xt${i}`} t={t} ink={ink} colored={colored} /> : null))}
          </>
        )}
      </g>
    </svg>
  )
}

function TextItem({ t, ink, colored }: { t: Layout['events'][number]['texts'][number]; ink: string; colored: boolean }) {
  return (
    <text
      x={t.x}
      y={t.y}
      fontSize={t.size}
      textAnchor={t.anchor ?? (t.kind === 'chord' ? 'start' : 'middle')}
      fontFamily={t.kind === 'chord' ? 'var(--font-display)' : 'var(--font-sans)'}
      fontWeight={t.kind === 'chord' ? 700 : 800}
      fill={
        t.kind === 'chord'
          ? '#4b3fb0'
          : t.kind === 'label'
            ? (t.color ?? (colored ? letterColorFromText(t.text) : '#6b6585'))
            : t.kind === 'finger'
              ? ink
              : '#6b6585'
      }
    >
      <SvgMusicText text={t.text} />
    </text>
  )
}

function letterColorFromText(text: string): string {
  const i = 'CDEFGAB'.indexOf(text[0])
  if (i >= 0) return letterColor(i, true)
  const solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'].findIndex((s) => text.startsWith(s))
  return solfege >= 0 ? letterColor(solfege, true) : '#6b6585'
}
