import { micHearsChord } from '../../lib/input/micMatch'
import { type Chord, chordPcs, midiOf, mod, parseChord, parseNote, pcOf } from '../../lib/theory'
import { matchChord } from '../practice/logic/chords'

/**
 * Quizzes whose options are all note names ("What is this note?") or all chord symbols ("In C major, what is
 * vi?") can be answered on the keyboard too: a note picks the option with its name, a held chord the option it
 * makes. Pure, so it's easy to test.
 */

/** An option's note: its pitch class, and the exact key when the option names an octave ("G5"). */
interface NoteOption {
  pc: number
  midi: number | null
}

export type PlayableQuiz = { kind: 'note'; answer: number; notes: NoteOption[] } | { kind: 'chord'; answer: number; chords: Chord[] }

const NOTE_NAME = /^[A-G](?:#{1,2}|x|b{1,2}|♯{1,2}|♭{1,2}|𝄪|𝄫)?(-?\d+)?$/

function noteOption(s: string): NoteOption | null {
  const m = NOTE_NAME.exec(s.trim())
  if (!m) return null
  const n = parseNote(s)
  return { pc: pcOf(n), midi: m[1] === undefined ? null : midiOf(n) }
}

function chordOption(s: string): Chord | null {
  try {
    return parseChord(s)
  } catch {
    return null
  }
}

const noteMatches = (o: NoteOption, midi: number) => (o.midi === null ? o.pc === mod(midi, 12) : o.midi === midi)

const sameChord = (a: Chord, b: Chord) => {
  const pa = new Set(chordPcs(a))
  const pb = new Set(chordPcs(b))
  const bass = (c: Chord) => (c.bass ? pcOf(c.bass) : null)
  return pa.size === pb.size && [...pa].every((p) => pb.has(p)) && bass(a) === bass(b)
}

/**
 * Can this quiz be answered by playing, and how? Only when every option is a note name (any octave, or an
 * exact one like G5) or every option is a chord symbol, and the right answer can't be mistaken for another option
 * on the keyboard. Wrong options may share a key (E and F♭): playing it marks both wrong.
 */
export function playableQuiz(options: string[], answer: number): PlayableQuiz | null {
  const notes = options.map(noteOption)
  if (notes.every((n) => n !== null)) {
    const right = notes[answer]!
    for (let m = 21; m <= 108; m++) {
      if (noteMatches(right, m) && notes.some((n, k) => k !== answer && noteMatches(n!, m))) return null
    }
    return { kind: 'note', answer, notes: notes as NoteOption[] }
  }
  const chords = options.map(chordOption)
  if (chords.every((c) => c !== null)) {
    if (chords.some((c, k) => k !== answer && sameChord(c!, chords[answer]!))) return null
    return { kind: 'chord', answer, chords: chords as Chord[] }
  }
  return null
}

/** The options a played note picks: the ones with its name (two when two options are the same key, like E and F♭). */
export function optionsForNote(q: PlayableQuiz, midi: number, mic = false): number[] {
  if (q.kind !== 'note') return []
  const picks = q.notes.flatMap((o, k) => (noteMatches(o, midi) ? [k] : []))
  // The mic can be an octave out: the right note name in another octave isn't a wrong answer.
  if (mic && !picks.includes(q.answer) && q.notes[q.answer].pc === mod(midi, 12)) return []
  return picks
}

/**
 * The option a held chord makes, or null. Octaves, order and doublings don't matter; a slash chord needs its bass
 * note lowest. Through the mic the right chord may be missing its perfect 5th (see micHearsChord), as long as what
 * was heard isn't just as much a part of another option (C E could be C or Am); a wrong option has to be heard in
 * full before it counts against you.
 */
export function optionForChord(q: PlayableQuiz, midis: number[], mic = false): number | null {
  const heard = new Set(midis.map((m) => mod(m, 12)))
  if (q.kind !== 'chord' || heard.size < 2) return null
  const within = (c: Chord) => {
    const pcs = chordPcs(c)
    return [...heard].every((p) => pcs.includes(p))
  }
  const forgiven = (c: Chord, k: number) => micHearsChord(midis, c) && !q.chords.some((o, j) => j !== k && within(o))
  const fits = (c: Chord, k: number) => (mic && k === q.answer ? forgiven(c, k) : matchChord(midis, c) === 'correct')
  const hits = q.chords.flatMap((c, k) => (fits(c, k) ? [k] : []))
  // "C/E" is more specific than "C" when both fit.
  return hits.find((k) => q.chords[k].bass) ?? hits[0] ?? null
}
