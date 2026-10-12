import { getPref, setPref, usePrefs } from '../../state/prefs'

/**
 * Where you are in an unfinished lesson, so leaving it (or an iPad reload) doesn't send you back to step 1.
 * One entry per lesson in the prefs store, so Export carries it to your other devices too.
 */
export interface Resume {
  /** The step you were on (0-based). */
  step: number
  /** Steps you've answered. */
  solved: number[]
  /** Slips per step so far, for the stars. */
  slips: Record<number, number>
  /** Seconds spent so far. */
  secs: number
  /** How many steps the lesson had: if that has changed since, the saved place no longer fits. */
  of: number
}

const KEY = 'learn:resume'

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

/** A saved place that still fits a lesson of `of` steps (old or imported data may not). */
function fits(r: unknown, of: number): r is Resume {
  if (!r || typeof r !== 'object') return false
  const x = r as Partial<Resume>
  if (x.of !== of || !isCount(x.step) || x.step >= of || typeof x.secs !== 'number') return false
  if (!Array.isArray(x.solved) || !x.solved.every((k) => isCount(k) && k < of)) return false
  return !!x.slips && typeof x.slips === 'object' && Object.entries(x.slips).every(([k, n]) => isCount(Number(k)) && isCount(n))
}

function saved(): Record<string, unknown> {
  const all = getPref<Record<string, unknown>>(KEY, {})
  return Array.isArray(all) ? {} : all
}

/** The saved place in a lesson with `of` steps, if there is one. */
export function loadResume(lessonId: string, of: number): Resume | null {
  const r = saved()[lessonId]
  return fits(r, of) ? r : null
}

/** Remember your place (or forget it, with null). */
export function saveResume(lessonId: string, r: Resume | null) {
  const all = saved()
  if (!r && !(lessonId in all)) return
  const next = { ...all }
  if (r) next[lessonId] = r
  else delete next[lessonId]
  setPref(KEY, next)
}

/** Nothing worth coming back to yet: still on step 1 with nothing answered or slipped. */
export const isFresh = (r: Pick<Resume, 'step' | 'solved' | 'slips'>) => r.step === 0 && r.solved.length === 0 && Object.keys(r.slips).length === 0

/** For the Learn path: the step you're on in an unfinished lesson of `of` steps (0-based), or null. */
export function useResumeStep(lessonId: string, of: number): number | null {
  return usePrefs((s) => {
    const all = s.values[KEY]
    const r = all && typeof all === 'object' ? (all as Record<string, unknown>)[lessonId] : undefined
    return fits(r, of) ? r.step : null
  })
}
