import { describe, expect, it } from 'vitest'
import { normalize, searchLessons } from './search'

const ids = (q: string) => searchLessons(q).map((h) => h.lesson.id)

describe('lesson search', () => {
  it('finds nothing for an empty query', () => {
    expect(searchLessons('')).toEqual([])
    expect(searchLessons('   ')).toEqual([])
  })

  it('matches titles, ignoring case, and puts title matches first', () => {
    const hits = searchLessons('inversions')
    expect(hits[0].lesson.title).toBe('Inversions')
    expect(hits[0].unitNo).toBe(5)
    expect(hits[0].step).toBeUndefined()
  })

  it('matches the start of words, so a few letters are enough', () => {
    expect(ids('pentat')).toContain('u4-l6')
    expect(ids('ver')).not.toContain(searchLessons('inversions')[0].lesson.id)
  })

  it('needs every word, and says which step matched', () => {
    const hits = searchLessons('keyboard pattern')
    expect(hits[0].lesson.id).toBe('u1-l1')
    expect(hits[0].step).toBe('Your keyboard has a pattern')
    expect(ids('keyboard pattern zebra')).toEqual([])
    // Explained by the subtitle ("…and where C lives"): no step needed.
    expect(searchLessons('lives')[0].step).toBeUndefined()
  })

  it('reads sharps, flats and curly quotes either way', () => {
    expect(normalize('F♯ and B♭')).toBe('f# and bb')
    expect(normalize('Don’t jump')).toBe("don't jump")
    expect(ids("don't jump")).toContain('u6-l5')
  })

  it('numbers lessons within their unit', () => {
    const hit = searchLessons('treble clef').find((h) => h.lesson.id === 'u2-l2')
    expect(hit && [hit.unitNo, hit.lessonNo]).toEqual([2, 2])
  })
})
