import { create } from 'zustand'
import type { Song } from '../../content/songs'
import type { ImportResult } from '../../lib/musicxml'

/** The file being imported right now (the Import sheet shows this). */

export type ImportPhase =
  | { kind: 'closed' }
  | { kind: 'reading'; file: File }
  | { kind: 'error'; file: File; message: string }
  | { kind: 'ready'; file: File; bytes: Uint8Array; result: ImportResult; version: number }

export interface ImportEdits {
  title: string
  composer: string
  difficulty: Song['difficulty']
}

export const useImport = create<{ phase: ImportPhase; edits: ImportEdits | null }>()(() => ({ phase: { kind: 'closed' }, edits: null }))

let ticket = 0
const MAX_BYTES = 30 * 1024 * 1024

/** Read a file (or the same file again with another part of the score). */
export async function startImport(file: File, partIndex?: number, known?: Uint8Array) {
  const mine = ++ticket
  if (file.size > MAX_BYTES) {
    useImport.setState({ phase: { kind: 'error', file, message: 'That file is too big to be a MusicXML score (over 30 MB).' }, edits: null })
    return
  }
  useImport.setState((s) => ({ phase: { kind: 'reading', file }, edits: partIndex === undefined ? null : s.edits }))
  let mod: typeof import('../../lib/musicxml') | null = null
  try {
    mod = await import('../../lib/musicxml')
    const bytes = known ?? new Uint8Array(await file.arrayBuffer())
    const result = await mod.importScoreFile(bytes, file.name, { partIndex })
    if (mine !== ticket) return
    const { title, composer, difficulty } = result.song
    useImport.setState((s) => ({
      phase: { kind: 'ready', file, bytes, result, version: mod!.IMPORTER_VERSION },
      edits: s.edits ?? { title, composer, difficulty },
    }))
  } catch (e) {
    if (mine !== ticket) return
    const message = mod && e instanceof mod.ImportError ? e.message : 'Something went wrong while reading this file.'
    useImport.setState({ phase: { kind: 'error', file, message } })
  }
}

export function editImport(patch: Partial<ImportEdits>) {
  useImport.setState((s) => (s.edits ? { edits: { ...s.edits, ...patch } } : {}))
}

export function closeImport() {
  ticket++
  useImport.setState({ phase: { kind: 'closed' }, edits: null })
}
