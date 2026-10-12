import { create } from 'zustand'
import type { Song } from '../content/songs'
import { idbAll, idbDelete, idbPut } from '../lib/idb'

/**
 * Songs you imported yourself. They're stored in this browser (IndexedDB) and never leave the device,
 * except inside a backup file you export yourself from Settings.
 */

export interface LibraryEntry {
  id: string
  song: Song
  /** The original file, so the song can be read again when the importer gets better. */
  source?: { name: string; bytes: ArrayBuffer; partIndex: number }
  /** Version of the importer that made `song`. */
  version: number
  addedAt: number
}

interface LibraryState {
  /** False until the saved songs have loaded. */
  ready: boolean
  /** Set when the browser won't let us store songs (e.g. private browsing). */
  error: string | null
  /** Newest first. */
  entries: LibraryEntry[]
}

export const useLibrary = create<LibraryState>()(() => ({ ready: false, error: null, entries: [] }))

const newestFirst = (es: LibraryEntry[]) => [...es].sort((a, b) => b.addedAt - a.addedAt)

export async function loadLibrary() {
  try {
    const entries = await idbAll<LibraryEntry>('songs')
    useLibrary.setState({ ready: true, entries: newestFirst(entries) })
    void refreshOld(entries)
  } catch {
    useLibrary.setState({ ready: true, error: 'This browser won’t let the app save imported songs (private browsing?).' })
  }
}

export async function saveEntry(entry: LibraryEntry) {
  await idbPut('songs', entry)
  useLibrary.setState((s) => ({ entries: newestFirst([entry, ...s.entries.filter((e) => e.id !== entry.id)]), error: null }))
}

export async function removeEntry(id: string) {
  await idbDelete('songs', id)
  useLibrary.setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
}

/**
 * Put a new reading of a song (a fixed file, another part) in place of the one with this id. The id and its
 * place in the list stay, so the song keeps its progress and remembered settings.
 */
export async function replaceEntry(id: string, next: Pick<LibraryEntry, 'song' | 'source' | 'version'>): Promise<LibraryEntry> {
  const old = useLibrary.getState().entries.find((e) => e.id === id)
  if (!old) throw new Error('That song is no longer on this device.')
  const entry: LibraryEntry = { ...old, song: { ...next.song, id }, source: next.source ?? old.source, version: next.version }
  await saveEntry(entry)
  return entry
}

/** Titles compared loosely: "Für Elise" and "fur elise!" are the same. */
const plain = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function sameBytes(a: ArrayBuffer, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  const x = new Uint8Array(a)
  for (let i = 0; i < x.length; i++) if (x[i] !== b[i]) return false
  return true
}

/**
 * A song already in the library that a file being imported probably is: the very same file again (same name
 * and contents), or a song with the same title and composer (a fixed or re-exported version).
 */
export function findDuplicate(
  entries: LibraryEntry[],
  file: { name: string; bytes: Uint8Array; title: string; composer: string },
): { entry: LibraryEntry; reason: 'file' | 'title' } | null {
  const same = entries.find((e) => e.source?.name === file.name && sameBytes(e.source.bytes, file.bytes))
  if (same) return { entry: same, reason: 'file' }
  const title = plain(file.title)
  // Notation apps call every score "Untitled score" until you name it: that says nothing.
  if (!title || title.startsWith('untitled')) return null
  const composer = plain(file.composer)
  const like = entries.find((e) => plain(e.song.title) === title && plain(e.song.composer) === composer)
  return like ? { entry: like, reason: 'title' } : null
}

let askedToPersist = false

/**
 * Ask the browser to keep imported songs even when the device runs low on space (best effort, once per visit).
 * Without it, a browser may clear them to free up space.
 */
export async function persistStorage() {
  if (askedToPersist) return
  askedToPersist = true
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (!storage?.persist || (await storage.persisted?.())) return
    await storage.persist()
  } catch {
    // Not supported or refused: songs still save.
  }
}

/** Re-read songs that an older importer made, keeping your title, composer and level. */
async function refreshOld(entries: LibraryEntry[]) {
  if (!entries.some((e) => e.source)) return
  const { IMPORTER_VERSION, importScoreFile } = await import('../lib/musicxml')
  for (const e of entries) {
    if (e.version >= IMPORTER_VERSION || !e.source) continue
    try {
      const r = await importScoreFile(new Uint8Array(e.source.bytes), e.source.name, { partIndex: e.source.partIndex })
      const { id, title, composer, difficulty, imported } = e.song
      await saveEntry({ ...e, version: IMPORTER_VERSION, song: { ...r.song, id, title, composer, difficulty, imported } })
    } catch {
      // Keep the version we have.
    }
  }
}

// ---- Backup files (Settings → Export / Import) ----

export interface LibraryBackupItem {
  id: string
  song: Song
  source?: { name: string; data: string; partIndex: number }
  version: number
  addedAt: number
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(data: string): ArrayBuffer {
  const s = atob(data)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

export function libraryBackup(): LibraryBackupItem[] {
  return useLibrary.getState().entries.map((e) => ({
    id: e.id,
    song: e.song,
    source: e.source && { name: e.source.name, data: toBase64(e.source.bytes), partIndex: e.source.partIndex },
    version: e.version,
    addedAt: e.addedAt,
  }))
}

/** Adds the songs from a backup (replacing ones with the same id). Returns how many were added. */
export async function restoreLibrary(items: unknown): Promise<number> {
  if (!Array.isArray(items)) return 0
  let n = 0
  for (const it of items as LibraryBackupItem[]) {
    if (!it?.id || !it.song?.rh) continue
    await saveEntry({
      id: it.id,
      song: it.song,
      source: it.source && { name: it.source.name, bytes: fromBase64(it.source.data), partIndex: it.source.partIndex },
      version: it.version ?? 0,
      addedAt: it.addedAt ?? Date.now(),
    })
    n++
  }
  return n
}
