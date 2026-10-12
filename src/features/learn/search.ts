import { ALL_LESSONS, UNITS } from '../../content'
import type { Lesson, Unit } from '../../content/types'
import { plainText } from './stepText'

export interface LessonHit {
  lesson: Lesson
  unit: Unit
  /** 1-based, for "Unit 2 · Lesson 3". */
  unitNo: number
  lessonNo: number
  /** The step title that matched, when the lesson's own title and subtitle don't say it all. */
  step?: string
}

/** For matching: lower case, ♯ ♭ as # b, straight quotes, no accents. So "f#" finds "F♯". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
}

/** Every lesson's searchable text: title, subtitle, the titles of its steps, and its unit. */
const INDEX = ALL_LESSONS.map(({ lesson, unit, index }) => {
  const steps = lesson.steps.flatMap((s) => (s.kind === 'explain' || s.kind === 'widget' ? [s.title] : s.kind === 'play' && s.title ? [s.title] : [])).map(plainText)
  return {
    hit: { lesson, unit, unitNo: UNITS.indexOf(unit) + 1, lessonNo: index + 1 },
    title: normalize(lesson.title),
    subtitle: normalize(lesson.subtitle),
    steps: steps.map((text) => ({ text, norm: normalize(text) })),
    unit: normalize(unit.title),
  }
})

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Lessons that match every word of the query (each word at the start of a word, so "inver" finds
 * "Inversions" but "ver" doesn't). Title matches first, then subtitles, then step titles; course order breaks ties.
 */
export function searchLessons(query: string): LessonHit[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const tests = words.map((w) => new RegExp(`(^|[^a-z0-9#])${escape(w)}`))
  const found: { hit: LessonHit; score: number; order: number }[] = []
  INDEX.forEach((x, order) => {
    let score = 0
    for (const t of tests) {
      const s = t.test(x.title) ? 8 : t.test(x.subtitle) ? 4 : x.steps.some((st) => t.test(st.norm)) ? 2 : t.test(x.unit) ? 1 : 0
      if (s === 0) return
      score += s
    }
    // Say which step matched when the title and subtitle alone don't explain the hit.
    const explained = tests.every((t) => t.test(x.title) || t.test(x.subtitle))
    const step = explained ? undefined : [...x.steps].sort((a, b) => count(tests, b.norm) - count(tests, a.norm)).find((st) => count(tests, st.norm) > 0)?.text
    found.push({ hit: step ? { ...x.hit, step } : x.hit, score, order })
  })
  return found.sort((a, b) => b.score - a.score || a.order - b.order).map((f) => f.hit)
}

const count = (tests: RegExp[], s: string) => tests.filter((t) => t.test(s)).length
