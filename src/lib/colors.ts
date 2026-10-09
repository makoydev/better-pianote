import { mod } from './theory/note'

/** One colour per letter, C → B, like a rainbow. Used on keys, notes and chips. */
export const LETTER_COLORS = ['#ff5d5d', '#ff9a3c', '#ffd447', '#4fd18b', '#3cc8e8', '#6c8cff', '#b57bff']
/** Deeper versions that stay readable on the cream "paper" behind sheet music. */
export const LETTER_INK = ['#d9343a', '#d9620c', '#b07d00', '#1f8f45', '#0a85a0', '#3456d1', '#7a3ee0']

/** Natural letter for each pitch class (black keys take the letter below: C♯ → C). */
const PC_LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]

function mix(a: string, b: string, t = 0.5) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** Colour for a MIDI note or pitch class; black keys blend their two neighbours. */
export function noteColor(midiOrPc: number, onPaper = false): string {
  const pc = mod(midiOrPc, 12)
  const table = onPaper ? LETTER_INK : LETTER_COLORS
  const black = [1, 3, 6, 8, 10].includes(pc)
  if (!black) return table[PC_LETTER[pc]]
  return mix(table[PC_LETTER[pc]], table[PC_LETTER[pc + 1]])
}

/** Colour for a spelled letter (0–6), so E♭ is drawn in E's colour on the staff. */
export function letterColor(letter: number, onPaper = false): string {
  return (onPaper ? LETTER_INK : LETTER_COLORS)[letter]
}
