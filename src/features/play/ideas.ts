import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * "Save that!": Free Play keeps the last couple of minutes of what you play in memory, so a good idea can be saved
 * after the fact, without having pressed record. Saved ideas keep every key and the pedal, and play back through
 * the app or the keyboard (pure parts here, the screens in IdeasSheet and FreePlay).
 */

/** How far back Save that! reaches. */
export const KEEP_MS = 120_000
/**
 * Room for ideas in the browser's storage (characters of saved text, about 1.5 MB of its 5): past it, Save that! asks
 * you to delete some first, so the rest of the app always has room to save your progress. Nothing goes on its own.
 */
export const IDEAS_ROOM = 1_500_000

/** The sustain pedal, in place of a key. */
export const PEDAL = 128

/** One thing that happened: [ms, key, value]. A key down has its velocity (1–127), up is 0; the pedal is 1 or 0. */
export type Take = [ms: number, key: number, value: number]

/** A saved idea. `events` start at 0 (the first note) and every key down has its key up. */
export interface Idea {
  /** When it was saved (ms since 1970), unique. */
  id: number
  name: string
  /** How long it is, ms. */
  ms: number
  events: Take[]
  /** The key it seemed to be in (a key id, "A" or "F#m"), and the chords it went through, when known. */
  key?: string
  chords?: string[]
}

/** The last couple of minutes of playing (performance.now() times), fed by Free Play while it's open. */
export class Recorder {
  private events: Take[] = []
  /** Up to when the last take was saved: the next one starts after it, so an idea is never saved twice. */
  private savedTo = -Infinity

  add(time: number, key: number, value: number) {
    this.events.push([time, key, value])
    // A minute more than the reach, so the pedal and keys at the start of a take are known.
    const old = time - KEEP_MS - 60_000
    if (this.events[0][0] < old) this.events = this.events.filter((e) => e[0] >= old)
  }

  /** Where a take can start: KEEP_MS ago, or where the last saved one ended if that's later. */
  private start(now: number) {
    return Math.max(now - KEEP_MS, this.savedTo)
  }

  /** Was anything played since the last save, in the last KEEP_MS? */
  has(now: number) {
    const start = this.start(now)
    return this.events.some((e) => e[0] >= start && e[1] !== PEDAL && e[2] > 0)
  }

  /**
   * What was played in the last KEEP_MS (since the last save, if that's later): from the first key down, with the
   * pedal as it was then, to the last thing that happened (or now, while a key or the pedal is still down, letting
   * them go there), and when it began (`from`, a performance.now() time). Null when nothing was.
   */
  take(now: number): { from: number; ms: number; events: Take[] } | null {
    const start = this.start(now)
    const from = this.events.find((e) => e[0] >= start && e[1] !== PEDAL && e[2] > 0)?.[0]
    if (from === undefined) return null
    let pedal = false
    for (const [t, key, v] of this.events) if (t < from && key === PEDAL) pedal = v > 0
    const out: Take[] = pedal ? [[0, PEDAL, 1]] : []
    const down = new Set<number>()
    let end = 0
    for (const [t, key, v] of this.events) {
      if (t < from) continue
      const at = Math.round(t - from)
      if (key === PEDAL) {
        if (v > 0 === pedal) continue
        pedal = v > 0
      } else if (v > 0) down.add(key)
      // A key let go that went down before the take began isn't part of it.
      else if (!down.delete(key)) continue
      out.push([at, key, v])
      end = at
    }
    if (down.size || pedal) end = Math.max(end, Math.round(now - from))
    for (const key of down) out.push([end, key, 0])
    if (pedal) out.push([end, PEDAL, 0])
    return { from, ms: end, events: out }
  }

  /** The take up to `now` was saved: the next one starts after it. */
  saved(now: number) {
    this.savedTo = now
  }

  clear() {
    this.events = []
    this.savedTo = -Infinity
  }
}

/** Free Play's recorder: one for the whole visit to the app, so leaving Free Play for a moment doesn't lose it. */
export const recorder = new Recorder()

/** A note as it sounds: when (ms), how long (ms, the pedal holding it on), which key, how hard (0–1). */
export interface Sound {
  at: number
  dur: number
  midi: number
  vel: number
}

/**
 * How an idea sounds: each key from its press until it's let go, or with the pedal down until the pedal comes up
 * (or the same key is struck again).
 */
