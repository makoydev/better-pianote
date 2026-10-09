import { describe, expect, it } from 'vitest'
import { isBar } from '../components/staff/layout'
import { midiOf, mod, parseChord, parseKey, parseNote, romanToChord } from '../lib/theory'
import { ALL_LESSONS, UNITS } from './index'
import type { KeyboardVisual, StaffVisual, Step, Visual } from './types'

const m = (n: string) => midiOf(parseNote(n))

function checkKeyboard(k: KeyboardVisual) {
  expect(m(k.from), `keyboard ${k.from}-${k.to}`).toBeLessThan(m(k.to))
  for (const n of Object.keys(k.marks ?? {})) parseNote(n)
  for (const n of Object.keys(k.fingers ?? {})) parseNote(n)
}

function checkStaff(s: StaffVisual) {
  for (const it of s.items) {
    if (isBar(it)) continue
    for (const n of it.notes ?? []) if (typeof n === 'string') parseNote(n)
    else if ('note' in n && typeof n.note === 'string') parseNote(n.note)
    if (it.chord) parseChord(it.chord)
  }
}

function checkVisual(v: Visual) {
  if (v.keyboard) checkKeyboard(v.keyboard)
  if (v.staff) checkStaff(v.staff)
  for (const clip of v.audio ?? []) for (const n of clip.notes.flat()) parseNote(n)
  if (v.widget?.type === 'progression') {
    const key = parseKey(v.widget.key)
    for (const r of v.widget.romans) romanToChord(r, key)
  }
}

function checkStep(step: Step, where: string) {
  if ((step.kind === 'explain' || step.kind === 'quiz') && step.visual) checkVisual(step.visual)
  if (step.kind === 'quiz') {
    expect(step.answer, `${where}: answer index`).toBeGreaterThanOrEqual(0)
    expect(step.answer, `${where}: answer index`).toBeLessThan(step.options.length)
    expect(new Set(step.options).size, `${where}: duplicate options`).toBe(step.options.length)
    for (const n of step.listen?.notes.flat() ?? []) parseNote(n)
  }
  if (step.kind === 'widget') checkVisual({ widget: step.widget })
  if (step.kind === 'play') {
    const t = step.target
    const targets = t.notes.map(m)
    if (step.staff) checkStaff(step.staff)
    if (t.type === 'chord') {
      // Exact-octave chords may double a note (C3 + C4); otherwise they need two different note names.
      const distinct = t.anyOctave ? new Set(targets.map((x) => mod(x, 12))).size : new Set(targets).size
      expect(distinct, `${where}: chord needs 2+ notes`).toBeGreaterThan(1)
    }
    if (step.keyboard) {
      checkKeyboard(step.keyboard)
      const lo = m(step.keyboard.from)
      const hi = m(step.keyboard.to)
      for (const x of targets) {
        if (t.anyOctave) {
          // Some key with this name must be on screen.
          let found = false
          for (let k = lo; k <= hi; k++) if (mod(k, 12) === mod(x, 12)) found = true
          expect(found, `${where}: ${x} not reachable`).toBe(true)
        } else {
          expect(x >= lo && x <= hi, `${where}: target ${x} outside ${step.keyboard.from}-${step.keyboard.to}`).toBe(true)
        }
      }
    }
    if (t.type === 'sequence' && step.staff) {
      const events = step.staff.items.filter((i) => !isBar(i))
      if (events.length === t.notes.length) {
        // When the staff shows the melody note-for-note, it must match the target.
        events.forEach((e, i) => {
          const n = !isBar(e) && e.notes?.[0]
          if (typeof n === 'string') expect(m(n), `${where}: staff note ${i}`).toBe(targets[i])
        })
      }
    }
  }
}

describe('lesson content', () => {
  it('has unique lesson ids that match their unit', () => {
    const ids = ALL_LESSONS.map((x) => x.lesson.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const u of UNITS) for (const l of u.lessons) expect(l.id.startsWith(`${u.id}-`), l.id).toBe(true)
  })

  for (const { lesson, unit } of ALL_LESSONS) {
    it(`${unit.id} · ${lesson.title}`, () => {
      expect(lesson.steps.length).toBeGreaterThan(2)
      lesson.steps.forEach((s, i) => checkStep(s, `${lesson.id} step ${i + 1}`))
    })
  }
})
