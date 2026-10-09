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
