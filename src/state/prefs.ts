import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Choices each screen remembers between visits: levels, clefs, tempos, the chord or scale you last looked at.
 * One persisted store, so Settings → Export carries them to your other devices too.
 * Keys are short names per screen, e.g. "note-rush:clef" or "scale:tonic".
 */
interface Prefs {
  values: Record<string, unknown>
  setPref: (key: string, value: unknown) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      values: {},
      setPref: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
    }),
    { name: 'tonic-prefs', version: 1, partialize: (s) => ({ values: s.values }) },
  ),
)

/** Older builds kept a few choices as separate localStorage keys ("tonic-<key>"); read them once as a fallback. */
function legacy(key: string): unknown {
  try {
    const raw = localStorage.getItem(`tonic-${key}`)
    if (raw === null) return undefined
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  } catch {
    return undefined
  }
}

function valid<T>(v: unknown, fallback: T, allowed?: readonly T[]): v is T {
  if (v === undefined || v === null) return false
  if (allowed) return allowed.includes(v as T)
  if (typeof fallback === 'number') return typeof v === 'number' && Number.isFinite(v)
  return typeof v === typeof fallback
}

/** Read a remembered choice outside React (e.g. in a useState initialiser). */
export function getPref<T>(key: string, fallback: T, allowed?: readonly T[]): T {
  const values = usePrefs.getState().values
  const v = key in values ? values[key] : legacy(key)
  return valid(v, fallback, allowed) ? v : fallback
}

export function setPref(key: string, value: unknown) {
  usePrefs.getState().setPref(key, value)
}

/**
 * Like useState, but remembered between visits (and devices, via Export).
 * `allowed` limits it to known values, so a renamed level falls back to the default instead of breaking.
 */
export function usePref<T>(key: string, fallback: T, allowed?: readonly T[]): [T, (value: T) => void] {
  const stored = usePrefs((s) => s.values[key])
  const value = stored === undefined ? getPref(key, fallback, allowed) : valid(stored, fallback, allowed) ? stored : fallback
  return [value, (v: T) => setPref(key, v)]
}
