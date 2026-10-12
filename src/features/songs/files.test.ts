import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCORE_TYPES, isAppleTouch, mimeFor, scoreAccept } from './files'

const device = (userAgent: string, maxTouchPoints = 0) => vi.stubGlobal('navigator', { userAgent, maxTouchPoints })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the score file picker', () => {
  it('lists only score files on computers', () => {
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36')
    expect(isAppleTouch()).toBe(false)
    expect(scoreAccept()).toBe(SCORE_TYPES)
    device('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36')
    expect(scoreAccept()).toBe(SCORE_TYPES)
  })

  it('shows every file on iPhone and iPad, including an iPad that says it is a Mac', () => {
    device('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 5)
    expect(scoreAccept()).toBeUndefined()
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 5)
    expect(isAppleTouch()).toBe(true)
    expect(scoreAccept()).toBeUndefined()
  })

  it('saves originals with their MusicXML type', () => {
    expect(mimeFor('Song.MXL')).toBe('application/vnd.recordare.musicxml')
    expect(mimeFor('song.musicxml')).toBe('application/vnd.recordare.musicxml+xml')
    expect(mimeFor('song.xml')).toBe('application/xml')
    expect(mimeFor('song')).toBe('application/octet-stream')
  })
})
