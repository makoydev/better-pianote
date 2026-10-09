import { eventBeats } from '../../content/songs/parse'
import type { Song, SongChange, SongEvent, SongVoice } from '../../content/songs/types'
import { LETTER_SEMIS, fromMidi, keySignature, majorKey, midiOf, parseNote, pcOf, pitchName } from '../theory'
import { ImportError } from './errors'
import { type Frac, ZERO, add, cmp, frac, ge, gt, lt, mul, sub, toNum } from './frac'
import { type Notated, TYPE_DUR, notate, soundingLength, writtenLength } from './notate'
import type { ParsedPart, ParsedScore, RawNote } from './parse'
import { playOrder } from './repeats'
import { validateSong } from './validate'

export interface ImportPart {
  id: string
  name: string
  staves: number
  notes: number
}

export interface ImportResult {
  song: Song
  parts: ImportPart[]
  partIndex: number
  /** Short sentences for the person importing: what was left out or changed. */
  warnings: string[]
  stats: { bars: number; rhNotes: number; lhNotes: number; voices: number }
}

/** The CT-S1's 61 keys: C2–C7. */
const LOW = 36
const HIGH = 96
/** Extra lines per hand on top of the main one. */
const MAX_EXTRA = 2

interface Counters {
  folded: number
  overlaps: number
  inexact: number
  badChords: number
  unplacedChords: number
  droppedVoiceNotes: number
  extraStaffNotes: number
}

/** One event under construction, with what's needed to finish ties, tuplets and chord symbols. */
interface Built {
  /** From the start of its bar. */
  start: Frac
  len: Frac
  ev: SongEvent
  /** Notes the score ties onward from here (set on the last piece of a written note). */
  tieOut: Set<string>
  /** Notes the score ties into here (set on the first piece). */
  tieIn: Set<string>
  /** Tied to the next piece of the same written note (one long note split up). */
  split: boolean
  tStart: boolean
  tStop: boolean
  /** The tuplet's unit (its normal-type), for working out brackets the score doesn't mark. */
  unit?: Frac
  /** Filler for a bar where this voice has nothing written. */
  empty: boolean
}

const ACC: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }
const midiOfRaw = (n: RawNote) => (n.octave + 1) * 12 + LETTER_SEMIS[n.step] + n.alter

function spell(n: RawNote): string {
  if (n.alter in ACC) return 'CDEFGAB'[n.step] + ACC[n.alter] + n.octave
  // Triple sharps and the like: respell the same pitch.
  const x = fromMidi(midiOfRaw(n), n.alter > 0 ? 'sharp' : 'flat')
  return 'CDEFGAB'[x.letter] + ACC[x.acc] + x.oct
}

/** How the score wrote a note or rest, if the app can draw that value. */
function written(n: RawNote): Notated | undefined {
  const dur = n.type ? TYPE_DUR[n.type] : undefined
  if (!dur || n.dots > 2) return undefined
  return n.tm ? { dur, dots: n.dots, tuplet: { actual: n.tm.actual, normal: n.tm.normal } } : { dur, dots: n.dots }
}

function tupletUnit(n: RawNote): Frac | undefined {
  if (!n.tm) return undefined
  const type = n.tm.normalType ? TYPE_DUR[n.tm.normalType] : n.type ? TYPE_DUR[n.type] : undefined
  return type ? writtenLength(type, n.tm.normalType ? n.tm.normalDots : 0) : undefined
}

function restEvents(from: Frac, to: Frac, hidden: boolean, empty: boolean, head?: RawNote): Built[] {
  const { pieces } = notate(sub(to, from), head ? written(head) : undefined)
  let at = from
  return pieces.map((p, i) => {
    const ev: SongEvent = { notes: [], dur: p.dur, dots: p.dots, tie: false }
    if (p.tuplet) ev.tuplet = { actual: p.tuplet.actual, normal: p.tuplet.normal }
    if (hidden) ev.hidden = true
    const b: Built = {
      start: at,
      len: soundingLength(p),
      ev,
      tieOut: new Set(),
      tieIn: new Set(),
      split: false,
      tStart: i === 0 && !!head?.tupletStart,
      tStop: i === pieces.length - 1 && !!head?.tupletStop,
      unit: head && tupletUnit(head),
      empty,
    }
    at = add(at, b.len)
    return b
  })
}

