import { describe, expect, it } from 'vitest'
import { findLesson } from '../../content'
import type { Visual } from '../../content/types'
import { besideText, pictureSp } from './visual'

const kb = (from: string, to: string): Visual => ({ keyboard: { from, to } })
const visualOf = (lessonId: string, step: number) => {
  const s = findLesson(lessonId)!.lesson.steps[step - 1]
  return s.kind === 'explain' ? s.visual : undefined
}

describe('lesson pictures', () => {
  it('puts narrow keyboards and the grand staff beside the text on wide screens', () => {
    expect(besideText(kb('C4', 'C5'))).toBe(true)
    expect(besideText(kb('C3', 'B4'))).toBe(true)
    expect(besideText(kb('C3', 'C5'))).toBe(true)
    expect(besideText({ staff: { clef: 'grand', items: [] } })).toBe(true)
  })

  it('keeps wide keyboards, widgets and single staves under the text, at full width', () => {
    expect(besideText(kb('G2', 'C5'))).toBe(false)
    expect(besideText(kb('C3', 'C6'))).toBe(false)
    expect(besideText(kb('C2', 'C7'))).toBe(false)
    expect(besideText({ widget: { type: 'keyboard-map' } })).toBe(false)
    expect(besideText({ staff: { clef: 'treble', items: [] } })).toBe(false)
    expect(besideText(undefined)).toBe(false)
  })

  it('handles the pictures from the audit', () => {
    // "Your keyboard has a pattern" (the 61-key map) stays full width; "C lives just left of the two" moves beside.
    expect(besideText(visualOf('u1-l1', 1))).toBe(false)
    expect(besideText(visualOf('u1-l1', 4))).toBe(true)
  })

  it('draws staves smaller on short screens', () => {
    expect(pictureSp(757)).toBeLessThan(pictureSp(1180))
    expect(pictureSp(700)).toBeLessThan(pictureSp(820))
  })
})
