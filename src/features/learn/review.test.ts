import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../../content'
import type { LessonRecord } from '../../state/progress'
import { REVIEW_SIZE, buildReview, reviewStep, reviewWeight } from './review'

const DAY = 864e5
const NOW = Date.UTC(2026, 9, 12)

/** A repeatable random sequence. */
function seeded(seed = 0.42) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

const steps = ALL_LESSONS.flatMap(({ lesson }) => lesson.steps.map((step) => ({ lesson, step })))

describe('quick review', () => {
  it('asks quizzes and play steps, not explanations or free practice', () => {
    for (const { step } of steps) {
      const r = reviewStep(step)
      if (step.kind === 'explain' || step.kind === 'widget' || (step.kind === 'play' && step.free)) expect(r).toBeNull()
      else expect(r?.kind).toBe(step.kind)
    }
  })

  it('words steps that lean on the one before so they stand alone', () => {
    for (const { lesson, step } of steps) {
      const text = step.kind === 'quiz' ? step.question : step.kind === 'play' ? step.prompt : ''
      // "And this one?", "This starts on C too", "Now down: …", "Bar 2 starts…" make no sense on their own.
      if (/^(And |Now (down|on|[A-G]\b|\d)|Come back|Together,|Bar \d)|starts on [A-G] too/.test(text)) {
        expect(step.kind === 'quiz' || step.kind === 'play' ? step.review : 'n/a', `${lesson.id}: ${text}`).toBeTruthy()
      }
      const r = reviewStep(step)
      if (step.kind === 'quiz' && step.review && r?.kind === 'quiz') expect(r.question).toBe(step.review)
      if (step.kind === 'play' && step.review && r?.kind === 'play') {
        expect(r.prompt).toBe(step.review)
        expect(r.success).toBeUndefined()
      }
    }
  })

  it('needs a finished lesson', () => {
    expect(buildReview({}, NOW)).toEqual([])
  })

  it('picks up to ten different steps, only from finished lessons', () => {
    const records: Record<string, LessonRecord> = {}
    for (const { lesson } of ALL_LESSONS.slice(0, 6)) records[lesson.id] = { stars: 2, completedAt: NOW - 3 * DAY }
    const items = buildReview(records, NOW, seeded())
    expect(items).toHaveLength(REVIEW_SIZE)
    expect(new Set(items.map((x) => `${x.lesson.id}#${x.index}`)).size).toBe(items.length)
    for (const x of items) {
      expect(records[x.lesson.id]).toBeDefined()
      expect(x.step.kind === 'quiz' || x.step.kind === 'play').toBe(true)
    }
  })

  it('uses every question of a single finished lesson', () => {
    const first = ALL_LESSONS[0].lesson
    const items = buildReview({ [first.id]: { stars: 3, completedAt: NOW } }, NOW, seeded())
    const questions = first.steps.filter((s) => reviewStep(s)).length
    expect(items).toHaveLength(Math.min(REVIEW_SIZE, questions))
  })

  it('leans towards lessons with fewer stars and the ones done longest ago', () => {
    expect(reviewWeight({ stars: 1, completedAt: NOW }, NOW)).toBeGreaterThan(reviewWeight({ stars: 3, completedAt: NOW }, NOW))
    expect(reviewWeight({ stars: 2, completedAt: NOW - 20 * DAY }, NOW)).toBeGreaterThan(reviewWeight({ stars: 2, completedAt: NOW - DAY }, NOW))

    const [weak, strong, old, fresh] = ALL_LESSONS.slice(10, 14).map((x) => x.lesson.id)
    const records: Record<string, LessonRecord> = {
      [weak]: { stars: 1, completedAt: NOW - DAY },
      [strong]: { stars: 3, completedAt: NOW - DAY },
      [old]: { stars: 2, completedAt: NOW - 25 * DAY },
      [fresh]: { stars: 2, completedAt: NOW },
    }
    const count: Record<string, number> = {}
    const rng = seeded(0.17)
    for (let k = 0; k < 200; k++) for (const x of buildReview(records, NOW, rng)) count[x.lesson.id] = (count[x.lesson.id] ?? 0) + 1
    expect(count[weak]).toBeGreaterThan(count[strong])
    expect(count[old]).toBeGreaterThan(count[fresh])
  })
})