function noteEvents(start: Frac, len: Frac, group: RawNote[], c: Counters): Built[] {
  const pitched = group.filter((n) => !n.rest)
  const head = pitched[0]
  const { pieces, exact } = notate(len, written(head))
  if (!exact) c.inexact++
  const names: string[] = []
  const fingerOf = new Map<string, number>()
  for (const n of [...pitched].sort((a, b) => midiOfRaw(a) - midiOfRaw(b))) {
    const name = spell(n)
    if (!names.includes(name)) names.push(name)
    if (n.finger && !fingerOf.has(name)) fingerOf.set(name, n.finger)
  }
  const tieOut = new Set(pitched.filter((n) => n.tieStart).map(spell))
  const tieIn = new Set(pitched.filter((n) => n.tieStop).map(spell))
  let at = start
  return pieces.map((p, i) => {
    const last = i === pieces.length - 1
    const ev: SongEvent = { notes: [...names], dur: p.dur, dots: p.dots, tie: false }
    if (p.tuplet) ev.tuplet = { actual: p.tuplet.actual, normal: p.tuplet.normal }
    if (i === 0 && fingerOf.size) {
      if (names.length === 1) ev.finger = fingerOf.get(names[0])
      else ev.fingers = names.map((nm) => fingerOf.get(nm) ?? null)
    }
    const b: Built = {
      start: at,
      len: soundingLength(p),
      ev,
      tieOut: last ? tieOut : new Set(),
      tieIn: i === 0 ? tieIn : new Set(),
      split: !last,
      tStart: i === 0 && group.some((n) => n.tupletStart),
      tStop: last && group.some((n) => n.tupletStop),
      unit: tupletUnit(head),
      empty: false,
    }
    at = add(at, b.len)
    return b
  })
}

/**
 * Files can only round some tuplets (a sextuplet with 256 divisions is 170⅔, written 170 or 171). Times
 * within a 64th of a quarter of each other are the same moment, and such times snap to the music's grid.
 */
const TOL = 1 / 64
export const close = (a: Frac, b: Frac) => Math.abs(toNum(a) - toNum(b)) <= TOL
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
function snap(t: Frac, steps: number): Frac {
  const s = frac(Math.round(toNum(t) * steps), steps)
  return close(s, t) ? s : t
}

/** A measure's length, snapped to its time signature or the 64th-note grid when the file rounded it. */
export const barLength = (m: { len: Frac; timeLen: Frac }) => (close(m.len, m.timeLen) ? m.timeLen : snap(m.len, 16))

/** One voice's events in one bar: chords grouped, gaps filled, overlaps trimmed. */
function buildBar(notes: RawNote[], barLen: Frac, c: Counters): Built[] {
  const groups: RawNote[][] = []
  for (const n of [...notes].sort((a, b) => cmp(a.start, b.start) || a.order - b.order)) {
    const g = groups[groups.length - 1]
    if (g && close(g[0].start, n.start)) g.push(n)
    else groups.push([n])
  }
  if (groups.every((g) => g.every((n) => n.rest && n.hidden))) return restEvents(ZERO, barLen, false, true)

  // Exact times: a note that follows straight on from the last starts where that one exactly ended and
  // lasts its written length; anything else snaps to the grid of the bar's tuplets.
  const steps = 16 * notes.reduce((l, n) => (n.tm ? (l * n.tm.actual) / gcd(l, n.tm.actual) : l), 1)
  const timed: { start: Frac; len: Frac; g: RawNote[]; head: RawNote }[] = []
  let fileEnd: Frac | null = null
  let exactEnd = ZERO
  for (const g of groups) {
    const head = g.find((n) => !n.rest) ?? g[0]
    const fileStart = g[0].start
    const fileLen = head.rest && head.measureRest && fileStart.n === 0 ? barLen : head.dur
    const w = written(head)
    const len = w && close(soundingLength(w), fileLen) ? soundingLength(w) : fileLen
    const start = fileEnd && close(fileStart, fileEnd) ? exactEnd : snap(fileStart, steps)
    timed.push({ start, len, g, head })
    fileEnd = add(fileStart, fileLen)
    exactEnd = add(start, len)
  }

  const out: Built[] = []
  let t = ZERO
  timed.forEach(({ start, len, g, head }, gi) => {
    if (lt(start, t) || ge(start, barLen)) return
    if (gt(start, t)) out.push(...restEvents(t, start, true, false))
    const next = timed[gi + 1]?.start
    const room = sub(next && lt(next, barLen) ? next : barLen, start)
    if (gt(len, room)) {
      // A hair too long from rounding isn't worth a warning.
      if (!close(len, room)) c.overlaps++
      len = room
    }
    out.push(...(head.rest ? restEvents(start, add(start, len), g.every((n) => n.hidden), false, head) : noteEvents(start, len, g, c)))
    t = add(start, len)
  })
  if (lt(t, barLen)) out.push(...restEvents(t, barLen, true, false))
  return out
}

