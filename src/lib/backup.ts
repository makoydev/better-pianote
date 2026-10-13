import { libraryBackup, restoreLibrary } from '../state/library'
import { getPref, setPref, usePrefs } from '../state/prefs'
import { type GameRecord, type LessonRecord, dayKeyOf, useProgress } from '../state/progress'
import { useSettings } from '../state/settings'

/**
 * Moving progress between devices (the Mac and the iPad): a JSON file with settings, progress, remembered choices,
 * imported songs, and any other saved data (practice stats, song history…). Importing shows what's in the file and
 * offers Merge (the best of both) or Replace, and can be undone until the app is closed.
 */

/** Settings that belong to the device, not to you: an import never changes them. */
const DEVICE_SETTINGS = ['uiScale', 'midiAuto', 'micAuto', 'midiThru', 'demoToKeyboard', 'computerKeys', 'keepAwake', 'headphones'] as const
/** Saved data with its own handling below; every other "tonic-…" key travels as-is. */
const OWN_KEYS = ['tonic-settings', 'tonic-progress', 'tonic-prefs']

/**
 * Saved lists that a merge combines item by item (by id) instead of keeping this device's copy: the store's key and
 * the list in it. Free Play's ideas from the Mac and the iPad both stay.
 */
const MERGED_LISTS: Record<string, string> = { 'tonic-ideas': 'ideas' }

/** Both devices' copies of a saved list as one (this device's item when both have it), newest first; null if unreadable. */
export function mergeSavedList(mine: string, theirs: string, field: string): string | null {
  try {
    const a = JSON.parse(mine) as { state?: Record<string, unknown> }
    const b = JSON.parse(theirs) as { state?: Record<string, unknown> }
    const la = a.state?.[field]
    const lb = b.state?.[field]
    if (!Array.isArray(la) || !Array.isArray(lb)) return null
    const byId = new Map<number, { id: number }>()
    for (const x of [...lb, ...la]) if (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'number') byId.set((x as { id: number }).id, x as { id: number })
    return JSON.stringify({ ...a, state: { ...a.state, [field]: [...byId.values()].sort((x, y) => y.id - x.id) } })
  } catch {
    return null
  }
}

export type ProgressData = Omit<ReturnType<typeof useProgress.getState>, 'addXp' | 'completeLesson' | 'recordGame' | 'findChord' | 'setGoal' | 'resetAll'>

export interface Backup {
  app: 'tonic'
  version: number
  exportedAt?: string
  settings?: Record<string, unknown>
  progress: ProgressData
  prefs?: Record<string, unknown>
  library?: unknown[]
  /** Other saved stores, as their raw localStorage text. */
  extras?: Record<string, string>
}

function savedKeys(): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith('tonic-'))
  } catch {
    return []
  }
}

function dataOnly<T extends object>(state: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'))
}

export function collectBackup(): Backup {
  const extras: Record<string, string> = {}
  for (const k of savedKeys()) {
    if (OWN_KEYS.includes(k)) continue
    const v = localStorage.getItem(k)
    if (v !== null) extras[k] = v
  }
  return {
    app: 'tonic',
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: dataOnly(useSettings.getState()),
    progress: dataOnly(useProgress.getState()) as ProgressData,
    prefs: usePrefs.getState().values,
    library: libraryBackup(),
    extras,
  }
}

