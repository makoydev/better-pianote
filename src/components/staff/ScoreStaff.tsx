import { useEffect, useMemo } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { measureMusicText } from '../../lib/musicText'
import { LETTERS, type Note, SOLFEGE, accText } from '../../lib/theory'
import { useSettings } from '../../state/settings'
import type { LaidEvent, NoteState, StaffNoteSpec } from './layout'
import { type ScoreInput, type ScoreLayout, colX, layoutScore } from './score'
import { StaffSvg } from './StaffSvg'

export interface ScoreStaffProps {
  input: ScoreInput
  /** Staff space in px (with `fit`: the largest it may be). */
  sp?: number
  /** Shrink to fit the container's width, down to minSp. */
  fit?: boolean
  minSp?: number
  labels?: boolean
  fingers?: boolean
  colorNotes?: boolean
  gap?: number
  reserveAbove?: number
  reserveBelow?: number
  /** Moment (beats) to mark with the playhead. */
  cursorTime?: number
  noteState?: (spec: StaffNoteSpec, e: LaidEvent) => NoteState | undefined
  eventState?: (e: LaidEvent) => NoteState | undefined
  /** Only draw what lies within this x range. */
  clip?: [number, number]
  title?: string
  ink?: string
  className?: string
  onLayout?: (l: ScoreLayout) => void
}

/** Real music (one or two staves, any number of voices) drawn with the score layout. */
export function ScoreStaff({
  input,
  sp: maxSp = 16,
  fit = false,
  minSp = 6,
  labels,
  fingers = true,
  colorNotes,
  gap,
  reserveAbove,
  reserveBelow,
  cursorTime,
  noteState,
  eventState,
  clip,
  title,
  ink,
  className = '',
  onLayout,
}: ScoreStaffProps) {
  const [ref, { width: cw }] = useElementSize<HTMLDivElement>()
  const settingsLabels = useSettings((s) => s.staffLabels)
  const settingsColor = useSettings((s) => s.colorNotes)
  const naming = useSettings((s) => s.naming)
  const showLabels = labels ?? settingsLabels
  const colored = colorNotes ?? settingsColor

  const layout = useMemo(() => {
    const labelFor = (n: Note) => (naming === 'solfege' ? SOLFEGE[n.letter] : LETTERS[n.letter]) + accText(n.acc)
    const base = { sp: maxSp, labels: showLabels, fingers, labelFor, measure: measureMusicText, gap, reserveAbove, reserveBelow }
    if (!fit) return layoutScore(input, base)
    if (!cw) return null
    const probe = layoutScore(input, { ...base, sp: 10 })
    let sp = Math.max(minSp, Math.min(maxSp, (cw / probe.width) * 10))
    let l = layoutScore(input, { ...base, sp })
    if (l.width > cw && sp > minSp) {
      sp = Math.max(minSp, sp * (cw / l.width))
      l = layoutScore(input, { ...base, sp })
    }
    // Spread the columns out to fill the width.
    if (l.width < cw - 2 && l.slots > 0) l = layoutScore(input, { ...base, sp, extraPerSlot: (cw - l.width - 1) / l.slots })
    return l
  }, [input, maxSp, minSp, fit, cw, showLabels, fingers, naming, gap, reserveAbove, reserveBelow])

  useEffect(() => {
    if (layout) onLayout?.(layout)
  }, [layout, onLayout])

  return (
    <div ref={ref} className={`w-full ${fit ? 'overflow-hidden' : ''} ${className}`}>
      {layout && (
        <StaffSvg
          layout={layout}
          ink={ink}
          colored={colored}
          animate={false}
          cursorX={cursorTime !== undefined ? colX(layout, cursorTime) : undefined}
          title={title}
          noteState={noteState}
          eventState={eventState}
          clip={clip}
          maxWidth={fit && cw ? cw : undefined}
        />
      )}
    </div>
  )
}