/** Ties: a note tied onward lands on the same note in the next event of the same voice. */
function linkTies(flat: Built[]) {
  flat.forEach((b, i) => {
    const next = flat[i + 1]
    const tied = new Set<string>()
    if (b.split) for (const n of b.ev.notes) tied.add(n)
    for (const n of b.tieOut) if (next && !next.ev.hidden && next.ev.notes.includes(n) && next.tieIn.has(n)) tied.add(n)
    if (!tied.size) return
    if (tied.size === b.ev.notes.length) b.ev.tie = true
    else b.ev.tieNotes = b.ev.notes.filter((n) => tied.has(n))
  })
}

/** Bracket groups for tuplets: the score's own start/stop marks when they're consistent, else by time. */
function markTuplets(flat: Built[]) {
  const vis = flat.filter((b) => !b.ev.hidden)
  const same = (a: Built, b: Built) => a.ev.tuplet!.actual === b.ev.tuplet!.actual && a.ev.tuplet!.normal === b.ev.tuplet!.normal
  for (let i = 0; i < vis.length; ) {
    if (!vis[i].ev.tuplet) {
      i++
      continue
    }
    let j = i
    while (j + 1 < vis.length && vis[j + 1].ev.tuplet && same(vis[i], vis[j + 1])) j++
    const run = vis.slice(i, j + 1)
    if (!fromMarks(run)) byTime(run)
    i = j + 1
  }
}

function fromMarks(run: Built[]): boolean {
  if (!run.some((b) => b.tStart || b.tStop)) return false
  let open = false
  for (const b of run) {
    if (b.tStart) {
      if (open) return false
      open = true
    }
    if (!open) return false
    if (b.tStop) open = false
  }
  if (open) return false
  for (const b of run) {
    if (b.tStart) b.ev.tuplet!.start = true
    if (b.tStop) b.ev.tuplet!.end = true
  }
  return true
}

function byTime(run: Built[]) {
  let first = 0
  let acc = ZERO
  let span: Frac | null = null
  run.forEach((b, k) => {
    if (!span) {
      const t = b.ev.tuplet!
      span = mul(frac(t.normal), b.unit ?? writtenLength(b.ev.dur, 0))
      acc = ZERO
      first = k
    }
    acc = add(acc, b.len)
    if (ge(acc, span) || k === run.length - 1) {
      run[first].ev.tuplet!.start = true
      b.ev.tuplet!.end = true
      span = null
    }
  })
}

/** "C major", "F♯ minor", "D dorian" for a key signature and MusicXML mode. */
export function keyNameFor(fifths: number, mode: string): string {
  const MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']
  const degree = mode === 'minor' ? 5 : Math.max(0, MODES.indexOf(mode))
  const major = majorKey(fifths).tonic
  const letter = (major.letter + degree) % 7
  const sig = keySignature(fifths)
  const tonic = { letter, acc: sig.letters.includes('CDEFGAB'[letter]) ? sig.acc : 0, oct: 4 }
  const label = degree === 0 ? 'major' : degree === 5 ? 'minor' : MODES[degree]
  return `${pitchName(tonic)} ${label}`
}

function slug(s: string) {
  const base = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '')
  return base || 'song'
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const KEYBOARD = /piano|klavier|clavier|keyboard|cembalo|harpsichord|clavecin|fl[üu]gel|\bpno\b|\bpf\b/i
const RIGHT = /\b(right|rh|rechts|droite|upper|treble)\b/i
const LEFT = /\b(left|lh|links|gauche|lower|bass)\b/i
const HAND_WORDS = /\b(right|left|rh|lh|rechts|links|droite|gauche|upper|lower|treble|bass)\b(\s+hand)?/gi
const baseName = (name: string) => name.replace(HAND_WORDS, '').replace(/[()[\]\s,.:-]+/g, ' ').trim()

