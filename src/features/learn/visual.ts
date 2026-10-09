import type { KeyMark, Marks } from '../../components/piano/Piano'
import type { KeyboardVisual } from '../../content/types'
import { midiOf, parseNote } from '../../lib/theory'

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
