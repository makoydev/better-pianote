import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { letterColor } from '../../lib/colors'
import { LETTERS, type Note, SOLFEGE, accText } from '../../lib/theory'
import { useSettings } from '../../state/settings'
import { measureMusicText } from '../../lib/musicText'
import { SvgMusicText } from '../MusicText'
import { type ClefKind, type Layout, type LayoutOptions, type NoteState, type StaffItem, layoutStaff } from './layout'

export type { Duration, NoteState, StaffBar, StaffEvent, StaffItem, StaffNoteSpec } from './layout'

export interface StaffProps {
  clef?: ClefKind
  items: StaffItem[]
  /** Sharps (+) or flats (−) in the key signature. */
  keySig?: number
  time?: [number, number]
  /** Largest staff space in px (the staff shrinks to fit, down to minSp). */
  sp?: number
  minSp?: number
  spacing?: 'even' | 'proportional'
  /** Minimum width per note in staff spaces (even spacing). */
  minSlot?: number
  justify?: boolean
  labels?: boolean
  colorNotes?: boolean
  fingers?: boolean
  reserveAbove?: number
  reserveBelow?: number
  gap?: number
  showClef?: boolean
  /** Draw the staff lines (turn off to layer notes over another staff). */
  lines?: boolean
  endBar?: boolean
  /** Render at `sp` with natural width (for horizontally scrolling music). */
  natural?: boolean
  /** Event index to mark with a playhead. */
  cursor?: number
  animate?: boolean
  ink?: string
  className?: string
  title?: string
  onLayout?: (l: Layout) => void
}

const STATE_COLOR: Partial<Record<NoteState, string>> = { correct: '#15a34a', wrong: '#e11d48' }

export function Staff({
  clef = 'treble',
  items,
  keySig = 0,
  time,
  sp: maxSp = 16,
  minSp = 7,
  spacing = 'even',
  minSlot = 4.5,
  justify = true,
  labels,
  colorNotes,
  fingers = true,
  reserveAbove = 2.5,
  reserveBelow = 2.5,
  gap = 5.5,
  showClef = true,
  lines = true,
  endBar = false,
  natural = false,
  cursor,
  animate = true,
  ink = '#1f1b33',
  className = '',
  title,
  onLayout,
}: StaffProps) {
  const [ref, { width: cw }] = useElementSize<HTMLDivElement>()
  const settingsLabels = useSettings((s) => s.staffLabels)
  const settingsColor = useSettings((s) => s.colorNotes)
  const naming = useSettings((s) => s.naming)
  const showLabels = labels ?? settingsLabels
  // Rhythm staffs only show timing, so the pitch colours would just be noise there.
  const colored = colorNotes ?? (clef === 'rhythm' ? false : settingsColor)

  const layout = useMemo(() => {
    const labelFor = (n: Note) => (naming === 'solfege' ? SOLFEGE[n.letter] : LETTERS[n.letter]) + accText(n.acc)
    const base: LayoutOptions = {
      clef,
      keySig,
      time,
      sp: maxSp,
      spacing,
      minSlot,
      showClef,
      lines,
      endBar,
      labels: clef === 'rhythm' ? false : showLabels,
      fingers,
      reserveAbove,
      reserveBelow,
      gap,
      extraPerSlot: 0,
      labelFor,
      measure: measureMusicText,
    }
    if (natural) return layoutStaff(items, base)
    if (!cw) return null
    const probe = layoutStaff(items, { ...base, sp: 10 })
    let sp = Math.max(minSp, Math.min(maxSp, (cw / probe.width) * 10))
    let l = layoutStaff(items, { ...base, sp })
    if (l.width > cw && sp > minSp) {
      sp = Math.max(minSp, sp * (cw / l.width))
      l = layoutStaff(items, { ...base, sp })
    }
    if (justify && l.width < cw - 2 && l.slots > 0) {
      l = layoutStaff(items, { ...base, sp, extraPerSlot: (cw - l.width - 1) / l.slots })
    }
    return l
  }, [items, clef, keySig, time, maxSp, minSp, spacing, minSlot, showClef, lines, endBar, showLabels, fingers, reserveAbove, reserveBelow, gap, natural, cw, justify, naming])

  useEffect(() => {
    if (layout) onLayout?.(layout)
  }, [layout, onLayout])

  const headColor = (state: NoteState, letter: number, override?: string) =>
    STATE_COLOR[state] ?? override ?? (colored ? letterColor(letter, true) : ink)

  return (
    <div ref={ref} className={`w-full ${natural ? '' : 'overflow-hidden'} ${className}`}>
      {layout && (
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
            {cursor !== undefined && layout.events[cursor] && (
              <motion.rect
                initial={false}
                animate={{ x: layout.events[cursor].headX - layout.events[cursor].headW * 0.75 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                y={layout.staffTop[layout.staves[0]] - 2 * layout.sp}
                width={layout.events[cursor].headW * 2.5}
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
            {layout.bars.map((l, i) => (
              <line key={`b${i}`} x1={l.x1} x2={l.x2} y1={l.y1} y2={l.y2} stroke={ink} strokeWidth={l.w} />
            ))}
            <AnimatePresence initial={false}>
              {layout.events.map((e) => (
                <motion.g
                  key={e.key}
                  initial={animate ? { opacity: 0, x: 18 } : false}
                  animate={{ opacity: e.state === 'ghost' ? 0.3 : e.state === 'done' ? 0.42 : 1, x: 0 }}
                  exit={{ opacity: 0, y: -14, transition: { duration: 0.22 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  {e.notes.map((n, i) =>
                    n.state === 'active' ? (
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
                  {e.heads.map((h, i) => (
                    <motion.text
                      key={`n${i}-${h.state}`}
                      x={h.x}
                      y={h.y}
                      fontFamily="Bravura"
                      fontSize={h.size}
                      fill={headColor(h.state, h.letter, h.color)}
                      initial={h.state === 'correct' ? { scale: 1.7 } : h.state === 'wrong' ? { x: -6 } : false}
                      animate={h.state === 'wrong' ? { x: [-6, 6, -4, 4, 0] } : { scale: 1, x: 0 }}
                      transition={{ duration: 0.38 }}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    >
                      {h.ch}
                    </motion.text>
                  ))}
                  {e.dots.map((d, i) => (
                    <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={ink} />
                  ))}
                  {e.texts.map((t, i) => (
                    <text
                      key={`t${i}`}
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
                  ))}
                </motion.g>
              ))}
            </AnimatePresence>
            {layout.beams.map((b) => (
              <polygon key={b.key} points={b.points} fill={ink} />
            ))}
            {layout.ties.map((t) => (
              <path key={t.key} d={t.d} fill={ink} />
            ))}
          </g>
        </svg>
      )}
    </div>
  )
}

function letterColorFromText(text: string): string {
  const i = 'CDEFGAB'.indexOf(text[0])
  if (i >= 0) return letterColor(i, true)
  const solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'].findIndex((s) => text.startsWith(s))
  return solfege >= 0 ? letterColor(solfege, true) : '#6b6585'
}
