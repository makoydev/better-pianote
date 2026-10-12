import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Song } from '../../content/songs'

const reads: string[] = []
/** The part each read asked for (undefined: the importer's choice). */
const partsRead: (number | undefined)[] = []
vi.mock('../../lib/musicxml', async (original) => {
  const real = await original<typeof import('../../lib/musicxml')>()
  return {
    ...real,
    importScoreFile: async (_bytes: Uint8Array, name: string, opts: { partIndex?: number }) => {
      reads.push(name)
      partsRead.push(opts.partIndex)
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

const { batchOf, chooseTarget, closeImport, editImport, nextImport, replaceImport, startImport, startImports, startReplace, useImport } = await import(
  './importSession'
)
const { useLibrary } = await import('../../state/library')

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
  partsRead.length = 0
  useLibrary.setState({ entries: [] })
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

describe('a file that is already in My songs', () => {
  const mine = () => ({
    id: 'my-piece-1',
    song: { ...song('x'), id: 'my-piece-1', title: 'My title', difficulty: 3 as const },
    source: { name: 'a.mxl', bytes: new TextEncoder().encode('<score-partwise/>').buffer, partIndex: 0 },
    version: 1,
    addedAt: 1,
  })

  it('offers to replace that song (the default), keeping its title and level, or to add it as new', async () => {
    useLibrary.setState({ entries: [mine()] })
    startImports([file('a.mxl')])
    await settled()
    const s = useImport.getState()
    expect(s.duplicate).toEqual({ id: 'my-piece-1', title: 'My title', reason: 'file' })
    expect(s.target).toBe('my-piece-1')
    expect(s.edits).toEqual({ title: 'My title', composer: 'Me', difficulty: 3 })
    chooseTarget(null)
    expect(useImport.getState().target).toBeNull()
  })

  it('a song that only shares the title and composer is added as new unless you choose to replace it', async () => {
    useLibrary.setState({ entries: [{ ...mine(), song: { ...mine().song, title: 'b', composer: 'Me' } }] })
    startImports([file('b.mxl')])
    await settled()
    let s = useImport.getState()
    expect(s.duplicate).toEqual({ id: 'my-piece-1', title: 'b', reason: 'title' })
    expect(s.target).toBeNull()
    expect(s.edits).toEqual({ title: 'b', composer: 'Me', difficulty: 1 })
    // Fields you haven't touched follow the choice: the replaced song keeps its level.
    chooseTarget('my-piece-1')
    s = useImport.getState()
    expect(s.target).toBe('my-piece-1')
    expect(s.edits?.difficulty).toBe(3)
    chooseTarget(null)
    expect(useImport.getState().edits?.difficulty).toBe(1)
  })

  it('reads the same file again, or a new file for a song, with the part you chose before', async () => {
    useLibrary.setState({ entries: [{ ...mine(), source: { ...mine().source, partIndex: 2 } }] })
    startImports([file('a.mxl')])
    await settled()
    expect(partsRead).toEqual([undefined, 2])
    expect(phase().kind === 'ready' && phase()).toMatchObject({ result: { partIndex: 2 } })
    closeImport()
    partsRead.length = 0
    startReplace(file('fixed.mxl'), 'my-piece-1')
    await settled()
    expect(partsRead).toEqual([2])
  })

  it('a new file is just added', async () => {
    useLibrary.setState({ entries: [mine()] })
    startImports([file('other.mxl')])
    await settled()
    expect(useImport.getState().duplicate).toBeNull()
    expect(useImport.getState().target).toBeNull()
    expect(useImport.getState().edits?.title).toBe('other')
  })

  it('"Replace file" on a song saves the new file in its place', async () => {
    useLibrary.setState({ entries: [mine()] })
    startReplace(file('fixed.mxl'), 'my-piece-1')
    await settled()
    const s = useImport.getState()
    expect([s.replacing, s.target, s.duplicate]).toEqual(['my-piece-1', 'my-piece-1', null])
    expect(s.edits?.title).toBe('My title')
  })

  it('files dropped while replacing a song are imported as songs of their own', async () => {
    useLibrary.setState({ entries: [mine()] })
    startReplace(file('fixed.mxl'), 'my-piece-1')
    await settled()
    startImports([file('new.mxl')])
    nextImport()
    await settled()
    const s = useImport.getState()
    expect(openFile()).toBe('new.mxl')
    expect([s.replacing, s.target, s.duplicate]).toEqual([null, null, null])
    expect(s.edits?.title).toBe('new')
  })

  it('reading another part of the same file keeps every choice', async () => {
    useLibrary.setState({ entries: [mine()] })
    startImports([file('a.mxl')])
    await settled()
    editImport({ title: 'Renamed' })
    chooseTarget(null)
    const p = phase()
    if (p.kind !== 'ready') throw new Error('expected a song')
    void startImport(p.file, { partIndex: 1, bytes: p.bytes })
    await vi.waitFor(() => expect(phase().kind === 'ready' && phase()).toMatchObject({ result: { partIndex: 1 } }))
    expect(useImport.getState().edits?.title).toBe('Renamed')
    expect(useImport.getState().target).toBeNull()
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
