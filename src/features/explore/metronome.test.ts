// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Load the metronome page fresh (it moves an older build's save into prefs when it loads). */
async function openMetronome() {
  vi.resetModules()
  const prefs = await import('../../state/prefs')
  await import('./Metronome')
  return prefs
}

describe('metronome choices', () => {
  beforeEach(() => localStorage.clear())

  it('moves the old "tonic-metronome" save into prefs, once', async () => {
    localStorage.setItem('tonic-metronome', JSON.stringify({ bpm: 132, meter: '6/8' }))
    const { getPref } = await openMetronome()
    expect(getPref('metronome:bpm', 90)).toBe(132)
    expect(getPref('metronome:meter', '4/4')).toBe('6/8')
    expect(localStorage.getItem('tonic-metronome')).toBeNull()
  })

  it('keeps what prefs already hold (e.g. imported from another device)', async () => {
    localStorage.setItem('tonic-prefs', JSON.stringify({ state: { values: { 'metronome:bpm': 70 } }, version: 1 }))
    localStorage.setItem('tonic-metronome', JSON.stringify({ bpm: 132, meter: '6/8' }))
    const { getPref } = await openMetronome()
    expect(getPref('metronome:bpm', 90)).toBe(70)
    expect(getPref('metronome:meter', '4/4')).toBe('6/8')
  })

  it('ignores an old save it can’t read', async () => {
    localStorage.setItem('tonic-metronome', JSON.stringify({ bpm: 'fast', meter: '7/8' }))
    const { getPref } = await openMetronome()
    expect(getPref('metronome:bpm', 90)).toBe(90)
    expect(getPref('metronome:meter', '4/4')).toBe('4/4')
  })
})
