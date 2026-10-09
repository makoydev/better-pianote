import { HOW_TO_EXPORT, ImportError } from './errors'
import { type Frac, ZERO, add, div, fmax, frac, gt, lt, parseDecimal, sub } from './frac'
import { type HarmonyParts, harmonySymbol } from './harmony'
import { TOO_SHORT_TYPES } from './notate'

/**
 * MusicXML (partwise) → plain data: every part's measures with their notes timed exactly, plus what's
 * needed later for repeats, chord symbols, key and time. No interpretation of voices or hands yet.
 */

export interface RawNote {
  /** From the start of the measure, in quarter notes. */
  start: Frac
  dur: Frac
  voice: string
  staff: number
  /** Position in the file, to keep chord notes in order. */
  order: number
  rest: boolean
  /** A whole-measure rest (`<rest measure="yes"/>`). */
  measureRest: boolean
  /** An invisible rest (it still takes time). */
  hidden: boolean
  /** Pitch, for notes: letter index (C = 0), alteration in semitones, octave. */
  step: number
  alter: number
  octave: number
  type?: string
  dots: number
  tm?: { actual: number; normal: number; normalType?: string; normalDots: number }
  tieStart: boolean
  tieStop: boolean
  tupletStart: boolean
  tupletStop: boolean
  finger?: number
}

export interface RawHarmony {
  /** From the start of the measure. */
  t: Frac
  /** Null when the app can't show this chord. */
  symbol: string | null
}

export interface RawMeasure {
  number: string
  /** How long the measure lasts: its content, or the time signature's bar when it's empty. */
  len: Frac
  notes: RawNote[]
  harmonies: RawHarmony[]
  /** Key and time in effect from the start of this measure ('' when the score doesn't say major or minor). */
  fifths: number
  mode: string
  time: [number, number]
  timeLen: Frac
  // Repeats and jumps.
  forward: boolean
  /** Backward repeat at the end: how many times the section is played (0 = none). */
  backward: number
  endingStart: number[] | null
  endingStop: boolean
  segno: boolean
  coda: boolean
  tocoda: boolean
  dacapo: boolean
  dalsegno: boolean
  fine: boolean
}

export interface PartCounts {
  grace: number
  cue: number
  unpitched: number
  invisible: number
  tooShort: number
  microtones: number
}

export interface ParsedPart {
  id: string
  name: string
  staves: number
  /** Notes to play (not rests, grace notes …). */
  notes: number
  measures: RawMeasure[]
  counts: PartCounts
  /** The first staff starts in bass clef. */
  bassClef: boolean
}

export interface ParsedScore {
  title: string
  composer: string
  /** Quarter notes per minute, if the score says. */
  tempo: number | null
  parts: ParsedPart[]
  /** Parts joined by a brace in the part list (a piano written as two parts, or a section), by id. */
  braces: { name: string; parts: string[] }[]
  /** Jump instructions ("D.S. al Coda") written only as words, which can't be followed. */
  jumpWords: string[]
}

// ---- Small DOM helpers (local names, so prefixed files still work) ----
const kids = (el: Element | null | undefined, name?: string): Element[] =>
  el ? Array.from(el.children).filter((c) => !name || c.localName === name) : []
const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null
const txt = (el: Element | null | undefined, name?: string) => ((name ? kid(el, name) : el)?.textContent ?? '').replace(/\s+/g, ' ').trim()
const int = (s: string) => (/^[+-]?\d+$/.test(s.trim()) ? Number(s) : NaN)

const TYPE_QUARTERS: Record<string, number> = { breve: 8, whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125 }
const JUMP_WORDS = /\b(d\.?\s?c\.?|d\.?\s?s\.?|da capo|dal segno|to coda|al coda|al fine)\b/i