/** Save a backup file. On an iPad the share sheet lets you Save to Files or AirDrop it to the Mac. */
export async function exportBackup(): Promise<void> {
  const name = `tonic-progress-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([JSON.stringify(collectBackup())], name, { type: 'application/json' })
  const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Tonic progress' })
      setPref('backup:last', Date.now())
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      // Sharing failed: fall back to a download.
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  // Safari needs the link a moment longer before it's released.
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  setPref('backup:last', Date.now())
}

/** Read and check a backup file (throws a message you can show). */
export async function readBackup(f: File): Promise<Backup> {
  let data: Backup
  try {
    data = JSON.parse(await f.text())
  } catch {
    throw new Error('That file isn’t a Tonic progress file.')
  }
  if (data?.app !== 'tonic' || !data.progress || typeof data.progress !== 'object') throw new Error('That file isn’t a Tonic progress file.')
  return data
}

export interface Summary {
  xp: number
  lessons: number
  stars: number
  songs: number
  lastDay: string | null
}

export function summarize(progress: Partial<ProgressData>, songs: number): Summary {
  const lessons = Object.values(progress.lessons ?? {}) as LessonRecord[]
  return {
    xp: progress.xp ?? 0,
    lessons: lessons.length,
    stars: lessons.reduce((a, l) => a + (l.stars ?? 0), 0),
    songs,
    lastDay: progress.lastDay ?? null,
  }
}

const prevDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return dayKeyOf(new Date(y, m - 1, d - 1).getTime())
}

/** Consecutive practice days ending on `last`. */
export function streakOf(days: string[], last: string | null): number {
  if (!last) return 0
  const set = new Set(days)
  let n = 0
  for (let d = last; set.has(d); d = prevDay(d)) n++
  return n
}

/**
 * Both devices' progress together: every lesson at its best stars, every game at its best score, all practice
 * days (and the streak they make), all discovered chords. XP takes the higher total rather than adding, since
 * the two may already share history from an earlier import.
 */
export function mergeProgress(local: ProgressData, other: ProgressData): ProgressData {
  const lessons: Record<string, LessonRecord> = { ...other.lessons }
  for (const [id, l] of Object.entries(local.lessons ?? {})) {
    const o = lessons[id]
    lessons[id] = o ? { stars: Math.max(l.stars, o.stars), completedAt: Math.max(l.completedAt, o.completedAt) } : l
  }
  const games: Record<string, GameRecord> = { ...other.games }
  for (const [id, g] of Object.entries(local.games ?? {})) {
    const o = games[id]
    if (!o) {
      games[id] = g
      continue
    }
    const recent = g.lastPlayed >= o.lastPlayed ? g : o
    games[id] = { best: Math.max(g.best, o.best), plays: Math.max(g.plays, o.plays), last: recent.last, lastPlayed: recent.lastPlayed }
  }
  const days = [...new Set([...(local.days ?? []), ...(other.days ?? [])])].sort().slice(-120)
  const lastDay = [local.lastDay, other.lastDay].filter((d): d is string => !!d).sort().pop() ?? null
  const streak = streakOf(days, lastDay)
  const sameDay = local.dayKey === other.dayKey
  const today = sameDay ? local : local.dayKey > other.dayKey ? local : other
  return {
    ...local,
    xp: Math.max(local.xp ?? 0, other.xp ?? 0),
    lessons,
    games,
    days,
    lastDay,
    streak,
    bestStreak: Math.max(local.bestStreak ?? 0, other.bestStreak ?? 0, streak),
    dayKey: today.dayKey,
    dayXp: sameDay ? Math.max(local.dayXp, other.dayXp) : today.dayXp,
    chordsFound: [...new Set([...(local.chordsFound ?? []), ...(other.chordsFound ?? [])])],
  }
}

const UNDO_KEY = 'tonic-undo-import'
const MESSAGE_KEY = 'tonic-import-message'

/** Bring a backup in. Saves an undo point, then reloads so every part of the app picks the data up. */
export async function applyBackup(b: Backup, mode: 'merge' | 'replace'): Promise<void> {
  // Undo point: everything saved right now (kept for this session only).
  const before: Record<string, string> = {}
  for (const k of savedKeys()) before[k] = localStorage.getItem(k) ?? ''
  try {
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(before))
  } catch {
    /* no undo in private browsing */
  }

  const local = dataOnly(useProgress.getState()) as ProgressData
  const progress = mode === 'merge' ? mergeProgress(local, b.progress) : { ...local, ...b.progress }
  useProgress.setState(progress)

  if (b.settings) {
    const s = useSettings.getState()
    const keep = Object.fromEntries(DEVICE_SETTINGS.map((k) => [k, s[k]]))
    // Importing means you've used Tonic before: no welcome tour.
    if (mode === 'replace') useSettings.setState({ ...b.settings, ...keep, onboarded: true })
    else if (!s.name && typeof b.settings.name === 'string') useSettings.setState({ name: b.settings.name })
  }
  if (b.prefs && typeof b.prefs === 'object') {
    const mine = usePrefs.getState().values
    usePrefs.setState({ values: mode === 'merge' ? { ...b.prefs, ...mine } : b.prefs })
  }
  for (const [k, v] of Object.entries(b.extras ?? {})) {
    if (!k.startsWith('tonic-') || OWN_KEYS.includes(k) || typeof v !== 'string') continue
    const mine = localStorage.getItem(k)
    if (mode === 'merge' && mine !== null) {
      const merged = MERGED_LISTS[k] ? mergeSavedList(mine, v, MERGED_LISTS[k]) : null
      if (merged !== null) localStorage.setItem(k, merged)
      continue
    }
    localStorage.setItem(k, v)
  }

  let songs = 0
  let songsFailed = false
  try {
    songs = await restoreLibrary(b.library)
  } catch {
    songsFailed = true
  }
  const message = songsFailed
    ? 'Progress imported, but this browser wouldn’t store the songs (private browsing?).'
    : songs
      ? `Progress and ${songs} song${songs === 1 ? '' : 's'} imported.`
      : 'Progress imported.'
  try {
    sessionStorage.setItem(MESSAGE_KEY, message)
  } catch {
    /* fine */
  }
  window.location.reload()
}

export function canUndoImport(): boolean {
  try {
    return sessionStorage.getItem(UNDO_KEY) !== null
  } catch {
    return false
  }
}

/** Put everything back as it was before the last import (songs it added stay in the library). */
export function undoImport() {
  const raw = sessionStorage.getItem(UNDO_KEY)
  if (!raw) return
  const before = JSON.parse(raw) as Record<string, string>
  for (const k of savedKeys()) if (!(k in before)) localStorage.removeItem(k)
  for (const [k, v] of Object.entries(before)) localStorage.setItem(k, v)
  sessionStorage.removeItem(UNDO_KEY)
  sessionStorage.setItem(MESSAGE_KEY, 'Import undone.')
  window.location.reload()
}

/** The message from an import that just reloaded the app, once. */
export function takeImportMessage(): string | null {
  try {
    const m = sessionStorage.getItem(MESSAGE_KEY)
    sessionStorage.removeItem(MESSAGE_KEY)
    return m
  } catch {
    return null
  }
}

/** When you last saved a backup (ms), or null. */
export function lastBackupAt(): number | null {
  const t = getPref('backup:last', 0)
  return t > 0 ? t : null
}
