import { useEffect, useMemo } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { LETTERS, type Note, SOLFEGE, accText } from '../../lib/theory'
import { useSettings } from '../../state/settings'
import { measureMusicText } from '../../lib/musicText'
import { type ClefKind, type Layout, type LayoutOptions, type StaffItem, layoutStaff } from './layout'
import { StaffSvg } from './StaffSvg'

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

  return (
    <div ref={ref} className={`w-full ${natural ? '' : 'overflow-hidden'} ${className}`}>
      {layout && <StaffSvg layout={layout} ink={ink} colored={colored} animate={animate} cursor={cursor} title={title} />}
    </div>
  )
}