export function parseMusicXml(xml: string): ParsedScore {
  const doc = new DOMParser().parseFromString(xml.replace(/^﻿/, ''), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new ImportError(`This doesn’t look like a MusicXML file. ${HOW_TO_EXPORT}`)
  }
  const root = doc.documentElement
  if (root.localName === 'score-timewise') {
    throw new ImportError('This MusicXML file is written “timewise”, which the app can’t read. Export it again as standard MusicXML.')
  }
  if (root.localName !== 'score-partwise') throw new ImportError(`This doesn’t look like a MusicXML score. ${HOW_TO_EXPORT}`)

  const credit = (type: string) =>
    kids(root, 'credit')
      .filter((c) => kids(c, 'credit-type').some((t) => txt(t) === type))
      .map((c) => kids(c, 'credit-words').map((w) => txt(w)).join(' '))
      .find(Boolean) ?? ''
  const title = txt(kid(root, 'work'), 'work-title') || txt(root, 'movement-title') || credit('title')
  const composer =
    txt(kids(kid(root, 'identification'), 'creator').find((c) => c.getAttribute('type') === 'composer')) || credit('composer')

  const names = new Map(kids(kid(root, 'part-list'), 'score-part').map((p) => [p.getAttribute('id') ?? '', txt(p, 'part-name')]))
  const braces: ParsedScore['braces'] = []
  const open = new Map<string, { symbol: string; name: string; members: string[] }>()
  for (const el of kids(kid(root, 'part-list'))) {
    if (el.localName === 'score-part') for (const g of open.values()) g.members.push(el.getAttribute('id') ?? '')
    if (el.localName !== 'part-group') continue
    const num = el.getAttribute('number') ?? '1'
    if (el.getAttribute('type') === 'start') open.set(num, { symbol: txt(el, 'group-symbol'), name: txt(el, 'group-name'), members: [] })
    else if (el.getAttribute('type') === 'stop') {
      const g = open.get(num)
      if (g?.symbol === 'brace') braces.push({ name: g.name, parts: g.members })
      open.delete(num)
    }
  }
  const jumpWords: string[] = []
  const parts = kids(root, 'part').map((p, i) => {
    const id = p.getAttribute('id') ?? `P${i + 1}`
    const name = names.get(id)
    return parsePart(p, id, name && !/^musicxml part$/i.test(name) ? name : `Part ${i + 1}`, jumpWords)
  })
  if (!parts.length) throw new ImportError('This score has no parts with music in them.')
  return { title, composer, tempo: findTempo(doc), parts, braces, jumpWords }
}

/** The first tempo in the score, in quarter notes per minute. */
function findTempo(doc: Document): number | null {
  const sound = Array.from(doc.getElementsByTagName('sound')).find((s) => Number(s.getAttribute('tempo')) > 0)
  if (sound) return Number(sound.getAttribute('tempo'))
  for (const m of Array.from(doc.getElementsByTagName('metronome'))) {
    const unit = TYPE_QUARTERS[txt(m, 'beat-unit')]
    const perMinute = Number(/\d+(\.\d+)?/.exec(txt(m, 'per-minute'))?.[0])
    if (!unit || !(perMinute > 0)) continue
    const dots = kids(m, 'beat-unit-dot').length
    return perMinute * unit * (2 - 0.5 ** dots)
  }
  return null
}

function parseTime(el: Element): { sig: [number, number]; len: Frac } | null {
  const beats = kids(el, 'beats').map((b) => txt(b).split('+').reduce((s, x) => s + (int(x) || 0), 0))
  const types = kids(el, 'beat-type').map((b) => int(txt(b)))
  if (!beats.length || beats.length !== types.length || beats.some((b) => !(b > 0)) || types.some((t) => !(t > 0))) return null
  // Composite signatures (3/4 + 2/4) add up; show them over the largest beat type.
  const den = Math.max(...types)
  const num = beats.reduce((s, b, i) => s + (b * den) / types[i], 0)
  if (!Number.isInteger(num)) return null
  return { sig: [num, den], len: frac(num * 4, den) }
}

