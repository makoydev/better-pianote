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

const { findDuplicate, libraryBackup, loadLibrary, persistStorage, removeEntry, replaceEntry, restoreLibrary, saveEntry, useLibrary } = await import('./library')

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

  it('replaces a song in place: same id, place and date added, new notes and file', async () => {
    await saveEntry({ id: 'a', song: song('a'), source: { name: 'old.mxl', bytes: new Uint8Array([1]).buffer, partIndex: 0 }, version: 1, addedAt: 1 })
    await saveEntry({ id: 'b', song: song('b'), version: 1, addedAt: 2 })
    const fixed = { ...song('my-new-id'), title: 'Fixed', bpm: 70 }
    const saved = await replaceEntry('a', { song: fixed, source: { name: 'new.mxl', bytes: new Uint8Array([2, 3]).buffer, partIndex: 1 }, version: 2 })
    expect(saved.id).toBe('a')
    expect(saved.song.id).toBe('a')
    expect(saved.addedAt).toBe(1)
    const back = useLibrary.getState().entries
    expect(back.map((e) => e.id)).toEqual(['b', 'a'])
    expect([back[1].song.title, back[1].song.bpm, back[1].source?.name, back[1].version]).toEqual(['Fixed', 70, 'new.mxl', 2])
    await expect(replaceEntry('gone', { song: fixed, version: 2 })).rejects.toThrow()
  })

  it('spots a file that is already in the library', () => {
    const bytes = new Uint8Array([60, 115, 99, 111, 114, 101])
    const entry = (id: string, title: string, composer: string, name: string, b = bytes) => ({
      id,
      song: { ...song(id), title, composer },
      source: { name, bytes: b.slice().buffer, partIndex: 0 },
      version: 1,
      addedAt: 1,
    })
    const entries = [entry('a', 'Für Elise', 'Ludwig van Beethoven', 'elise.mxl'), entry('b', 'Untitled score', 'Composer', 'x.mxl')]
    const file = (name: string, title: string, composer: string, b = bytes) => ({ name, bytes: b, title, composer })
    // The same file again (even with another title inside).
    expect(findDuplicate(entries, file('elise.mxl', 'Something else', 'Someone', bytes))).toMatchObject({ entry: { id: 'a' }, reason: 'file' })
    // Same name, different contents, and nothing else alike: a different file.
    expect(findDuplicate(entries, file('elise.mxl', 'Other', 'Someone', new Uint8Array([1, 2])))).toBeNull()
    // A fixed version: same title and composer, written a little differently.
    expect(findDuplicate(entries, file('elise-v2.musicxml', 'Fur Elise!', 'ludwig van beethoven', new Uint8Array([9])))).toMatchObject({
      entry: { id: 'a' },
      reason: 'title',
    })
    // Every unnamed score is "Untitled score": that's no match.
    expect(findDuplicate(entries, file('y.mxl', 'Untitled score', 'Composer', new Uint8Array([7])))).toBeNull()
  })

  it('asks the browser once to keep the songs', async () => {
    const persist = vi.fn(async () => true)
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } })
    await persistStorage()
    await persistStorage()
    expect(persist).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
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
