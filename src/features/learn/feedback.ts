import type { Target } from '../../content/types'
import { fromMidi, mod, noteName, parseNote, pcOf, placeAtMidi, solfegeName } from '../../lib/theory'
import type { Naming } from '../../state/settings'
import { type ChordStatus, chordFound, targetMidis, wrongOctave } from './match'

/** What the feedback line says on a play step. Pure, so it's easy to test. */

/** A played key's name, spelled like the target when it's the same note (so F♯ stays F♯, not G♭). */
export function playedName(t: Target, midi: number, opts: { octave: boolean; naming: Naming }): string {
  const like = t.notes.map((n) => parseNote(n)).find((n) => pcOf(n) === mod(midi, 12))
  const n = like ? placeAtMidi(like.letter, like.acc, midi) : fromMidi(midi)
  const name = opts.naming === 'solfege' ? solfegeName(n) : noteName(n, { octave: false })
  return opts.octave ? name + n.oct : name
}

/** After a wrong note: name what you played, and say when only the octave was off. */
export function wrongNoteMessage(t: Target, midi: number, naming: Naming): string {
  const exact = !t.anyOctave
  const name = playedName(t, midi, { octave: exact, naming })
  if (wrongOctave(t, midi)) return `That's ${name}: right note, wrong octave.`
  return t.type === 'chord' ? `That's ${name}: it's not in this chord.` : `That's ${name}.`
}

/** While building a chord: how far along you are, or what's left to fix. */
export function chordMessage(t: Target, status: ChordStatus, notes: number[], naming: Naming): string | null {
  if (t.type !== 'chord') return null
  const total = new Set(targetMidis(t).map((m) => mod(m, 12))).size
  if (status === 'partial') return `${chordFound(t, notes)} of ${total} notes… keep going.`
  if (status === 'bass' && t.bass) {
    const bass = parseNote(t.bass)
    return `Right notes! Now put ${naming === 'solfege' ? solfegeName(bass) : noteName(bass, { octave: false })} at the bottom.`
  }
  if (status === 'voicing') return 'Right notes! Now play exactly the keys written.'
  return null
}
