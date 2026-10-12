import type { Naming } from '../state/settings'
import { type Note, SOLFEGE, accText, noteName } from './theory'

/** A note's name the way you chose in Settings: letters (E♭4) or fixed-do solfège (Mi♭4). */
export function nameNote(n: Note, naming: Naming, opts: { octave?: boolean } = {}): string {
  const base = naming === 'solfege' ? SOLFEGE[n.letter] + accText(n.acc) : noteName(n, { octave: false })
  return opts.octave ? base + n.oct : base
}