/**
 * A piano written as two single-staff parts ("Piano (right)" and "Piano (left)", or two parts under one
 * brace) becomes one part with two staves, offered alongside the real parts.
 */
function pianoPairs(score: ParsedScore): ParsedPart[] {
  const out: ParsedPart[] = []
  for (let i = 0; i + 1 < score.parts.length; i++) {
    const a = score.parts[i]
    const b = score.parts[i + 1]
    if (a.staves !== 1 || b.staves !== 1 || !a.notes || !b.notes || a.measures.length !== b.measures.length) continue
    const named = RIGHT.test(a.name) && LEFT.test(b.name) && baseName(a.name).toLowerCase() === baseName(b.name).toLowerCase()
    // Orchestras brace sections too (horns 1–2 and 3–4), so a brace needs a keyboard name to count.
    const braced = score.braces.some(
      (g) => g.parts.length === 2 && g.parts[0] === a.id && g.parts[1] === b.id && [g.name, a.name, b.name].some((x) => KEYBOARD.test(x)),
    )
    if (!named && !braced) continue
    out.push({
      id: `${a.id}+${b.id}`,
      name: `${baseName(a.name) || 'Piano'} (both hands)`,
      staves: 2,
      notes: a.notes + b.notes,
      bassClef: false,
      counts: Object.fromEntries(Object.entries(a.counts).map(([k, v]) => [k, v + b.counts[k as keyof typeof b.counts]])) as ParsedPart['counts'],
      measures: a.measures.map((m, k) => {
        const lower = b.measures[k]
        return {
          ...m,
          len: lt(m.len, lower.len) ? lower.len : m.len,
          notes: [
            ...m.notes.map((n) => ({ ...n, staff: 1 })),
            ...lower.notes.map((n) => ({ ...n, staff: 2, voice: `L${n.voice}`, order: n.order + 1e7 })),
          ],
          harmonies: m.harmonies.length ? m.harmonies : lower.harmonies,
        }
      }),
    })
    i++
  }
  return out
}

/** The part to import unless told otherwise: a piano, then any two-staff part, then anything with notes. */
function defaultPart(parts: ParsedPart[]): number {
  const tries = [
    (p: ParsedPart) => p.staves >= 2 && KEYBOARD.test(p.name),
    (p: ParsedPart) => p.staves >= 2 && p.id.includes('+'),
    (p: ParsedPart) => p.staves >= 2,
    () => true,
  ]
  for (const t of tries) {
    const i = parts.findIndex((p) => p.notes > 0 && t(p))
    if (i >= 0) return i
  }
  return 0
}

