import { create } from 'zustand'
import type { Song } from '../../content/songs'
import type { ImportResult, ProblemGroup } from '../../lib/musicxml'
import { findDuplicate, useLibrary } from '../../state/library'

/** The file being imported right now (the Import sheet shows this), and the files picked with it. */

export type ImportPhase =
  | { kind: 'closed' }
  | { kind: 'reading'; file: File }
  | {
      kind: 'error'
      file: File
      message: string
      /** The file was MusicXML that failed for another reason, so "Which files work?" won't help. */
      musicXml: boolean
      /** The first problems, by bar, when the importer made a song it couldn't use. */
      details: { groups: ProblemGroup[]; more: number } | null
    }
  | { kind: 'ready'; file: File; bytes: Uint8Array; result: ImportResult; version: number }

export interface ImportEdits {
  title: string
  composer: string
  difficulty: Song['difficulty']
}

/** A song already in My songs that looks like the file being imported. */
export interface Duplicate {
  id: string
  title: string
  /** The very same file again, or a song with the same title and composer. */
  reason: 'file' | 'title'
}

interface ImportState {
  phase: ImportPhase
  edits: ImportEdits | null
  /** Files picked or dropped together take turns: these are still waiting. */
  queue: File[]
  /** Files of this batch already saved or skipped. */
  done: number
  /** The song this file will replace (same id, so its progress stays), or null to add it as a new song. */
  target: string | null
  duplicate: Duplicate | null
  /** Set by "Replace file" on a song: this import is a new file for that song. */
  replacing: string | null
}

const CLOSED = { phase: { kind: 'closed' }, edits: null, queue: [], done: 0, target: null, duplicate: null, replacing: null } satisfies ImportState

export const useImport = create<ImportState>()(() => CLOSED)

const detailsOf = ({ title, composer, difficulty }: Song): ImportEdits => ({ title, composer, difficulty })

/** "File 2 of 3" when several files are being imported, else null. */
export function batchOf(s: Pick<ImportState, 'queue' | 'done'>): { at: number; of: number } | null {
  const of = s.done + 1 + s.queue.length
  return of > 1 ? { at: s.done + 1, of } : null
}

let ticket = 0
const MAX_BYTES = 30 * 1024 * 1024

/** Import files one after another. While one is open, more files wait their turn after it. */
export function startImports(files: File[]) {
  if (!files.length) return
  const s = useImport.getState()
  if (s.phase.kind !== 'closed') {
    useImport.setState({ queue: [...s.queue, ...files] })
    return
  }
  useImport.setState({ queue: files.slice(1), done: 0 })
  void startImport(files[0])
}

/** "Pick a different file": the first of these replaces the open one, and any others go next. */
export function replaceImport(files: File[]) {
  if (!files.length) return
  useImport.setState((s) => ({ queue: [...files.slice(1), ...s.queue] }))
  void startImport(files[0])
}

/** On to the next file waiting (closes the sheet after the last one). */
export function nextImport() {
  const { queue, done } = useImport.getState()
  if (!queue.length) return closeImport()
  // Only the file picked with "Replace file" replaces that song; files waiting after it are songs of their own.
  useImport.setState({ queue: queue.slice(1), done: done + 1, replacing: null, target: null, duplicate: null })
  void startImport(queue[0])
}

/** "Replace file" on a song in My songs: read this file, to be saved in that song's place. */
export function startReplace(file: File, id: string) {
  closeImport()
  useImport.setState({ replacing: id, target: id })
  void startImport(file)
}

/** For a file that's already in My songs: replace that song (pass its id) or add the file as a new one (null). */
export function chooseTarget(target: string | null) {
  useImport.setState({ target })
}

/** Read a file (or the same file again with another part of the score). */
export async function startImport(file: File, opts: { partIndex?: number; bytes?: Uint8Array } = {}) {
  const mine = ++ticket
  if (file.size > MAX_BYTES) {
    useImport.setState({
      phase: { kind: 'error', file, message: 'That file is too big to be a MusicXML score (over 30 MB).', musicXml: false, details: null },
      edits: null,
    })
    return
  }
  useImport.setState((s) => ({ phase: { kind: 'reading', file }, edits: opts.partIndex === undefined ? null : s.edits }))
  let mod: typeof import('../../lib/musicxml') | null = null
  try {
    mod = await import('../../lib/musicxml')
    const bytes = opts.bytes ?? new Uint8Array(await file.arrayBuffer())
    const result = await mod.importScoreFile(bytes, file.name, { partIndex: opts.partIndex })
    if (mine !== ticket) return
    const phase: ImportPhase = { kind: 'ready', file, bytes, result, version: mod.IMPORTER_VERSION }
    // The same file read with another part keeps every choice made so far.
    if (opts.partIndex !== undefined) return useImport.setState({ phase })
    const { entries } = useLibrary.getState()
    const replacing = entries.find((e) => e.id === useImport.getState().replacing)
    const dup = replacing ? null : findDuplicate(entries, { name: file.name, bytes, title: result.song.title, composer: result.song.composer })
    // Replacing a song keeps the title, composer and level you gave it.
    const existing = replacing ?? dup?.entry
    useImport.setState({
      phase,
      edits: detailsOf(existing?.song ?? result.song),
      target: existing?.id ?? null,
      duplicate: dup && { id: dup.entry.id, title: dup.entry.song.title, reason: dup.reason },
    })
  } catch (e) {
    if (mine !== ticket) return
    const known = mod && e instanceof mod.ImportError ? e : null
    const details = known?.problems.length ? mod!.describeProblems(known.problems, known.barNames) : null
    useImport.setState({
      phase: {
        kind: 'error',
        file,
        message: known?.message ?? 'Something went wrong while reading this file.',
        musicXml: known?.kind === 'score',
        details,
      },
      edits: null,
    })
  }
}

export function editImport(patch: Partial<ImportEdits>) {
  useImport.setState((s) => (s.edits ? { edits: { ...s.edits, ...patch } } : {}))
}

/** Close the sheet, dropping any files still waiting. */
export function closeImport() {
  ticket++
  useImport.setState(CLOSED)
}
