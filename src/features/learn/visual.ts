import type { KeyMark, Marks } from '../../components/piano/Piano'
import type { KeyboardVisual, Visual } from '../../content/types'
import { isBlackKey, midiOf, parseNote } from '../../lib/theory'

export const noteMidi = (n: string) => midiOf(parseNote(n))

/** Convert a keyboard description (note names) into Piano props (MIDI numbers). */
export function pianoProps(k: KeyboardVisual) {
  const marks: Marks = {}
  for (const [n, m] of Object.entries(k.marks ?? {})) marks[noteMidi(n)] = m as KeyMark
  const fingers: Record<number, number> = {}
  for (const [n, f] of Object.entries(k.fingers ?? {})) fingers[noteMidi(n)] = f
  return { from: noteMidi(k.from), to: noteMidi(k.to), marks, fingers, labels: k.labels, octaveLabels: k.octaveLabels }
}

/** Keyboard height that suits the number of keys and the screen. */
export function keyboardHeight(from: number, to: number) {
  const span = to - from
  if (span > 40) return 150
  if (span > 26) return 190
  return 230
}

/** Staff size for lesson pictures: smaller on short screens, so the whole picture fits. */
export const pictureSp = (vh: number) => (vh < 720 ? 13 : vh < 880 ? 16 : 20)

/**
 * Pictures narrow enough to sit beside the text on a wide screen, where they get the full height: a keyboard of up
 * to 16 white keys (still 34 px a key in half the width), with or without a staff, and the tall grand staff.
 */
export function besideText(v: Visual | undefined): boolean {
  if (!v || v.widget) return false
  if (v.keyboard) {
    let whites = 0
    for (let m = noteMidi(v.keyboard.from); m <= noteMidi(v.keyboard.to); m++) if (!isBlackKey(m)) whites++
    return whites <= 16
  }
  return v.staff?.clef === 'grand'
}