export function convertScore(score: ParsedScore, fileName: string, opts: { partIndex?: number } = {}): ImportResult {
  const candidates = [...score.parts, ...pianoPairs(score)]
  const parts: ImportPart[] = candidates.map((p) => ({ id: p.id, name: p.name, staves: p.staves, notes: p.notes }))
  const partIndex =
    opts.partIndex !== undefined && opts.partIndex >= 0 && opts.partIndex < candidates.length ? opts.partIndex : defaultPart(candidates)
  const part = candidates[partIndex]
  if (!part.notes) throw new ImportError('This score has no notes to play.')
  const c: Counters = { folded: 0, overlaps: 0, inexact: 0, badChords: 0, unplacedChords: 0, droppedVoiceNotes: 0, extraStaffNotes: 0 }
  const warnings: string[] = []
  const ms = part.measures

  // Fit every note on the keyboard (each written note once, before repeats copy measures).
  for (const m of ms) {
    for (const n of m.notes) {
      if (n.rest) continue
      let midi = midiOfRaw(n)
      if (midi >= LOW && midi <= HIGH) continue
      c.folded++
      while (midi < LOW) {
        n.octave++
        midi += 12
      }
      while (midi > HIGH) {
        n.octave--
        midi -= 12
      }
    }
  }

  // Which voices make up each hand: the busiest is the main line, then up to two more, highest first.
  const tally = new Map<string, { staff: number; voice: string; count: number; pitch: number }>()
  for (const m of ms) {
    for (const n of m.notes) {
      if (n.staff > 2) {
        if (!n.rest) c.extraStaffNotes++
        continue
      }
      const key = `${n.staff}|${n.voice}`
      const t = tally.get(key) ?? tally.set(key, { staff: n.staff, voice: n.voice, count: 0, pitch: 0 }).get(key)!
      if (!n.rest) {
        t.count++
        t.pitch += midiOfRaw(n)
      }
    }
  }
  const voicesOf = (staff: number) => {
    const list = [...tally.values()].filter((t) => t.staff === staff && t.count > 0).sort((a, b) => b.count - a.count)
    const extras = list.slice(1).sort((a, b) => b.pitch / b.count - a.pitch / a.count)
    for (const dropped of extras.slice(MAX_EXTRA)) c.droppedVoiceNotes += dropped.count
    return list.length ? [list[0], ...extras.slice(0, MAX_EXTRA)] : []
  }

  const { order, ok } = playOrder(ms)
  const byMeasure = ms.map((m) => {
    const map = new Map<string, RawNote[]>()
    for (const n of m.notes) {
      const key = `${n.staff}|${n.voice}`
      ;(map.get(key) ?? map.set(key, []).get(key)!).push(n)
    }
    return map
  })
  const buildVoice = (staff: number, voice: string) =>
    order.map((mi) => buildBar(byMeasure[mi].get(`${staff}|${voice}`) ?? [], barLength(ms[mi]), c))
  const emptyBars = () => order.map((mi) => restEvents(ZERO, barLength(ms[mi]), false, true))

  const hands = [1, 2].map((staff) => voicesOf(staff).map((v) => buildVoice(staff, v.voice)))
  const rhLines = hands[0].length ? hands[0] : [emptyBars()]
  const lhLines = hands[1]
  for (const lines of [rhLines, lhLines]) {
    const [main, ...extras] = lines
    if (!main) continue
    // Extra voices disappear where they have nothing; the main line shows a rest unless another voice plays.
    for (const x of extras) for (const bar of x) for (const b of bar) if (b.empty) b.ev.hidden = true
    main.forEach((bar, k) => {
      if (!bar.every((b) => b.empty)) return
      if (extras.some((x) => x[k].some((b) => !b.ev.hidden && b.ev.notes.length))) for (const b of bar) b.ev.hidden = true
    })
    for (const line of lines) {
      const flat = line.flat()
      linkTies(flat)
      markTuplets(flat)
    }
  }

  // Chord symbols go on whatever starts at their moment: right hand first, then left, then other voices.
  const allLines = [rhLines[0], ...(lhLines[0] ? [lhLines[0]] : []), ...rhLines.slice(1), ...lhLines.slice(1)]
  const counted = new Set<number>()
  order.forEach((mi, k) => {
    const first = !counted.has(mi)
    counted.add(mi)
    for (const h of ms[mi].harmonies) {
      if (!h.symbol) {
        if (first) c.badChords++
        continue
      }
      const target = allLines.map((l) => l[k].find((b) => close(b.start, h.t) && !b.ev.hidden)).find(Boolean)
      if (target && !target.ev.chord) target.ev.chord = h.symbol
      else if (!target && first) c.unplacedChords++
    }
  })

  const toEvents = (line: Built[][]) => line.map((bar) => bar.map((b) => b.ev))
  const rh = toEvents(rhLines[0])
  const lh = lhLines[0] ? toEvents(lhLines[0]) : undefined
  const voices: SongVoice[] = [
    ...rhLines.slice(1).map((l) => ({ hand: 'rh' as const, bars: toEvents(l) })),
    ...lhLines.slice(1).map((l) => ({ hand: 'lh' as const, bars: toEvents(l) })),
  ]

  // Key and time: the first bar's, then every change in playing order.
  const first = ms[order[0]]
  const changes: SongChange[] = []
  order.forEach((mi, k) => {
    if (k === 0) return
    const m = ms[mi]
    const prev = ms[order[k - 1]]
    const ch: SongChange = { bar: k }
    if (m.fifths !== prev.fifths) ch.keySig = m.fifths
    if (m.time[0] !== prev.time[0] || m.time[1] !== prev.time[1]) ch.time = m.time
    if (ch.keySig !== undefined || ch.time) changes.push(ch)
  })
  const firstLen = barLength(first)
  const pickup = lt(firstLen, first.timeLen) ? toNum(firstLen) : undefined
  const bpm = Math.round(Math.max(40, Math.min(160, score.tempo ?? 90)))

  const title = score.title || fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'Untitled'
  const song: Song = {
    id: `my-${slug(title)}-${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`,
    title,
    composer: score.composer || 'Unknown composer',
    year: '',
    difficulty: 1,
    keyName: keyNameFor(first.fifths, first.mode && first.mode !== 'none' ? first.mode : guessMode(first.fifths, [...rhLines, ...lhLines])),
    keySig: first.fifths,
    time: first.time,
    bpm,
    ...(pickup !== undefined ? { pickup } : {}),
    tags: ['Imported'],
    about: `Imported from ${fileName}.`,
    rh,
    ...(lh ? { lh } : {}),
    ...(voices.length ? { voices } : {}),
    ...(changes.length ? { changes } : {}),
    imported: { fileName, at: Date.now() },
  }
  const stats = {
    bars: rh.length,
    rhNotes: countAttacks(rhLines),
    lhNotes: countAttacks(lhLines),
    voices: rhLines.length + lhLines.length,
  }
  song.difficulty = estimateDifficulty(song)

  const problems = validateSong(song)
  if (problems.length) {
    console.warn('MusicXML import produced an invalid song:', problems)
    throw new ImportError('Something in this score confused the importer, so it couldn’t be imported.')
  }

  // ---- What the person should know ----
  const k = part.counts
  if (part.staves > 2) warnings.push(`This part has ${part.staves} staves; only the top two are used.`)
  if (c.extraStaffNotes) warnings.push(`Left out ${plural(c.extraStaffNotes, 'note')} from the extra staves.`)
  if (k.grace) warnings.push(`Left out ${plural(k.grace, 'grace note')} (the small quick notes before a beat).`)
  if (k.cue) warnings.push(`Left out ${plural(k.cue, 'cue note')}.`)
  if (k.invisible) warnings.push(`Left out ${plural(k.invisible, 'hidden note')}.`)
  if (k.unpitched) warnings.push(`Left out ${plural(k.unpitched, 'percussion note')}.`)
  if (k.tooShort) warnings.push(`Left out ${plural(k.tooShort, 'note')} shorter than a 64th note.`)
  if (k.microtones) warnings.push(`Rounded ${plural(k.microtones, 'microtone')} to the nearest key.`)
  if (c.folded) warnings.push(`Moved ${plural(c.folded, 'note')} by an octave so ${c.folded === 1 ? 'it fits' : 'they fit'} your 61 keys (C2–C7).`)
  if (c.droppedVoiceNotes) warnings.push(`Left out ${plural(c.droppedVoiceNotes, 'note')} from a fourth melody line in one hand.`)
  if (c.overlaps) warnings.push(`Shortened ${plural(c.overlaps, 'note')} that ran into the next one.`)
  if (c.inexact) warnings.push(`${plural(c.inexact, 'rhythm')} couldn’t be written exactly, so ${c.inexact === 1 ? 'it' : 'they'} may look odd (timing is kept).`)
  if (c.badChords) warnings.push(`Left out ${plural(c.badChords, 'chord symbol')} the app can’t show yet.`)
  if (c.unplacedChords) warnings.push(`Left out ${plural(c.unplacedChords, 'chord symbol')} that didn’t line up with a note.`)
  if (!ok) warnings.push('The repeats in this score are too tangled to follow, so it plays straight through.')
  else if (order.length !== ms.length) {
    warnings.push(`Repeats are written out in full, so the ${plural(ms.length, 'bar')} ${ms.length === 1 ? 'plays' : 'play'} as ${order.length}.`)
  }
  const soundJumps = ms.some((m) => m.dacapo || m.dalsegno || m.tocoda)
  if (score.jumpWords.length && !soundJumps) {
    warnings.push(`This score says “${score.jumpWords[0]}” only as text, so it plays straight through without the jump.`)
  }
  if (part.bassClef && part.staves === 1) warnings.push('This part is in bass clef; it’s shown on a treble staff.')
  return { song, parts, partIndex, warnings, stats }
}

