import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Song } from '../../content/songs'

const reads: string[] = []
vi.mock('../../lib/musicxml', async (original) => {
  const real = await original<typeof import('../../lib/musicxml')>()
  return {
    ...real,
    importScoreFile: async (_bytes: Uint8Array, name: string, opts: { partIndex?: number }) => {
      reads.push(name)
      if (name.startsWith('confusing')) {
        throw new real.ImportError('Something in this score confused the importer.', {
          kind: 'score',
          problems: [{ bar: 2, line: 'Left hand', text: 'This bar lasts 3 beats; the right hand’s lasts 4.', fix: 'Look for a missing rest.' }],
          barNames: ['1', '2', '3'],
        })
      }
      if (name.endsWith('.pdf')) throw new real.ImportError('That’s a PDF.')
      return { song: song(name), parts: [], partIndex: opts.partIndex ?? 0, warnings: [], stats: { bars: 1, rhNotes: 1, lhNotes: 0, voices: 1 } }
    },
  }
})

const { batchOf, closeImport, nextImport, replaceImport, startImports, useImport } = await import('./importSession')

function song(name: string): Song {
  return {
    id: `my-${name}`,
    title: name.replace(/\..*$/, ''),
    composer: 'Me',
    year: '',
    difficulty: 1,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 90,
    tags: [],
    about: '',
    rh: [[{ notes: ['C4'], dur: 'w', dots: 0, tie: false }]],
  }
}

const file = (name: string) => new File(['<score-partwise/>'], name)
const phase = () => useImport.getState().phase
const openFile = () => {
  const p = phase()
  return p.kind === 'closed' ? null : p.file.name
}
const settled = () => vi.waitFor(() => expect(['ready', 'error']).toContain(phase().kind))

beforeEach(() => {
  closeImport()
  reads.length = 0
})

describe('importing several files', () => {
  it('takes them one after another, and closes after the last', async () => {
    startImports([file('a.mxl'), file('b.mxl'), file('c.mxl')])
    await settled()
    expect(openFile()).toBe('a.mxl')
    expect(batchOf(useImport.getState())).toEqual({ at: 1, of: 3 })
    nextImport()
    await settled()
    expect(openFile()).toBe('b.mxl')
    expect(batchOf(useImport.getState())).toEqual({ at: 2, of: 3 })
    nextImport()
    await settled()
    expect(batchOf(useImport.getState())).toEqual({ at: 3, of: 3 })
    nextImport()
    expect(phase().kind).toBe('closed')
    expect(reads).toEqual(['a.mxl', 'b.mxl', 'c.mxl'])
  })

  it('a single file is not a batch', async () => {
    startImports([file('a.mxl')])
    await settled()
    expect(batchOf(useImport.getState())).toBeNull()
  })

  it('files dropped while one is open wait their turn', async () => {
    startImports([file('a.mxl')])
    await settled()
    startImports([file('b.mxl')])
    expect(openFile()).toBe('a.mxl')
    expect(batchOf(useImport.getState())).toEqual({ at: 1, of: 2 })
  })

  it('"pick a different file" swaps the open one and keeps the rest waiting', async () => {
    startImports([file('a.mxl'), file('b.mxl')])
    await settled()
    replaceImport([file('c.mxl')])
    await settled()
    expect(openFile()).toBe('c.mxl')
    expect(useImport.getState().queue.map((f) => f.name)).toEqual(['b.mxl'])
  })

  it('closing drops the files still waiting', async () => {
    startImports([file('a.mxl'), file('b.mxl')])
    await settled()
    closeImport()
    expect(useImport.getState().queue).toEqual([])
    expect(batchOf(useImport.getState())).toBeNull()
  })
})

describe('import errors', () => {
  it('a MusicXML file the importer couldn’t use gets details by bar, and no "which files work" help', async () => {
    startImports([file('confusing.musicxml')])
    await settled()
    const p = phase()
    if (p.kind !== 'error') throw new Error('expected an error')
    expect(p.musicXml).toBe(true)
    expect(p.details?.groups).toEqual([
      { fix: 'Look for a missing rest.', items: [{ where: 'Bar 3 · Left hand', text: 'This bar lasts 3 beats; the right hand’s lasts 4.' }] },
    ])
  })

  it('another kind of file gets the help instead', async () => {
    startImports([file('scan.pdf')])
    await settled()
    const p = phase()
    if (p.kind !== 'error') throw new Error('expected an error')
    expect(p.message).toMatch(/PDF/)
    expect(p.musicXml).toBe(false)
    expect(p.details).toBeNull()
  })
})
