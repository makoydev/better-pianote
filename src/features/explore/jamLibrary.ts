import { CHORD_LENGTHS, type ChordLength, FEEL_IDS, MAX_CHORDS, type PatternId, clampJamBpm, isProgression, sameRomans } from './jam'

/** "My progressions" in the Jam: progressions you saved with their key and settings, kept in "jam:saved" (pure). */

export interface SavedProgression {
  id: string
  name: string
  romans: string[]
  /** The key's pitch class (spelled for the progression's mode when shown). */
  tonic: number
  bpm: number
  feel: PatternId
  length: ChordLength
}

export const MAX_SAVED = 60
export const NAME_LENGTH = 40

/**
 * Saved progressions read back from prefs (which another device's export may have filled): anything without a
 * name or with a numeral this build can't read is dropped, and settings out of range fall back to the defaults.
 */
export function readSaved(v: unknown): SavedProgression[] {
  if (!Array.isArray(v)) return []
  const out: SavedProgression[] = []
  for (const item of v) {
    if (out.length >= MAX_SAVED) break
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, NAME_LENGTH) : ''
    if (!name || !isProgression(r.romans) || r.romans.length === 0 || r.romans.length > MAX_CHORDS) continue
    const id = typeof r.id === 'string' && r.id && !out.some((p) => p.id === r.id) ? r.id : freeId(out)
    const tonic = typeof r.tonic === 'number' && Number.isInteger(r.tonic) && r.tonic >= 0 && r.tonic < 12 ? r.tonic : 0
    const bpm = typeof r.bpm === 'number' && Number.isFinite(r.bpm) ? clampJamBpm(r.bpm) : 76
    const feel = FEEL_IDS.find((f) => f === r.feel) ?? 'ballad'
    const length = CHORD_LENGTHS.find((l) => l === r.length) ?? 8
    out.push({ id, name, romans: [...r.romans], tonic, bpm, feel, length })
  }
  return out
}

function freeId(list: SavedProgression[]): string {
  let n = list.length + 1
  while (list.some((p) => p.id === `p${n}`)) n++
  return `p${n}`
}

/** A new id for a progression saved now. */
export const newSavedId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The saved progression with this name (any case), if any. */
export const findByName = (list: SavedProgression[], name: string) => list.find((p) => sameName(p.name, name))

/** The saved progression with these chords, if any: then they're not lost if Yours gets replaced. */
export const findByRomans = (list: SavedProgression[], romans: string[]) => (romans.length ? list.find((p) => sameRomans(p.romans, romans)) : undefined)

/** Keep a progression at the top of the list. A name you've used before (any case) replaces that one. */
export function saveTo(list: SavedProgression[], entry: Omit<SavedProgression, 'id'>, id: string): SavedProgression[] {
  const old = findByName(list, entry.name)
  const kept = { ...entry, name: entry.name.trim().slice(0, NAME_LENGTH), romans: [...entry.romans], id: old?.id ?? id }
  return [kept, ...list.filter((p) => p !== old)].slice(0, MAX_SAVED)
}

export const removeFrom = (list: SavedProgression[], id: string) => list.filter((p) => p.id !== id)

/** A name nobody's used yet: "My progression", then "My progression 2" … */
export function freeName(list: SavedProgression[]): string {
  if (!findByName(list, 'My progression')) return 'My progression'
  let n = 2
  while (findByName(list, `My progression ${n}`)) n++
  return `My progression ${n}`
}
