import { type Layout, type NoteState, type StaffItem, layoutStaff } from '../../../components/staff/layout'
import { LETTERS, accText } from '../../../lib/theory'
import { measureMusicText } from '../../../lib/musicText'
import type { RushClef } from './logic'

export interface TapeNote {
  key: number
  name: string
  staff?: 'treble' | 'bass'
  state: NoteState
}

/**
 * The notes sliding along Note Rush's tape, laid out for drawing over a fixed staff that shows the clef and key
 * signature. Every note is its own bar, so its accidental is always measured against the key signature: a second
 * F♯ keeps its sharp, and in G major an F♯ needs none. The bar lines and the signature itself aren't drawn.
 */
export function tapeLayout(notes: TapeNote[], o: { clef: RushClef; keySig: number; sp: number; reserve: number }): Layout {
  const items: StaffItem[] = notes.flatMap((n, k) => {
    const note: StaffItem = { key: n.key, notes: [n.name], dur: 'w', staff: n.staff, state: n.state }
    return k ? [{ bar: 'single' as const, key: `bar${n.key}` }, note] : [note]
  })
  const l = layoutStaff(items, {
    clef: o.clef,
    keySig: o.keySig,
    sp: o.sp,
    spacing: 'even',
    minSlot: 6,
    showClef: false,
    lines: false,
    endBar: false,
    labels: false,
    fingers: false,
    reserveAbove: o.reserve,
    reserveBelow: o.reserve,
    gap: 5.5,
    extraPerSlot: 0,
    // Names are never shown on the tape (they'd give the answer away).
    labelFor: (n) => LETTERS[n.letter] + accText(n.acc),
    measure: measureMusicText,
  })
  return { ...l, header: [], bars: [] }
}
