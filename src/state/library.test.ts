import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Song } from '../content/songs'

// In-memory stand-ins for IndexedDB and the importer.
const db = new Map<string, unknown>()
vi.mock('../lib/idb', () => ({
  idbAll: async () => [...db.values()],
  idbPut: async (_store: string, v: { id: string }) => void db.set(v.id, structuredClone(v)),
  idbDelete: async (_store: string, id: string) => void db.delete(id),
}))
const reimported = vi.fn()
vi.mock('../lib/musicxml', () => ({
  IMPORTER_VERSION: 2,
  importScoreFile: async (bytes: Uint8Array, name: string, opts: { partIndex?: number }) => {
    reimported(bytes, name, opts)
    return { song: { ...song('fresh'), title: 'Title from file', composer: 'Composer from file', difficulty: 1, bpm: 123 } }
  },
}))

const { libraryBackup, loadLibrary, removeEntry, restoreLibrary, saveEntry, useLibrary } = await import('./library')

function song(id: string): Song {
  return {
    id,
    title: 'My piece',
    composer: 'Me',
    year: '',
    difficulty: 3,
    keyName: 'C major',
    keySig: 0,
    time: [4, 4],
    bpm: 90,
    tags: [],
    about: '',
    rh: [[{ notes: ['C4'], dur: 'w', dots: 0, tie: false }]],
    imported: { fileName: 'piece.mxl', at: 1 },
  }
}

beforeEach(() => {
  db.clear()
  reimported.mockClear()
  useLibrary.setState({ ready: false, error: null, entries: [] })
})

describe('library of imported songs', () => {
  it('saves, lists newest first, and removes', async () => {
    await saveEntry({ id: 'a', song: song('a'), version: 2, addedAt: 1 })
    await saveEntry({ id: 'b', song: song('b'), version: 2, addedAt: 2 })
    expect(useLibrary.getState().entries.map((e) => e.id)).toEqual(['b', 'a'])
    await removeEntry('b')
    expect(useLibrary.getState().entries.map((e) => e.id)).toEqual(['a'])
    expect([...db.keys()]).toEqual(['a'])
  })

  it('round-trips through a backup file, original file included', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 7) % 256)
    await saveEntry({ id: 'a', song: song('a'), source: { name: 'piece.mxl', bytes: bytes.buffer, partIndex: 1 }, version: 2, addedAt: 5 })
    const file = JSON.parse(JSON.stringify({ library: libraryBackup() }))
    db.clear()
    useLibrary.setState({ entries: [] })
    expect(await restoreLibrary(file.library)).toBe(1)
    const back = useLibrary.getState().entries[0]
    expect(back.song).toEqual(song('a'))
    expect(back.source?.partIndex).toBe(1)
    expect(new Uint8Array(back.source!.bytes)).toEqual(bytes)
  })

  it('ignores junk in a backup file', async () => {
    expect(await restoreLibrary(undefined)).toBe(0)
    expect(await restoreLibrary([{ nope: true }, null])).toBe(0)
  })

  it('re-reads songs from an older importer, keeping your title, composer and level', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    db.set('old', { id: 'old', song: song('old'), source: { name: 'piece.mxl', bytes: bytes.buffer, partIndex: 2 }, version: 1, addedAt: 1 })
    db.set('new', { id: 'new', song: song('new'), source: { name: 'x.mxl', bytes: bytes.buffer, partIndex: 0 }, version: 2, addedAt: 2 })
    await loadLibrary()
    await vi.waitFor(() => expect(useLibrary.getState().entries.find((e) => e.id === 'old')?.version).toBe(2))
    expect(reimported).toHaveBeenCalledTimes(1)
    expect(reimported.mock.calls[0][2]).toEqual({ partIndex: 2 })
    const old = useLibrary.getState().entries.find((e) => e.id === 'old')!.song
    expect([old.id, old.title, old.composer, old.difficulty, old.bpm]).toEqual(['old', 'My piece', 'Me', 3, 123])
  })
})
