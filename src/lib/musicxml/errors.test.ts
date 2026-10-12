// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { barline, measure, n, score, start } from './testkit'

// The importer always makes valid songs, so pretend its final check found problems.
vi.mock('./validate', async (original) => ({
  ...(await original<typeof import('./validate')>()),
  validateSong: () => ['Left hand, bar 2: too short'],
  songProblems: () => [{ bar: 1, line: 'Left hand', text: 'This bar lasts 3 beats; the right hand’s lasts 4.', fix: 'Look for a missing rest.' }],
}))

const { ImportError, describeProblems, importMusicXml } = await import('./index')

describe('a score the importer can’t use', () => {
  it('throws the problems with the score’s own bar numbers (repeats written out)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const xml = score([
      {
        measures: [
          measure(7, start(), barline('left', { repeat: 'forward' }), n('C4', 'whole')),
          measure(8, n('D4', 'whole'), barline('right', { repeat: 'backward' })),
        ],
      },
    ])
    let err: unknown
    try {
      importMusicXml(xml, 'x.musicxml')
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ImportError)
    const e = err as InstanceType<typeof ImportError>
    expect(e.message).toMatch(/confused the importer/)
    expect(e.kind).toBe('score')
    expect(e.barNames).toEqual(['7', '8', '7', '8'])
    expect(describeProblems(e.problems, e.barNames).groups).toEqual([
      { fix: 'Look for a missing rest.', items: [{ where: 'Bar 8 · Left hand', text: 'This bar lasts 3 beats; the right hand’s lasts 4.' }] },
    ])
  })
})
