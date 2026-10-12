import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../../content'
import { midi } from '../../lib/theory'
import { optionForChord, optionsForNote, playableQuiz } from './quizPlay'

const quizzes = ALL_LESSONS.flatMap(({ lesson }) =>
  lesson.steps.flatMap((s, i) => (s.kind === 'quiz' ? [{ where: `${lesson.id} #${i + 1}`, quiz: s, playable: playableQuiz(s.options, s.answer) }] : [])),
)
const find = (question: string) => quizzes.find((q) => q.quiz.question === question)!
const m = (...names: string[]) => names.map(midi)

describe('quizzes you can answer by playing', () => {
  it('takes options that are all note names or all chord symbols', () => {
    expect(playableQuiz(['C', 'F', 'D', 'B'], 0)?.kind).toBe('note')
    expect(playableQuiz(['G5', 'G3', 'A4', 'C5'], 0)?.kind).toBe('note')
    expect(playableQuiz(['B♭', 'B', 'D', 'A'], 0)?.kind).toBe('note')
    expect(playableQuiz(['Am', 'Em', 'Dm', 'A'], 0)?.kind).toBe('chord')
    expect(playableQuiz(['C', 'D', 'Am', 'Em'], 0)?.kind).toBe('chord')
    expect(playableQuiz(['Bm', 'B', 'F♯m', 'Em'], 0)?.kind).toBe('chord')
  })

  it('leaves the rest to tapping', () => {
    expect(playableQuiz(['F', 'G', 'D', 'E again'], 0)).toBeNull()
    expect(playableQuiz(['C D G', 'C F G', 'C E G', 'C E♭ G'], 0)).toBeNull()
    expect(playableQuiz(['Cmaj7 (dreamy)', 'C7 (bluesy)'], 0)).toBeNull()
    expect(playableQuiz(['A major', 'E major', 'D major', 'F♯ major'], 0)).toBeNull()
    expect(playableQuiz(['Dm – G – C', 'D – G – C'], 0)).toBeNull()
    expect(playableQuiz(['3', '4', '2', '5'], 0)).toBeNull()
    expect(playableQuiz(['5th', '4th', '6th', '3rd'], 0)).toBeNull()
  })

  it('needs the right answer to be its own key', () => {
    // E and F♭ are the same key: fine while both are wrong answers…
    expect(playableQuiz(['F', 'F♯', 'F♭', 'E'], 0)?.kind).toBe('note')
    // …but not when one of them is the answer, or when the same chord is spelled twice.
    expect(playableQuiz(['F', 'F♯', 'F♭', 'E'], 3)).toBeNull()
    expect(playableQuiz(['C6', 'Am7', 'G'], 0)).toBeNull()
  })

  it('covers the note and chord quizzes in the lessons', () => {
    const playable = quizzes.filter((q) => q.playable)
    expect(playable.map((q) => q.where)).toHaveLength(19)
    expect(find('Which white key sits just to the left of a group of two black keys?').playable?.kind).toBe('note')
    expect(find('What is the second note?').playable?.kind).toBe('note')
    expect(find('This starts on C. Which note does it jump up to?').playable?.kind).toBe('note')
    expect(find('In C major, what is the vi chord?').playable?.kind).toBe('chord')
    expect(find('In A major, what is the IV chord?').playable?.kind).toBe('chord')
    expect(find('Going up from E, what is the next white key?').playable).toBeNull()
    expect(find('Which notes are in Csus2?').playable).toBeNull()
    // Every quiz that qualifies has a right answer the keyboard can give.
    for (const q of playable) {
      const p = q.playable!
      if (p.kind === 'note') expect(p.notes[q.quiz.answer], q.where).toBeDefined()
      else expect(p.chords[q.quiz.answer], q.where).toBeDefined()
    }
  })
})

describe('a played note', () => {
  const q = playableQuiz(['A', 'F', 'C', 'E'], 0)!

  it('picks the option with its name, in any octave', () => {
    expect(optionsForNote(q, midi('A4'))).toEqual([0])
    expect(optionsForNote(q, midi('A2'))).toEqual([0])
    expect(optionsForNote(q, midi('C6'))).toEqual([2])
    expect(optionsForNote(q, midi('G4'))).toEqual([])
  })

  it('picks the exact key when the options name octaves', () => {
    const oct = playableQuiz(['G5', 'G3', 'A4', 'C5'], 0)!
    expect(optionsForNote(oct, midi('G5'))).toEqual([0])
    expect(optionsForNote(oct, midi('G3'))).toEqual([1])
    expect(optionsForNote(oct, midi('G4'))).toEqual([])
    // The mic can be an octave out, so G3 heard through it isn't a wrong answer.
    expect(optionsForNote(oct, midi('G3'), true)).toEqual([])
    expect(optionsForNote(oct, midi('A4'), true)).toEqual([2])
  })

  it('picks both options that share a key', () => {
    const q2 = playableQuiz(['F', 'F♯', 'F♭', 'E'], 0)!
    expect(optionsForNote(q2, midi('E4'))).toEqual([2, 3])
    expect(optionsForNote(q2, midi('F4'))).toEqual([0])
  })

  it('reads sharps and flats either way', () => {
    const q3 = playableQuiz(['E♭', 'F♯', 'B♭', 'G♯'], 0)!
    expect(optionsForNote(q3, midi('D#4'))).toEqual([0])
    expect(optionsForNote(q3, midi('Ab3'))).toEqual([3])
  })
})

describe('a held chord', () => {
  const q = playableQuiz(['Am', 'Em', 'Dm', 'A'], 0)!

  it('picks the chord it makes, in any voicing', () => {
    expect(optionForChord(q, m('A3', 'C4', 'E4'))).toBe(0)
    expect(optionForChord(q, m('C4', 'E4', 'A4'))).toBe(0)
    expect(optionForChord(q, m('A2', 'E3', 'A3', 'C4', 'E4'))).toBe(0)
    expect(optionForChord(q, m('A3', 'C#4', 'E4'))).toBe(3)
    expect(optionForChord(q, m('E3', 'G3', 'B3'))).toBe(1)
  })

  it('ignores chords that aren’t options, and chords still being built', () => {
    expect(optionForChord(q, m('C4', 'E4', 'G4'))).toBeNull()
    expect(optionForChord(q, m('A3', 'C4'))).toBeNull()
    expect(optionForChord(q, m('A3'))).toBeNull()
  })

  it('forgives a missing 5th through the mic for the right chord only', () => {
    expect(optionForChord(q, m('A3', 'C4'), true)).toBe(0)
    // E G heard through the mic could be a lot of things: it doesn't count as Em.
    expect(optionForChord(q, m('E3', 'G3'), true)).toBeNull()
    expect(optionForChord(q, m('E3', 'G3', 'B3'), true)).toBe(1)
  })

  it('needs the bass of a slash chord at the bottom', () => {
    const slash = playableQuiz(['C/E', 'C', 'G'], 0)!
    expect(optionForChord(slash, m('E3', 'G3', 'C4'))).toBe(0)
    expect(optionForChord(slash, m('C3', 'E3', 'G3'))).toBe(1)
  })
})
