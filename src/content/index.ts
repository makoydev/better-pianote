import type { Lesson, Unit } from './types'
import { unit1 } from './units/unit1'
import { unit2 } from './units/unit2'
import { unit3 } from './units/unit3'
import { unit4 } from './units/unit4'
import { unit5 } from './units/unit5'
import { unit6 } from './units/unit6'
import { unit7 } from './units/unit7'

export const UNITS: Unit[] = [unit1, unit2, unit3, unit4, unit5, unit6, unit7]

export const ALL_LESSONS: { lesson: Lesson; unit: Unit; index: number }[] = UNITS.flatMap((unit) =>
  unit.lessons.map((lesson, index) => ({ lesson, unit, index })),
)

export function findLesson(id: string) {
  const i = ALL_LESSONS.findIndex((x) => x.lesson.id === id)
  return i < 0 ? null : { ...ALL_LESSONS[i], next: ALL_LESSONS[i + 1]?.lesson ?? null, order: i }
}

/** The first lesson you haven't finished yet (or the last one if you've done them all). */
export function nextLesson(done: Record<string, unknown>) {
  return ALL_LESSONS.find((x) => !done[x.lesson.id]) ?? ALL_LESSONS[ALL_LESSONS.length - 1] ?? null
}
