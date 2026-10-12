import { beforeEach, describe, expect, it } from 'vitest'
import { findSong } from '../../content/songs'
import { getPref, usePrefs } from '../../state/prefs'
import { LAST_PRACTISED, continueBar, rememberBar, rememberedLoop, songPref } from './memory'

describe('what a song remembers', () => {
  beforeEach(() => usePrefs.setState({ values: {} }))

  it('restores a loop only while it still fits the song', () => {
    expect(rememberedLoop({ on: true, from: 4, to: 6 }, 16, [1, 4])).toEqual({ on: true, bars: [4, 6] })
    expect(rememberedLoop({ on: false, from: 4, to: 6 }, 16, [1, 4])).toEqual({ on: false, bars: [4, 6] })
    // Gone past the end (the song was read again shorter), back to front, or not a loop at all.
    for (const bad of [{ on: true, from: 10, to: 20 }, { on: true, from: 6, to: 4 }, { on: true, from: 1.5, to: 3 }, 'x', null, undefined]) {
      expect(rememberedLoop(bad, 16, [1, 4])).toEqual({ on: false, bars: [1, 4] })
    }
  })

  it('offers to continue from where you were, but not from the start', () => {
    expect(continueBar(12, 16, 0)).toBe(12)
    expect(continueBar(0, 16, 0)).toBe(null)
    // With a pickup, bar 1 is the start too.
    expect(continueBar(1, 16, 1)).toBe(null)
    expect(continueBar(16, 16, 0)).toBe(null)
    expect(continueBar('12', 16, 0)).toBe(null)
  })

  it('remembers the bar per song, and the song practised last (with the bar as shown)', () => {
    const song = findSong('amazing-grace')!
    rememberBar(song, 5)
    expect(getPref(songPref(song.id, 'bar'), 0)).toBe(5)
    // Amazing Grace starts with a pickup, so its 6th bar is bar 5.
    expect(getPref(LAST_PRACTISED, null)).toMatchObject({ id: 'amazing-grace', title: song.title, bar: 5 })
  })
})