export function soundsOf(events: Take[], ms: number): Sound[] {
  const out: Sound[] = []
  const open = new Map<number, { s: Sound; held: boolean }>()
  let pedal = false
  const end = (midi: number, at: number) => {
    const o = open.get(midi)
    if (!o) return
    o.s.dur = Math.max(1, at - o.s.at)
    open.delete(midi)
  }
  for (const [at, key, v] of events) {
    if (key === PEDAL) {
      pedal = v > 0
      if (!pedal) for (const [midi, o] of [...open]) if (!o.held) end(midi, at)
    } else if (v > 0) {
      end(key, at)
      const s: Sound = { at, dur: 0, midi: key, vel: v / 127 }
      out.push(s)
      open.set(key, { s, held: true })
    } else {
      const o = open.get(key)
      if (!o) continue
      if (pedal) o.held = false
      else end(key, at)
    }
  }
  for (const midi of [...open.keys()]) end(midi, ms)
  return out
}

/** m:ss for a length in ms. */
export function lengthText(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A variable-length number, as MIDI files write times. */
function vlq(n: number): number[] {
  const out = [n & 0x7f]
  for (let v = n >> 7; v > 0; v >>= 7) out.unshift((v & 0x7f) | 0x80)
  return out
}

/** Ticks per quarter note at 120 BPM: 480 make 500 ms, so a millisecond is 0.96 of a tick. */
const PPQ = 480

/** The idea as a standard MIDI file (format 0, piano, 120 BPM), to open in GarageBand, MuseScore or a DAW. */
export function ideaToMidi(idea: Idea): Uint8Array {
  const track: number[] = [
    // Tempo: 500,000 µs per quarter note (120 BPM).
    0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
    // Acoustic grand piano on channel 1.
    0x00, 0xc0, 0x00,
  ]
  let last = 0
  for (const [ms, key, v] of idea.events) {
    const tick = Math.round((ms * PPQ) / 500)
    track.push(...vlq(Math.max(0, tick - last)))
    last = Math.max(last, tick)
    if (key === PEDAL) track.push(0xb0, 64, v > 0 ? 127 : 0)
    else if (v > 0) track.push(0x90, key, Math.min(127, Math.max(1, v)))
    else track.push(0x80, key, 0)
  }
  track.push(0x00, 0xff, 0x2f, 0x00)
  const len = track.length
  return new Uint8Array([
    ...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 0xff],
    ...[0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff],
    ...track,
  ])
}

/** An idea from a backup or old storage, checked (dropping anything that doesn't read). */
export function readIdea(v: unknown): Idea | null {
  if (!v || typeof v !== 'object') return null
  const x = v as Partial<Idea>
  if (typeof x.id !== 'number' || typeof x.name !== 'string' || typeof x.ms !== 'number' || !Array.isArray(x.events)) return null
  const events = x.events.filter(
    (e): e is Take => Array.isArray(e) && e.length === 3 && e.every((n) => typeof n === 'number' && Number.isFinite(n)) && e[1] >= 0 && e[1] <= PEDAL,
  )
  const idea: Idea = { id: x.id, name: x.name, ms: x.ms, events }
  if (typeof x.key === 'string') idea.key = x.key
  if (Array.isArray(x.chords)) idea.chords = x.chords.filter((c): c is string => typeof c === 'string')
  return idea
}

/** Two lists of ideas as one: every idea once (the first list's copy when both have it), newest first. */
export function mergeIdeas(a: Idea[], b: Idea[]): Idea[] {
  const byId = new Map<number, Idea>()
  for (const i of [...b, ...a]) byId.set(i.id, i)
  return [...byId.values()].sort((x, y) => y.id - x.id)
}

interface IdeasState {
  /** Newest first. */
  ideas: Idea[]
  /** Keep a new idea; false when there's no room for it (see IDEAS_ROOM). */
  add: (idea: Idea) => boolean
  rename: (id: number, name: string) => void
  remove: (id: number) => void
  /** Put back an idea just deleted. */
  restore: (idea: Idea) => void
}

export const useIdeas = create<IdeasState>()(
  persist(
    (set, get) => ({
      ideas: [],
      add: (idea) => {
        const ideas = [idea, ...get().ideas]
        if (JSON.stringify(ideas).length > IDEAS_ROOM) return false
        set({ ideas })
        return true
      },
      rename: (id, name) => set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, name } : i)) })),
      remove: (id) => set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) })),
      restore: (idea) => set((s) => ({ ideas: mergeIdeas(s.ideas, [idea]) })),
    }),
    {
      name: 'tonic-ideas',
      version: 1,
      partialize: (s) => ({ ideas: s.ideas }),
      merge: (persisted, current) => {
        const list = (persisted as { ideas?: unknown } | undefined)?.ideas
        return { ...current, ideas: Array.isArray(list) ? list.flatMap((v) => readIdea(v) ?? []) : [] }
      },
    },
  ),
)
