import { describe, expect, it } from 'vitest'
import type { PlayStep, StaffVisual } from '../../content/types'
import { RunJudge } from '../../lib/timing'
import { beatsOf, reportRun, staffRhythm, stepRhythm } from './rhythm'

const C4 = 60
const D4 = 62
const E4 = 64

describe('a play step’s rhythm', () => {
  it('reads written lengths, dots and rests', () => {
    expect(beatsOf('h', 1)).toBe(3)
    expect(beatsOf('q', 1)).toBe(1.5)
    expect(beatsOf('8')).toBe(0.5)
    const staff: StaffVisual = {
      clef: 'treble',
      time: [3, 4],
      items: [{ notes: ['C4'], dur: 'h' }, { notes: [{ note: 'E4', finger: 3 }] }, { bar: 'single' }, { notes: ['D4'], dur: 'q', dots: 1 }, { notes: ['C4'], dur: '8' }, { dur: 'q' }, { bar: 'final' }],
    }
    expect(staffRhythm(staff, [C4, E4, D4, C4])).toEqual({
      notes: [
        { midi: C4, at: 0, len: 2, event: 0 },
        { midi: E4, at: 2, len: 1, event: 1 },
        { midi: D4, at: 3, len: 1.5, event: 2 },
        { midi: C4, at: 4.5, len: 0.5, event: 3 },
      ],
      meter: 3,
      beats: 6,
    })
  })

  it('holds a tied note on instead of playing it again', () => {
    const staff: StaffVisual = { clef: 'treble', time: [4, 4], items: [{ notes: ['C4'], dur: 'h' }, { notes: ['E4'], dur: 'h', tie: true }, { bar: 'single' }, { notes: ['E4'], dur: 'h' }, { notes: ['D4'], dur: 'h' }] }
    expect(staffRhythm(staff, [C4, E4, D4])?.notes).toEqual([
      { midi: C4, at: 0, len: 2, event: 0 },
      { midi: E4, at: 2, len: 4, event: 1 },
      { midi: D4, at: 6, len: 2, event: 3 },
    ])
  })

  it('has no rhythm when the staff doesn’t spell out the notes to play', () => {
    const items: StaffVisual['items'] = [{ notes: ['C4'] }, { notes: ['D4'] }]
    expect(staffRhythm({ clef: 'treble', items }, [C4, D4])).toBeNull()
    expect(staffRhythm({ clef: 'treble', time: [4, 4], items }, [C4, E4])).toBeNull()
    expect(staffRhythm({ clef: 'treble', time: [4, 4], items }, [C4, D4, E4])).toBeNull()
    expect(staffRhythm({ clef: 'treble', time: [4, 4], items }, [C4 + 12, D4], true)).not.toBeNull()
  })

  it('gives a timed step without a staff a note on each beat', () => {
    const step: PlayStep = { kind: 'play', prompt: '', target: { type: 'sequence', notes: ['C4', 'C4', 'C4', 'C4', 'C4'] }, timed: { bpm: 60 } }
    expect(stepRhythm(step)).toMatchObject({ meter: 4, beats: 8, notes: [{ at: 0 }, { at: 1 }, { at: 2 }, { at: 3 }, { at: 4 }] })
    expect(stepRhythm({ ...step, timed: undefined })).toBeNull()
  })
})

describe('what a run in time comes to', () => {
  // Half notes C and D, then a whole-note E, at 60 BPM from 10 s.
  const staff: StaffVisual = { clef: 'treble', time: [4, 4], items: [{ notes: ['C4'], dur: 'h' }, { notes: ['D4'], dur: 'h' }, { bar: 'single' }, { notes: ['E4'], dur: 'w' }] }
  const rhythm = staffRhythm(staff, [C4, D4, E4])!
  const judge = () =>
    new RunJudge({ t0: 10, beat: 1, hands: 1, strict: true, targets: rhythm.notes.map((n) => ({ pc: n.midi % 12, midis: [n.midi], at: n.at })) })
  const report = (j: RunJudge) => {
    j.close(Infinity)
    return reportRun(j.summary(), j.results, j.results.map((_, k) => j.inTime(k)), rhythm, 1, ['C', 'D', 'E'])
  }

  it('passes notes on the beat, and a little off', () => {
    const j = judge()
    j.note(C4, 10.01)
    j.note(D4, 12.15) // 150 ms late: within the window
    j.note(E4, 14)
    // On average 55 ms behind the beat: worth a word even when it passes.
    expect(report(j)).toMatchObject({ passed: true, title: 'In time!', detail: '2 of 3 on the beat, 1 a little late.', tip: 'You drag by about 55 ms.' })
  })

  it('fails a note too far off the beat, and says why', () => {
    const j = judge()
    j.note(C4, 10)
    j.note(D4, 11.4) // more than half a beat early
    j.note(E4, 14)
    expect(report(j)).toMatchObject({ passed: false, title: 'Not quite in time', detail: '1 too early.', tip: 'Off the beat: D. Count out loud and play each note right on its count.' })
  })

  it('points out wrong and missed notes first', () => {
    const j = judge()
    j.note(C4, 10)
    j.note(E4, 12) // E instead of D
    const r = report(j)
    expect(r.detail).toBe('1 wrong note, 1 missed.')
    expect(r.tip).toMatch(/Show me/)
    expect(report(judge()).tip).toMatch(/No notes came through/)
  })

  it('notices long notes let go too soon, without failing the run', () => {
    const j = judge()
    j.note(C4, 10)
    j.release(C4, 10.5) // a quarter of its two beats
    j.note(D4, 12)
    j.release(D4, 13.9)
    j.note(E4, 14)
    const r = report(j)
    expect(r.passed).toBe(true)
    expect(r.short).toEqual([true, false, false])
    expect(r.detail).toBe('3 of 3 on the beat, 1 let go too soon.')
    expect(r.tip).toBe('Let go too soon: C. Keep each key down for its whole count.')
  })

  it('calls several notes off the same way a habit', () => {
    const j = new RunJudge({ t0: 0, beat: 1, hands: 1, strict: true, targets: [60, 62, 64, 65].map((m, k) => ({ pc: m % 12, midis: [m], at: k })) })
    j.note(60, 0)
    j.note(62, 1.3)
    j.note(64, 2.35)
    j.note(65, 3)
    j.close(Infinity)
    const r = reportRun(j.summary(), j.results, j.results.map((_, k) => j.inTime(k)), staffRhythm({ clef: 'treble', time: [4, 4], items: ['C4', 'D4', 'E4', 'F4'].map((n) => ({ notes: [n] })) }, [60, 62, 64, 65])!, 1, ['C', 'D', 'E', 'F'])
    expect(r).toMatchObject({ passed: false, detail: '2 too late.', tip: 'You’re dragging: be ready to play right on each beat.' })
  })
})
