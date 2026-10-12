import {
  CHORD_TYPE,
  CHORD_TYPES,
  type Chord,
  type ChordType,
  type Key,
  type Note,
  type PlayedNote,
  chordQuality,
  chordSymbol,
  chordToRoman,
  keyName,
  noteName,
  parseChord,
  parseNote,
  pcOf,
  spellRoot,
} from '../../lib/theory'

/** Free Play's chord chart and collection (pure, testable). */

/** One chord on the "You played" chart, as it's saved in prefs: note names ("F#") and a chord type id. */
export interface ChartEntry {
  id: number
  root: string
  type: string
  bass?: string
}

/** The chart keeps this many chords. */
export const CHART_MAX = 48

const ascii = (n: Note) => noteName(n, { octave: false, ascii: true })

export function toEntry(chord: Chord, id: number): ChartEntry {
  const e: ChartEntry = { id, root: ascii(chord.root), type: chord.type.id }
  if (chord.bass && pcOf(chord.bass) !== pcOf(chord.root)) e.bass = ascii(chord.bass)
  return e
}

export function fromEntry(e: ChartEntry): Chord {
  return { root: parseNote(e.root), type: CHORD_TYPE[e.type], bass: e.bass ? parseNote(e.bass) : undefined }
}

/** The saved chart, keeping only entries that still read as chords. */
export function readChart(v: unknown): ChartEntry[] {
  if (!Array.isArray(v)) return []
  const ok = (e: unknown): e is ChartEntry => {
    if (!e || typeof e !== 'object') return false
    const { id, root, type, bass } = e as Record<string, unknown>
    if (typeof id !== 'number' || typeof root !== 'string' || typeof type !== 'string' || !(type in CHORD_TYPE)) return false
    if (bass !== undefined && typeof bass !== 'string') return false
    try {
      parseNote(root)
      if (typeof bass === 'string') parseNote(bass)
      return true
    } catch {
      return false
    }
  }
  return v.filter(ok).slice(-CHART_MAX)
}

const same = (a: Chord, b: Chord) => chordSymbol(a) === chordSymbol(b)

/** Add a chord to the end of the chart, unless it's the chord already there. Keeps the newest CHART_MAX. */
export function addToChart(chart: ChartEntry[], chord: Chord): ChartEntry[] {
  const last = chart[chart.length - 1]
  if (last && same(fromEntry(last), chord)) return chart
  const id = chart.reduce((m, e) => Math.max(m, e.id), 0) + 1
  return [...chart, toEntry(chord, id)].slice(-CHART_MAX)
}

/**
 * The progression a chart loops round (F♯m D A E F♯m D A E F♯m → F♯m D A E): the shortest pattern, up to 8 chords,
 * that the whole chart repeats, at least two chords into its second time round. Otherwise its last `max` chords.
 */
export function chartLoop(chords: Chord[], max = 16): Chord[] {
  for (let p = 1; p <= 8 && p + 2 <= chords.length; p++) {
    if (chords.every((c, i) => i < p || same(c, chords[i - p]))) return chords.slice(0, p)
  }
  return chords.slice(-max)
}

/** The chart as text to paste somewhere: "F♯m D A E · vi IV I V in A major". */
export function chartText(chords: Chord[], key: Key | null): string {
  const names = chords.map(chordSymbol).join(' ')
  return key ? `${names} · ${chords.map((c) => chordToRoman(c, key)).join(' ')} in ${keyName(key)}` : names
}

/** A chord's sound, whatever its spelling: B♭ and A♯ are the same sound. */
export const soundOf = (c: Chord) => `${pcOf(c.root)}:${c.type.id}`

/** The usual spelling of a chord's sound, without a bass: B♭ (not A♯), C♯m (not D♭m). */
export const plainChord = (c: Chord): Chord => ({ root: spellRoot(pcOf(c.root), c.type), type: c.type })

function parseFound(symbol: string): Chord | null {
  try {
    return parseChord(symbol)
  } catch {
    return null
  }
}

/** Whether a chord's sound is in your collection already (older builds saved B♭ and A♯ as two finds). */
export function inCollection(found: string[], chord: Chord): boolean {
  const s = soundOf(chord)
  return found.some((f) => {
    const c = parseFound(f)
    return !!c && soundOf(c) === s
  })
}

/** Your collection with each sound once, in its usual spelling, grouped by chord type (most common first). */
export function collectionGroups(found: string[]): { type: ChordType; chords: Chord[] }[] {
  const sounds = new Map<string, Chord>()
  for (const f of found) {
    const c = parseFound(f)
    if (c && !sounds.has(soundOf(c))) sounds.set(soundOf(c), plainChord(c))
  }
  return CHORD_TYPES.map((type) => ({ type, chords: [...sounds.values()].filter((c) => c.type.id === type.id) })).filter((g) => g.chords.length)
}

/**
 * The key a chord is the home chord of: its root, minor for minor chords and major otherwise. Diminished and
 * augmented chords have no home key of their own (null).
 */
export function homeKey(chord: Chord): Key | null {
  const q = chordQuality(chord.type)
  if (q === 'dim' || q === 'aug') return null
  return { tonic: { ...chord.root, oct: 4 }, mode: q === 'minor' ? 'minor' : 'major' }
}

export interface NoteSpan {
  midi: number
  /** performance.now() times in ms; `off` is null while the key is down. */
  on: number
  off: number | null
}

/** Recent notes for key finding, weighted by how long they sounded (a fifth of a second up to two seconds). */
export function noteWeights(notes: NoteSpan[], now: number): PlayedNote[] {
  return notes.map((n) => ({ midi: n.midi, weight: Math.min(2, Math.max(0.2, ((n.off ?? now) - n.on) / 1000)) }))
}
