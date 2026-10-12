import { ALL_LESSONS } from '../../content'
import type { Lesson, Step, Unit } from '../../content/types'
import type { LessonRecord } from '../../state/progress'

/** The quick review's route id: #/learn/review. */
export const REVIEW_ID = 'review'
/** Questions in a quick review (fewer when you've only finished a lesson or two). */
export const REVIEW_SIZE = 10
/** XP for finishing a quick review. */
export const REVIEW_XP = 5

export interface ReviewItem {
  lesson: Lesson
  unit: Unit
  /** Where the step sits in its lesson. */
  index: number
  step: Step
}

/**
 * A lesson step as it's asked in a quick review, or null if it isn't a question: quizzes and play steps, with
 * their stand-alone wording where the lesson's leans on the step before. Free-practice steps stay in the lesson.
 */
export function reviewStep(step: Step): Step | null {
  if (step.kind === 'quiz') return step.review ? { ...step, question: step.review } : step
  if (step.kind === 'play' && !step.free) return step.review ? { ...step, prompt: step.review, success: undefined } : step
  return null
}

/** How much a finished lesson could use a review: fewer stars and a longer time since count for more. */
export function reviewWeight(r: LessonRecord, now: number): number {
  const days = Math.max(0, (now - r.completedAt) / 864e5)
  const stars = Math.min(3, Math.max(1, r.stars))
  return (4 - stars) * (1 + Math.min(days, 28) / 7)
}

/**
 * A mixed review: up to REVIEW_SIZE questions from the lessons you've finished, picked at random but weighted
 * to low stars and the lessons you did longest ago, a few from each lesson at most.
 */
export function buildReview(records: Record<string, LessonRecord>, now = Date.now(), rng: () => number = Math.random): ReviewItem[] {
  const pool = ALL_LESSONS.filter((x) => records[x.lesson.id])
    .map((x) => ({
      ...x,
      weight: reviewWeight(records[x.lesson.id], now),
      left: x.lesson.steps.flatMap((s, index) => {
        const step = reviewStep(s)
        return step ? [{ index, step }] : []
      }),
      taken: 0,
    }))
    .filter((x) => x.left.length > 0)
  // Spread the questions over your lessons, unless there are only one or two to draw from.
  const cap = Math.max(3, Math.ceil(REVIEW_SIZE / Math.max(1, pool.length)))
  const out: ReviewItem[] = []
  while (out.length < REVIEW_SIZE) {
    const open = pool.filter((x) => x.left.length > 0 && x.taken < cap)
    if (open.length === 0) break
    let r = rng() * open.reduce((a, x) => a + x.weight, 0)
    const pick = open.find((x) => (r -= x.weight) < 0) ?? open[open.length - 1]
    const [q] = pick.left.splice(Math.floor(rng() * pick.left.length), 1)
    pick.taken++
    out.push({ lesson: pick.lesson, unit: pick.unit, index: q.index, step: q.step })
  }
  return out
}
