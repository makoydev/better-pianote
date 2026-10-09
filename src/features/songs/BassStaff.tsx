import { motion } from 'motion/react'
import { SvgMusicText } from '../../components/MusicText'
import { ENGRAVING, GLYPH, WIDTH, accidentalGlyph } from '../../components/staff/glyphs'
import type { Layout, NoteState } from '../../components/staff/layout'
import { letterColor } from '../../lib/colors'
import { KEYSIG_POSITIONS, LETTERS, accText, keySignature, parseNote, stepOf } from '../../lib/theory'
import type { TimedNote } from './timeline'

/**
 * The left-hand staff under a song. The shared Staff draws one rhythm at a time, but the hands move
 * independently (a held bass note under moving melody), so this draws the bass clef itself and lines
 * each note up with the right-hand note it starts under, using the treble staff's layout.
 */
export function BassStaff({
  layout,
  notes,
  keySig,
  xAt,
  stateOf,
  colorNotes,
  labels,
  ink = '#1f1b33',
}: {
  layout: Layout
  notes: TimedNote[]
  keySig: number
  /** x position (in the treble layout) of a moment in time, in beats. */
  xAt: (beat: number) => number
  stateOf: (n: TimedNote) => NoteState
  colorNotes: boolean
  labels: boolean
  ink?: string
}) {
  const sp = layout.sp
  const top = 2.2 * sp
  const yOf = (p: number) => top + ((8 - p) * sp) / 2
  const height = top + 4 * sp + (labels ? 4.6 : 3.4) * sp
  const stemT = ENGRAVING.stem * sp
  const fontSize = 4 * sp
  const textSize = Math.max(11, sp * 1.15)

  // Mirror the treble header (clef, key signature, time signature) at the same x positions.
  const header: { x: number; y: number; ch: string }[] = []
  let k = 0
  for (const g of layout.header) {
    if (g.ch === GLYPH.gClef) header.push({ x: g.x, y: yOf(6), ch: GLYPH.fClef })
    else if (g.ch === GLYPH.sharp || g.ch === GLYPH.flat) {
      const pos = KEYSIG_POSITIONS.bass[g.ch === GLYPH.sharp ? 'sharp' : 'flat'][k++]
      header.push({ x: g.x, y: yOf(stepOf(parseNote(pos)) - 18), ch: g.ch })
    } else if (g.ch >= '' && g.ch <= '') {
      const isTop = g.y < layout.staffTop.treble + 2 * sp
      header.push({ x: g.x, y: yOf(isTop ? 6 : 2), ch: g.ch })
    }
  }
  const lineX1 = layout.staffLines[0]?.x1 ?? 0
  const lineX2 = layout.staffLines[0]?.x2 ?? layout.width
  const keyAcc: Record<number, number> = {}
  const sig = keySignature(keySig)
  sig.letters.forEach((l) => (keyAcc['CDEFGAB'.indexOf(l)] = sig.acc))

  return (
    <svg width={layout.width} height={height} className="block" style={{ overflow: 'visible' }} role="img" aria-label="Left hand">
      <g fill={ink}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={lineX1} x2={lineX2} y1={top + i * sp} y2={top + i * sp} stroke={ink} strokeWidth={ENGRAVING.staffLine * sp} />
        ))}
        {header.map((g, i) => (
          <text key={i} x={g.x} y={g.y} fontFamily="Bravura" fontSize={fontSize}>
            {g.ch}
          </text>
        ))}
        {layout.bars.map((b, i) => (
          <line key={i} x1={b.x1} x2={b.x2} y1={top} y2={top + 4 * sp} stroke={ink} strokeWidth={b.w} />
        ))}
        {notes.map((n) => {
          const note = parseNote(n.name)
          const p = stepOf(note) - 18
          const x = xAt(n.start)
          const y = yOf(p)
          const state = stateOf(n)
          const whole = n.ev.dur === 'w'
          const headW = (whole ? WIDTH.whole : WIDTH.black) * sp
          const ch = whole ? GLYPH.whole : n.ev.dur === 'h' ? GLYPH.half : GLYPH.black
          const up = p < 4
          const fill = state === 'wrong' ? '#e11d48' : colorNotes ? letterColor(note.letter, true) : ink
          const ledgers: number[] = []
          for (let lp = -2; lp >= p; lp -= 2) ledgers.push(lp)
          for (let lp = 10; lp <= p; lp += 2) ledgers.push(lp)
          const acc = note.acc !== (keyAcc[note.letter] ?? 0) ? accidentalGlyph(note.acc) : null
          return (
            <motion.g key={n.id} initial={false} animate={{ opacity: state === 'done' ? 0.42 : 1 }} transition={{ duration: 0.3 }}>
              {state === 'active' && (
                <g transform={`translate(${x + headW / 2} ${y})`}>
                  <circle r={headW * 1.15} fill="#ffc857" opacity={0.45} />
                  <circle
                    r={headW}
                    fill="none"
                    stroke="#f0a43a"
                    strokeWidth={headW * 0.16}
                    className="animate-pulse-ring"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  />
                </g>
              )}
              {ledgers.map((lp) => (
                <line
                  key={lp}
                  x1={x - ENGRAVING.ledgerExt * sp}
                  x2={x + headW + ENGRAVING.ledgerExt * sp}
                  y1={yOf(lp)}
                  y2={yOf(lp)}
                  stroke={ink}
                  strokeWidth={ENGRAVING.ledger * sp}
                />
              ))}
              {acc && (
                <text x={x - 0.22 * sp - acc.w * sp} y={y} fontFamily="Bravura" fontSize={fontSize}>
                  {acc.ch}
                </text>
              )}
              {!whole && (
                <line
                  x1={up ? x + headW - stemT / 2 : x + stemT / 2}
                  x2={up ? x + headW - stemT / 2 : x + stemT / 2}
                  y1={up ? y - 0.168 * sp : y + 0.168 * sp}
                  y2={up ? Math.min(y - 3.5 * sp, yOf(4)) : Math.max(y + 3.5 * sp, yOf(4))}
                  stroke={ink}
                  strokeWidth={stemT}
                />
              )}
              <text x={x} y={y} fontFamily="Bravura" fontSize={fontSize} fill={fill}>
                {ch}
              </text>
              {n.ev.dots > 0 && <circle cx={x + headW + 0.55 * sp} cy={p % 2 === 0 ? yOf(p + 1) : y} r={0.2 * sp} fill={ink} />}
              {n.finger !== undefined && (
                <text x={x + headW / 2} y={top + 4 * sp + 2 * sp} fontSize={textSize} fontWeight={800} textAnchor="middle" fontFamily="var(--font-sans)">
                  {n.finger}
                </text>
              )}
              {labels && (
                <text
                  x={x + headW / 2}
                  y={top + 4 * sp + 3.4 * sp}
                  fontSize={textSize}
                  fontWeight={800}
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fill={colorNotes ? letterColor(note.letter, true) : '#6b6585'}
                >
                  <SvgMusicText text={LETTERS[note.letter] + accText(note.acc)} />
                </text>
              )}
            </motion.g>
          )
        })}
      </g>
    </svg>
  )
}
