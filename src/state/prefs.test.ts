import { describe, expect, it } from 'vitest'
import { getPref, setPref, usePrefs } from './prefs'

describe('prefs', () => {
  it('falls back until something is stored', () => {
    expect(getPref('test:level', 'l1', ['l1', 'l2'] as const)).toBe('l1')
    setPref('test:level', 'l2')
    expect(getPref('test:level', 'l1', ['l1', 'l2'] as const)).toBe('l2')
  })

  it('ignores values that are no longer allowed (e.g. a renamed level)', () => {
    setPref('test:mode', 'gone')
    expect(getPref('test:mode', 'name', ['name', 'find'] as const)).toBe('name')
  })

  it('checks the type against the fallback', () => {
    setPref('test:bpm', '90')
    expect(getPref('test:bpm', 80)).toBe(80)
    setPref('test:bpm', 96)
    expect(getPref('test:bpm', 80)).toBe(96)
    setPref('test:bpm', Number.NaN)
    expect(getPref('test:bpm', 80)).toBe(80)
  })

  it('keeps every value in one store (so Export carries them)', () => {
    setPref('test:a', true)
    expect(usePrefs.getState().values['test:a']).toBe(true)
  })
})