/**
 * Major or minor, when the score doesn't say. Pieces nearly always end on their home note, so the lowest
 * note of the last bar decides; failing that, the minor key's raised 7th (G♯ in A minor) gives it away.
 */
function guessMode(fifths: number, lines: Built[][][]): 'major' | 'minor' {
  const majorPc = pcOf(majorKey(fifths).tonic)
  const minorPc = (majorPc + 9) % 12
  const bars = lines[0]?.length ?? 0
  for (let k = bars - 1; k >= 0; k--) {
    const notes = lines.flatMap((line) => line[k].flatMap((b) => b.ev.notes))
    if (!notes.length) continue
    const lowest = Math.min(...notes.map((n) => midiOf(parseNote(n)))) % 12
    if (lowest === minorPc) return 'minor'
    if (lowest === majorPc) return 'major'
    break
  }
  const lead = (minorPc + 11) % 12
  const all = lines.flatMap((line) => line.flat().flatMap((b) => b.ev.notes))
  return all.length && all.filter((n) => pcFromName(n) === lead).length / all.length > 0.02 ? 'minor' : 'major'
}

/** Notes you press (a tied continuation isn't pressed again). */
function countAttacks(lines: Built[][][]): number {
  let total = 0
  for (const line of lines) {
    let prev: SongEvent | null = null
    for (const b of line.flat()) {
      const held = prev ? (prev.tie ? prev.notes : (prev.tieNotes ?? [])) : []
      total += b.ev.notes.filter((n) => !held.includes(n)).length
      prev = b.ev
    }
  }
  return total
}

