// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { setPref } from '../../state/prefs'
import { useProgress } from '../../state/progress'
import { isFresh, loadResume, saveResume } from './resume'

const place = { step: 6, solved: [1, 2, 4], slips: { 2: 1 }, secs: 95, of: 9 }

describe('resuming a lesson', () => {
  beforeEach(() => setPref('learn:resume', {}))

  it('remembers your place per lesson and forgets it when asked', () => {
    saveResume('u1-l2', place)
    saveResume('u1-l3', { ...place, step: 2, of: 7 })
    expect(loadResume('u1-l2', 9)).toEqual(place)
    expect(loadResume('u1-l3', 7)?.step).toBe(2)
    saveResume('u1-l2', null)
    expect(loadResume('u1-l2', 9)).toBeNull()
    expect(loadResume('u1-l3', 7)?.step).toBe(2)
  })

  it('starts afresh when the lesson has changed since', () => {
    saveResume('u1-l2', place)
    expect(loadResume('u1-l2', 10)).toBeNull()
  })

  it('ignores saves it can’t use (old builds, a bad import)', () => {
    setPref('learn:resume', {
      a: { ...place, step: 9 },
      b: { ...place, solved: [12] },
      c: { ...place, slips: { 1: -1 } },
      d: { step: 3 },
      e: 'step 3',
    })
    for (const id of ['a', 'b', 'c', 'd', 'e', 'missing']) expect(loadResume(id, 9), id).toBeNull()
    setPref('learn:resume', ['not', 'a', 'map'])
    expect(loadResume('u1-l2', 9)).toBeNull()
  })

  it('forgets every place when your progress is reset', () => {
    useProgress.setState({ xp: 40, lessons: { 'u1-l1': { stars: 3, completedAt: 1 } } })
    saveResume('u1-l2', place)
    useProgress.getState().addXp(5)
    expect(loadResume('u1-l2', 9)).toEqual(place)
    useProgress.getState().resetAll()
    expect(loadResume('u1-l2', 9)).toBeNull()
  })

  it('has nothing to come back to on step 1 with nothing done', () => {
    expect(isFresh({ step: 0, solved: [], slips: {} })).toBe(true)
    expect(isFresh({ step: 0, solved: [], slips: { 0: 1 } })).toBe(false)
    expect(isFresh({ step: 1, solved: [], slips: {} })).toBe(false)
  })
})