function parsePart(partEl: Element, id: string, name: string, jumpWords: string[]): ParsedPart {
  let divisions = frac(1)
  let fifths = 0
  let mode = ''
  let time: [number, number] = [4, 4]
  let timeLen = frac(4)
  let staves = 1
  let bassClef = false
  let notes = 0
  let order = 0
  const counts: PartCounts = { grace: 0, cue: 0, unpitched: 0, invisible: 0, tooShort: 0, microtones: 0 }
  const measures: RawMeasure[] = []

  for (const mEl of kids(partEl, 'measure')) {
    let cursor = ZERO
    let end = ZERO
    let lastStart = ZERO
    const m: RawMeasure = {
      number: mEl.getAttribute('number') ?? String(measures.length + 1),
      len: ZERO,
      notes: [],
      harmonies: [],
      fifths,
      mode,
      time,
      timeLen,
      forward: false,
      backward: 0,
      endingStart: null,
      endingStop: false,
      segno: false,
      coda: false,
      tocoda: false,
      dacapo: false,
      dalsegno: false,
      fine: false,
    }
    const durOf = (el: Element) => {
      const d = parseDecimal(txt(el, 'duration'))
      return d && d.n > 0 ? div(d, divisions) : ZERO
    }

    for (const c of Array.from(mEl.children)) {
      switch (c.localName) {
        case 'attributes': {
          const d = parseDecimal(txt(c, 'divisions'))
          if (d && d.n > 0) divisions = d
          const key = kids(c, 'key').find((k) => (k.getAttribute('number') ?? '1') === '1')
          if (key && kid(key, 'fifths')) {
            const f = int(txt(key, 'fifths'))
            if (Number.isInteger(f)) fifths = Math.max(-7, Math.min(7, f))
            mode = txt(key, 'mode').toLowerCase()
          }
          const t = kid(c, 'time') && parseTime(kid(c, 'time')!)
          if (t) {
            time = t.sig
            timeLen = t.len
          }
          const st = int(txt(c, 'staves'))
          if (st > staves) staves = st
          const clef = kids(c, 'clef').find((k) => (k.getAttribute('number') ?? '1') === '1')
          if (clef && !measures.length && cursor.n === 0) bassClef = txt(clef, 'sign').toUpperCase() === 'F'
          // Changes before any note count from this measure; later ones from the next.
          if (cursor.n === 0 && end.n === 0) Object.assign(m, { fifths, mode, time, timeLen })
          break
        }
        case 'note': {
          const chord = !!kid(c, 'chord')
          const grace = !!kid(c, 'grace')
          const d = grace ? ZERO : durOf(c)
          const start = chord ? lastStart : cursor
          if (!chord) {
            lastStart = cursor
            cursor = add(cursor, d)
          }
          end = fmax(end, add(start, d))
          const staff = int(txt(c, 'staff')) || 1
          if (staff > staves) staves = staff
          const note = parseNote(c, start, d, staff, order++, counts, grace)
          if (note) {
            m.notes.push(note)
            if (!note.rest) notes++
          }
          break
        }
        case 'backup':
          cursor = sub(cursor, durOf(c))
          if (lt(cursor, ZERO)) cursor = ZERO
          break
        case 'forward':
          cursor = add(cursor, durOf(c))
          end = fmax(end, cursor)
          break
        case 'direction':
          parseDirection(c, m, jumpWords)
          break
        case 'sound':
          parseSound(c, m, false)
          break
        case 'harmony': {
          const h = parseHarmony(c)
          if (h === undefined) break
          const offset = parseDecimal(txt(c, 'offset'))
          m.harmonies.push({ t: add(cursor, offset ? div(offset, divisions) : ZERO), symbol: h })
          break
        }
        case 'barline':
          parseBarline(c, m)
          break
      }
    }
    m.len = gt(end, ZERO) ? end : m.timeLen
    measures.push(m)
  }
  return { id, name, staves, notes, measures, counts, bassClef }
}

function parseNote(c: Element, start: Frac, dur: Frac, staff: number, order: number, counts: PartCounts, grace: boolean): RawNote | null {
  if (grace) {
    counts.grace++
    return null
  }
  if (kid(c, 'cue')) {
    counts.cue++
    return null
  }
  const restEl = kid(c, 'rest')
  const pitch = kid(c, 'pitch')
  const printed = c.getAttribute('print-object') !== 'no'
  if (!restEl && !pitch) {
    counts.unpitched++
    return null
  }
  if (pitch && !printed) {
    counts.invisible++
    return null
  }
  const type = txt(c, 'type') || undefined
  if (type && TOO_SHORT_TYPES.has(type)) {
    counts.tooShort++
    return null
  }
  if (dur.n <= 0) return null

  const notations = kids(c, 'notations')
  const ties = kids(c, 'tie').map((t) => t.getAttribute('type'))
  const tied = notations.flatMap((n) => kids(n, 'tied')).map((t) => t.getAttribute('type'))
  const tuplets = notations.flatMap((n) => kids(n, 'tuplet')).map((t) => t.getAttribute('type'))
  const fingering = notations
    .flatMap((n) => kids(n, 'technical'))
    .flatMap((t) => kids(t, 'fingering'))
    .map((f) => /^([1-5])$/.exec(txt(f))?.[1])
    .find(Boolean)
  const tmEl = kid(c, 'time-modification')
  const actual = int(txt(tmEl, 'actual-notes'))
  const normal = int(txt(tmEl, 'normal-notes'))

  let step = -1
  let alter = 0
  let octave = 4
  if (pitch) {
    step = 'CDEFGAB'.indexOf(txt(pitch, 'step').toUpperCase())
    octave = int(txt(pitch, 'octave'))
    alter = Number(txt(pitch, 'alter') || 0)
    if (step < 0 || !Number.isInteger(octave) || !Number.isFinite(alter)) {
      counts.unpitched++
      return null
    }
    if (!Number.isInteger(alter)) {
      counts.microtones++
      alter = Math.round(alter)
    }
  }
  return {
    start,
    dur,
    voice: txt(c, 'voice') || '1',
    staff,
    order,
    rest: !!restEl,
    measureRest: restEl?.getAttribute('measure') === 'yes',
    hidden: !printed,
    step,
    alter,
    octave,
    type,
    dots: kids(c, 'dot').length,
    tm:
      actual > 0 && normal > 0 && actual !== normal
        ? { actual, normal, normalType: txt(tmEl, 'normal-type') || undefined, normalDots: kids(tmEl, 'normal-dot').length }
        : undefined,
    // <tie> is what sounds; fall back to the drawn <tied> when a file only has that.
    tieStart: ties.length ? ties.includes('start') : tied.some((t) => t === 'start' || t === 'continue'),
    tieStop: ties.length ? ties.includes('stop') : tied.some((t) => t === 'stop' || t === 'continue'),
    tupletStart: tuplets.includes('start'),
    tupletStop: tuplets.includes('stop'),
    finger: fingering ? Number(fingering) : undefined,
  }
}