/**
 * Beginner / Intermediate / Advanced from what makes a piece hard to read and play. Points:
 * - speed: moments per second you press keys, at the suggested tempo but no faster than 120 (you can
 *   always practise slower) — under 1.6 → 0, under 2.6 → 1, under 3.6 → 2, else 3
 * - sixteenth notes or shorter → +1
 * - a busy left hand (pressing at least once a second) → +1
 * - more than 8% of notes outside the key signature → +1
 * - three or more sharps or flats in the key signature → +1
 * - tuplets, or more than one line in a hand → +1
 * 0–1 points is Beginner, 2–3 Intermediate, 4 or more Advanced.
 */
export function estimateDifficulty(song: Song): 1 | 2 | 3 {
  const barStarts: number[] = []
  let total = 0
  for (const bar of song.rh) {
    barStarts.push(total)
    total += bar.reduce((s, e) => s + eventBeats(e), 0)
  }
  const seconds = Math.max(1, (total * 60) / Math.min(song.bpm, 120))
  const tonic = pcOf(majorKey(song.keySig).tonic)
  const scale = new Set([0, 2, 4, 5, 7, 9, 11].map((x) => (x + tonic) % 12))
  const lines = [
    { lh: false, bars: song.rh },
    ...(song.lh ? [{ lh: true, bars: song.lh }] : []),
    ...(song.voices ?? []).map((v) => ({ lh: v.hand === 'lh', bars: v.bars })),
  ]
  const onsets = new Set<number>()
  const lhOnsets = new Set<number>()
  let notes = 0
  let outside = 0
  let shortest = Infinity
  let tuplets = false
  for (const line of lines) {
    let prev: SongEvent | null = null
    line.bars.forEach((bar, k) => {
      let at = barStarts[k]
      for (const e of bar) {
        const held = prev ? (prev.tie ? prev.notes : (prev.tieNotes ?? [])) : []
        const len = eventBeats(e)
        const pressed = e.notes.filter((n) => !held.includes(n))
        if (e.tuplet && !e.hidden) tuplets = true
        if (pressed.length) {
          const t = Math.round(at * 1000)
          onsets.add(t)
          if (line.lh) lhOnsets.add(t)
          shortest = Math.min(shortest, len)
          for (const n of pressed) {
            notes++
            if (!scale.has(pcFromName(n))) outside++
          }
        }
        prev = e
        at += len
      }
    })
  }
  const rate = onsets.size / seconds
  let points = rate < 1.6 ? 0 : rate < 2.6 ? 1 : rate < 3.6 ? 2 : 3
  if (shortest <= 0.25 + 1e-9) points++
  if (lhOnsets.size / seconds >= 1) points++
  if (notes && outside / notes > 0.08) points++
  if (Math.abs(song.keySig) >= 3) points++
  if (tuplets || song.voices?.length) points++
  return points <= 1 ? 1 : points <= 3 ? 2 : 3
}

function pcFromName(name: string): number {
  const m = /^([A-G])(#{1,2}|b{1,2})?/.exec(name)!
  const acc = m[2] ? (m[2][0] === '#' ? m[2].length : -m[2].length) : 0
  return (((LETTER_SEMIS['CDEFGAB'.indexOf(m[1])] + acc) % 12) + 12) % 12
}