function parseHarmony(c: Element): string | null | undefined {
  if (c.getAttribute('print-object') === 'no') return undefined
  const root = kid(c, 'root')
  const kind = kid(c, 'kind')
  if (!kind) return undefined
  if (!root) return txt(kind) === 'none' ? undefined : null
  const bass = kid(c, 'bass')
  const parts: HarmonyParts = {
    rootStep: txt(root, 'root-step').toUpperCase(),
    rootAlter: Number(txt(root, 'root-alter') || 0),
    kind: txt(kind),
    kindText: kind.getAttribute('text') ?? undefined,
    bassStep: bass ? txt(bass, 'bass-step').toUpperCase() : undefined,
    bassAlter: bass ? Number(txt(bass, 'bass-alter') || 0) : undefined,
    degrees: kids(c, 'degree').map((d) => ({
      value: int(txt(d, 'degree-value')),
      alter: Number(txt(d, 'degree-alter') || 0),
      type: txt(d, 'degree-type'),
    })),
  }
  return harmonySymbol(parts)
}

function parseDirection(dir: Element, m: RawMeasure, jumpWords: string[]) {
  let codaSign = false
  for (const dt of kids(dir, 'direction-type')) {
    if (kid(dt, 'segno')) m.segno = true
    if (kid(dt, 'coda')) codaSign = true
    for (const w of kids(dt, 'words')) {
      const words = txt(w)
      if (JUMP_WORDS.test(words)) jumpWords.push(words)
    }
  }
  const sound = kid(dir, 'sound')
  if (sound) parseSound(sound, m, codaSign)
  else if (codaSign) m.coda = true
}

function parseSound(s: Element, m: RawMeasure, codaSign: boolean) {
  if (s.hasAttribute('segno')) m.segno = true
  if (s.hasAttribute('tocoda')) m.tocoda = true
  // A coda sign without "to coda" marks where the coda starts.
  else if (s.hasAttribute('coda') || codaSign) m.coda = true
  if (s.getAttribute('dacapo') === 'yes') m.dacapo = true
  if (s.hasAttribute('dalsegno')) m.dalsegno = true
  if (s.hasAttribute('fine')) m.fine = true
}

function parseBarline(b: Element, m: RawMeasure) {
  const repeat = kid(b, 'repeat')
  if (repeat?.getAttribute('direction') === 'forward') m.forward = true
  if (repeat?.getAttribute('direction') === 'backward') m.backward = Math.max(2, int(repeat.getAttribute('times') ?? '') || 2)
  const ending = kid(b, 'ending')
  const type = ending?.getAttribute('type')
  if (ending && type === 'start') {
    const nums = (ending.getAttribute('number') ?? '1')
      .split(/[,\s]+/)
      .map(int)
      .filter((n) => n > 0)
    m.endingStart = nums.length ? nums : [1]
  }
  if (type === 'stop' || type === 'discontinue') m.endingStop = true
  if (kid(b, 'segno')) m.segno = true
  if (kid(b, 'coda')) m.coda = true
}
