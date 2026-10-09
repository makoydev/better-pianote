import { KEYSIG_POSITIONS, type Note, keySignature, midiOf, parseNote, stepOf } from '../../lib/theory'
import { ENGRAVING, GLYPH, WIDTH, accidentalGlyph, timeSigDigit } from './glyphs'

/** Pure layout for a staff: turns notes into positioned glyphs, lines and text (all in px). */

export type Duration = 'w' | 'h' | 'q' | '8' | '16'
export type NoteState = 'normal' | 'active' | 'correct' | 'wrong' | 'ghost' | 'done'
export type StaffId = 'treble' | 'bass'
export type ClefKind = 'treble' | 'bass' | 'grand' | 'rhythm'

export interface StaffNoteSpec {
  note: string | Note
  color?: string
  finger?: number
  label?: string
  state?: NoteState
}

export interface StaffEvent {
  key?: string | number
  /** No notes = a rest. */
  notes?: (string | Note | StaffNoteSpec)[]
  dur?: Duration
  dots?: number
  /** Which staff of a grand staff (default: middle C and up → treble). */
  staff?: StaffId
  /** Chord symbol above the staff. */
  chord?: string
  /** Text under the staff, e.g. counting "1 &". */
  text?: string
  state?: NoteState
  /** Tie each note to the same note in the next event. */
  tie?: boolean
  stem?: 'up' | 'down'
  /** Set false to stop this note joining a beam. */
  beam?: boolean
  /** Takes up space but draws nothing (e.g. an empty staff waiting for notes). */
  hidden?: boolean
}
export interface StaffBar {
  bar: 'single' | 'double' | 'final'
  key?: string | number
}
export type StaffItem = StaffEvent | StaffBar
export const isBar = (i: StaffItem): i is StaffBar => 'bar' in i
const isPreBar = (p: Pre | StaffBar): p is StaffBar => 'bar' in p

export interface LayoutOptions {
  clef: ClefKind
  keySig: number
  time?: [number, number]
  sp: number
  spacing: 'even' | 'proportional'
  minSlot: number
  showClef: boolean
  /** Draw staff lines, brace and the system bar line (off for notes layered over a separate staff). */
  lines: boolean
  endBar: boolean
  labels: boolean
  fingers: boolean
  reserveAbove: number
  reserveBelow: number
  gap: number
  extraPerSlot: number
  labelFor: (n: Note) => string
  /** Text width in px (chord symbols use the display font). */
  measure: (text: string, size: number, display: boolean) => number
}

export interface Glyph {
  x: number
  y: number
  ch: string
  size: number
  color?: string
}
export interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
  w: number
}
export interface Text {
  x: number
  y: number
  text: string
  size: number
  kind: 'chord' | 'label' | 'finger' | 'text'
  color?: string
  anchor?: 'start' | 'middle'
}
export interface LaidNote {
  note: Note
  spec: StaffNoteSpec
  staff: StaffId
  p: number
  x: number
  y: number
  state: NoteState
}
export interface LaidEvent {
  key: string | number
  index: number
  x: number
  headX: number
  headW: number
  width: number
  state: NoteState
  rest: boolean
  notes: LaidNote[]
  heads: (Glyph & { state: NoteState; letter: number })[]
  glyphs: Glyph[]
  lines: Line[]
  dots: { x: number; y: number; r: number }[]
  texts: Text[]
}
export interface Layout {
  sp: number
  width: number
  height: number
  /** Shift everything down by this much so nothing is cut off at the top. */
  offsetY: number
  staves: StaffId[]
  staffTop: Record<StaffId, number>
  staffLines: Line[]
  header: Glyph[]
  bars: Line[]
  events: LaidEvent[]
  beams: { key: string; points: string }[]
  ties: { key: string; d: string }[]
  contentStart: number
  slots: number
  rhythm: boolean
}

const BEATS: Record<Duration, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 }

function spec(n: string | Note | StaffNoteSpec): StaffNoteSpec & { n: Note } {
  if (typeof n === 'string') return { note: n, n: parseNote(n) }
  if ('letter' in n) return { note: n, n }
  return { ...n, n: typeof n.note === 'string' ? parseNote(n.note) : n.note }
}

interface PreNote {
  n: Note
  spec: StaffNoteSpec
  staff: StaffId
  p: number
  acc: number | null
  accCol: number
  displaced: boolean
}

interface Pre {
  ev: StaffEvent
  itemIndex: number
  dur: Duration
  beats: number
  rest: boolean
  restStaff: StaffId
  notes: PreNote[]
  dirs: Partial<Record<StaffId, 'up' | 'down'>>
  accCols: number
  dispLeft: boolean
  dispRight: boolean
  leftExt: number
  rightExt: number
  slot: number
  beamGroup: number | null
  pos: number
}

export function layoutStaff(items: StaffItem[], o: LayoutOptions): Layout {
  const sp = o.sp
  const rhythm = o.clef === 'rhythm'
  const staves: StaffId[] = o.clef === 'grand' ? ['treble', 'bass'] : o.clef === 'bass' ? ['bass'] : ['treble']
  const staffTop: Record<StaffId, number> = { treble: 0, bass: o.clef === 'grand' ? (4 + o.gap) * sp : 0 }
  const yOf = (s: StaffId, p: number) => staffTop[s] + ((8 - p) * sp) / 2
  const pOf = (n: Note, s: StaffId) => (rhythm ? 4 : stepOf(n) - (s === 'treble' ? 30 : 18))
  const stemT = ENGRAVING.stem * sp
  const fontSize = 4 * sp
  const labelSize = Math.max(11, sp * 1.15)
  const fingerSize = Math.max(11, sp * 1.05)
  const chordSize = Math.max(13, sp * 1.45)

  // ---- Header: brace, clefs, key signature, time signature ----
  const header: Glyph[] = []
  const startX = o.clef === 'grand' ? 1.4 * sp : 0.2 * sp
  let hx = startX + 0.5 * sp
  if (o.showClef) {
    for (const s of staves) {
      if (rhythm) header.push({ x: hx, y: yOf(s, 4), ch: GLYPH.percClef, size: fontSize })
      else header.push({ x: hx, y: yOf(s, s === 'treble' ? 2 : 6), ch: s === 'treble' ? GLYPH.gClef : GLYPH.fClef, size: fontSize })
    }
    hx += (rhythm ? WIDTH.percClef : WIDTH.fClef) * sp + 0.9 * sp
  }
  const sig = keySignature(rhythm ? 0 : o.keySig)
  if (sig.letters.length) {
    for (const s of staves) {
      const positions = KEYSIG_POSITIONS[s][sig.acc > 0 ? 'sharp' : 'flat']
      sig.letters.forEach((_, i) => {
        header.push({ x: hx + i * 1.05 * sp, y: yOf(s, pOf(parseNote(positions[i]), s)), ch: sig.acc > 0 ? GLYPH.sharp : GLYPH.flat, size: fontSize })
      })
    }
    hx += sig.letters.length * 1.05 * sp + 0.6 * sp
  }
  if (o.time) {
    const dw = WIDTH.timeSig * sp * 0.9
    const [num, den] = o.time.map(String)
    const w = Math.max(num.length, den.length) * dw
    for (const s of staves) {
      const draw = (str: string, p: number) => {
        const sx = hx + (w - str.length * dw) / 2
        ;[...str].forEach((d, i) => header.push({ x: sx + i * dw, y: yOf(s, p), ch: timeSigDigit(Number(d)), size: fontSize }))
      }
      draw(num, 6)
      draw(den, 2)
    }
    hx += w + 0.8 * sp
  }
  const contentStart = hx + 0.7 * sp

  // ---- Pass 1: notes, accidentals, stems, widths ----
  const keyAcc: Record<number, number> = {}
  sig.letters.forEach((l) => (keyAcc['CDEFGAB'.indexOf(l)] = sig.acc))
  let measureAcc = new Map<string, number>()
  const pres: (Pre | StaffBar)[] = []
  let pos = 0
  let beamGroupId = 0
  let lastGroupKey: string | null = null
  const groupLen = o.time && o.time[1] === 8 && o.time[0] % 3 === 0 ? 1.5 : 1

  items.forEach((item, itemIndex) => {
    if (isBar(item)) {
      measureAcc = new Map()
      pos = 0
      lastGroupKey = null
      pres.push(item)
      return
    }
    const dur = item.dur ?? 'q'
    const beats = BEATS[dur] * (item.dots ? 1.5 : 1)
    const specs = (item.notes ?? []).map(spec)
    const notes: PreNote[] = specs.map((s) => {
      const staff: StaffId =
        item.staff ?? (o.clef === 'grand' ? (midiOf(s.n) >= 60 ? 'treble' : 'bass') : o.clef === 'bass' ? 'bass' : 'treble')
      return { n: s.n, spec: s, staff, p: pOf(s.n, staff), acc: null, accCol: 0, displaced: false }
    })
    // Accidentals: shown when they differ from the key signature or an earlier note in this bar.
    if (!rhythm) {
      for (const pn of notes) {
        const k = `${pn.staff}${pn.n.letter}${pn.n.oct}`
        const current = measureAcc.has(k) ? measureAcc.get(k)! : (keyAcc[pn.n.letter] ?? 0)
        if (pn.n.acc !== current) pn.acc = pn.n.acc
        measureAcc.set(k, pn.n.acc)
      }
    }
    const dirs: Partial<Record<StaffId, 'up' | 'down'>> = {}
    let dispLeft = false
    let dispRight = false
    let accCols = 0
    for (const s of staves) {
      const g = notes.filter((pn) => pn.staff === s).sort((a, b) => a.p - b.p)
      if (!g.length) continue
      const minP = g[0].p
      const maxP = g[g.length - 1].p
      const dir: 'up' | 'down' = rhythm ? 'up' : (item.stem ?? (maxP - 4 > 4 - minP || (maxP - 4 === 4 - minP && maxP >= 4) ? 'down' : 'up'))
      dirs[s] = dir
      // Notes a step apart can't share a column: flip one to the other side of the stem.
      if (dir === 'up' || dur === 'w') {
        for (let i = 1; i < g.length; i++) if (g[i].p - g[i - 1].p === 1 && !g[i - 1].displaced) g[i].displaced = true
        if (g.some((x) => x.displaced)) dispRight = true
      } else {
        for (let i = g.length - 2; i >= 0; i--) if (g[i + 1].p - g[i].p === 1 && !g[i + 1].displaced) g[i].displaced = true
        if (g.some((x) => x.displaced)) dispLeft = true
      }
      // Stack accidentals in columns so they never collide.
      const withAcc = g.filter((x) => x.acc !== null).sort((a, b) => b.p - a.p)
      const cols: number[][] = []
      for (const x of withAcc) {
        let c = 0
        while (cols[c]?.some((p) => Math.abs(p - x.p) < 6)) c++
        ;(cols[c] ??= []).push(x.p)
        x.accCol = c
      }
      accCols = Math.max(accCols, cols.length)
    }
    const rest = notes.length === 0
    const headW = (dur === 'w' ? WIDTH.whole : WIDTH.black) * sp
    const leftExt = (dispLeft ? headW - stemT : 0) + (accCols ? accCols * 1.12 * sp + 0.25 * sp : 0)
    const restW = { w: WIDTH.restWhole, h: WIDTH.restHalf, q: WIDTH.restQuarter, '8': WIDTH.rest8, '16': WIDTH.rest16 }[dur] * sp
    const rightExt = rest ? restW : headW + (dispRight ? headW - stemT : 0) + (item.dots ? 0.6 * sp : 0)
    const longestText = Math.max(
      item.text ? o.measure(item.text, labelSize, false) : 0,
      // Chord symbols: centred over the note in exercises, starting at the notehead in music.
      item.chord ? o.measure(item.chord, chordSize, true) + (o.spacing === 'even' ? 0 : leftExt - 0.2 * sp) : 0,
      o.labels ? Math.max(0, ...notes.map((pn) => o.measure(pn.spec.label ?? o.labelFor(pn.n), labelSize, false))) : 0,
    )
    const natural = Math.max(leftExt + rightExt + 1.4 * sp, longestText + 0.8 * sp)
    const slot =
      (o.spacing === 'even' ? Math.max(o.minSlot * sp, natural) : Math.max(natural, (2.1 + 2.6 * Math.pow(beats, 0.7)) * sp)) +
      o.extraPerSlot
    // Beam groups: eighths/sixteenths inside the same beat.
    let beamGroup: number | null = null
    if (o.time && !rest && (dur === '8' || dur === '16') && item.beam !== false) {
      const key = `${Math.floor(pos / groupLen + 1e-6)}`
      if (key !== lastGroupKey) beamGroupId++
      lastGroupKey = key
      beamGroup = beamGroupId
    } else {
      lastGroupKey = null
    }
    pres.push({ ev: item, itemIndex, dur, beats, rest, restStaff: item.staff ?? staves[0], notes, dirs, accCols, dispLeft, dispRight, leftExt, rightExt, slot, beamGroup, pos })
    pos += beats
  })

  // Single-note "groups" don't get beams.
  const groupSizes = new Map<number, number>()
  for (const p of pres) if (!isPreBar(p) && p.beamGroup !== null) groupSizes.set(p.beamGroup, (groupSizes.get(p.beamGroup) ?? 0) + 1)
  for (const p of pres) if (!isPreBar(p) && p.beamGroup !== null && (groupSizes.get(p.beamGroup) ?? 0) < 2) p.beamGroup = null

  // ---- Pass 2: x positions and drawing primitives ----
  const events: LaidEvent[] = []
  const barXs: { x: number; type: StaffBar['bar'] }[] = []
  let x = contentStart
  let eventIndex = 0
  const stemInfo = new Map<LaidEvent, { staff: StaffId; dir: 'up' | 'down'; x: number; yHead: number; yFar: number; minEnd: number; dur: Duration; group: number | null }>()

  for (const p of pres) {
    if (isPreBar(p)) {
      barXs.push({ x: x + 0.1 * sp, type: p.bar })
      x += 1.3 * sp
      continue
    }
    const ev = p.ev
    const headW = (p.dur === 'w' ? WIDTH.whole : WIDTH.black) * sp
    // Evenly spaced exercises centre each note in its slot; music keeps notes at the slot start.
    const headX = o.spacing === 'even' ? x + (p.slot - p.leftExt - p.rightExt) / 2 + p.leftExt : x + p.leftExt
    const evState: NoteState = ev.state ?? 'normal'
    const le: LaidEvent = {
      key: ev.key ?? `e${eventIndex}`,
      index: eventIndex,
      x,
      headX,
      headW,
      width: p.slot,
      state: evState,
      rest: p.rest,
      notes: [],
      heads: [],
      glyphs: [],
      lines: [],
      dots: [],
      texts: [],
    }
    if (ev.hidden) {
      events.push(le)
      x += p.slot
      eventIndex++
      continue
    }
    if (p.rest) {
      const s = p.restStaff
      const restCh = { w: GLYPH.restWhole, h: GLYPH.restHalf, q: GLYPH.restQuarter, '8': GLYPH.rest8, '16': GLYPH.rest16 }[p.dur]
      const ry = p.dur === 'w' ? yOf(s, rhythm ? 4 : 6) : yOf(s, 4)
      le.glyphs.push({ x: headX, y: ry, ch: restCh, size: fontSize })
      if (ev.dots) le.dots.push({ x: headX + 1.5 * sp, y: yOf(s, 5), r: 0.2 * sp })
    }
    for (const s of staves) {
      const g = p.notes.filter((pn) => pn.staff === s).sort((a, b) => a.p - b.p)
      if (!g.length) continue
      const dir = p.dirs[s] ?? 'up'
      const headCh = p.dur === 'w' ? GLYPH.whole : p.dur === 'h' ? GLYPH.half : GLYPH.black
      for (const pn of g) {
        let hx2 = headX
        if (pn.displaced) hx2 = dir === 'up' || p.dur === 'w' ? headX + headW - stemT : headX - headW + stemT
        const y = yOf(s, pn.p)
        const state = pn.spec.state ?? evState
        le.notes.push({ note: pn.n, spec: pn.spec, staff: s, p: pn.p, x: hx2, y, state })
        le.heads.push({ x: hx2, y, ch: headCh, size: fontSize, color: pn.spec.color, state, letter: pn.n.letter })
        if (pn.acc !== null) {
          const a = accidentalGlyph(pn.acc)
          const ax = headX - (p.dispLeft ? headW - stemT : 0) - 0.22 * sp - a.w * sp - pn.accCol * 1.12 * sp
          le.glyphs.push({ x: ax, y, ch: a.ch, size: fontSize, color: pn.spec.color })
        }
        if (ev.dots) {
          const dx = headX + headW + (p.dispRight ? headW - stemT : 0) + 0.35 * sp
          const dy = pn.p % 2 === 0 ? yOf(s, pn.p + 1) : y
          le.dots.push({ x: dx + 0.2 * sp, y: dy, r: 0.2 * sp })
        }
      }
      // Ledger lines above/below the staff.
      if (!rhythm) {
        const minP = g[0].p
        const maxP = g[g.length - 1].p
        const groupHeads = le.heads.slice(-g.length)
        const left = Math.min(...groupHeads.map((h) => h.x)) - ENGRAVING.ledgerExt * sp
        const right = Math.max(...groupHeads.map((h) => h.x)) + headW + ENGRAVING.ledgerExt * sp
        for (let lp = -2; lp >= minP; lp -= 2) le.lines.push({ x1: left, x2: right, y1: yOf(s, lp), y2: yOf(s, lp), w: ENGRAVING.ledger * sp })
        for (let lp = 10; lp <= maxP; lp += 2) le.lines.push({ x1: left, x2: right, y1: yOf(s, lp), y2: yOf(s, lp), w: ENGRAVING.ledger * sp })
      }
      // Stems (beamed stems are finished later, once the beam line is known).
      if (p.dur !== 'w') {
        const minP = g[0].p
        const maxP = g[g.length - 1].p
        const sx = dir === 'up' ? headX + headW - stemT / 2 : headX + stemT / 2
        const yHead = dir === 'up' ? yOf(s, minP) - 0.168 * sp : yOf(s, maxP) + 0.168 * sp
        const extra = p.dur === '16' ? 0.6 * sp : 0
        let yEnd = dir === 'up' ? yOf(s, maxP) - 3.5 * sp - extra : yOf(s, minP) + 3.5 * sp + extra
        // Notes far outside the staff get stems that reach the middle line.
        if (!rhythm) yEnd = dir === 'up' ? Math.min(yEnd, yOf(s, 4)) : Math.max(yEnd, yOf(s, 4))
        const yFar = dir === 'up' ? yOf(s, maxP) : yOf(s, minP)
        stemInfo.set(le, { staff: s, dir, x: sx, yHead, yFar, minEnd: yEnd, dur: p.dur, group: p.beamGroup })
        if (p.beamGroup === null) {
          le.lines.push({ x1: sx, x2: sx, y1: yHead, y2: yEnd, w: stemT })
          if (p.dur === '8' || p.dur === '16') {
            const up = dir === 'up'
            const ch = p.dur === '8' ? (up ? GLYPH.flag8Up : GLYPH.flag8Down) : up ? GLYPH.flag16Up : GLYPH.flag16Down
            le.glyphs.push({ x: sx - stemT / 2, y: up ? yEnd - 0.04 * sp : yEnd + 0.132 * sp, ch, size: fontSize })
          }
        }
      }
    }
    events.push(le)
    x += p.slot
    eventIndex++
  }
  const contentEnd = x

  // ---- Beams ----
  const beams: Layout['beams'] = []
  const byGroup = new Map<number, LaidEvent[]>()
  for (const [le, info] of stemInfo) if (info.group !== null) (byGroup.get(info.group) ?? byGroup.set(info.group, []).get(info.group)!).push(le)
  for (const [gid, evs] of byGroup) {
    evs.sort((a, b) => a.index - b.index)
    const infos = evs.map((e) => stemInfo.get(e)!)
    const staff = infos[0].staff
    // One direction for the whole group, from the note furthest from the middle line.
    const ps = evs.flatMap((e) => e.notes.filter((n) => n.staff === staff).map((n) => n.p))
    const dir: 'up' | 'down' = rhythm ? 'up' : Math.max(...ps) - 4 > 4 - Math.min(...ps) ? 'down' : 'up'
    const headW = evs[0].headW
    const xs = evs.map((e) => (dir === 'up' ? e.headX + headW - stemT / 2 : e.headX + stemT / 2))
    const heads = evs.map((e) => {
      const ys = e.notes.filter((n) => n.staff === staff).map((n) => n.y)
      return { lo: Math.max(...ys), hi: Math.min(...ys) }
    })
    const natural = heads.map((h) => (dir === 'up' ? h.hi - 3.5 * sp : h.lo + 3.5 * sp))
    const x0 = xs[0]
    const x1 = xs[xs.length - 1]
    let slope = x1 > x0 ? (natural[natural.length - 1] - natural[0]) / (x1 - x0) : 0
    slope = Math.max(-0.2, Math.min(0.2, slope))
    let b = natural[0]
    const minLen = 2.6 * sp + (infos.some((i) => i.dur === '16') ? 0.6 * sp : 0)
    const lineAt = (xx: number) => b + slope * (xx - x0)
    if (dir === 'up') {
      // Beam must sit above every stem's natural end and leave a minimum stem length.
      let shift = 0
      xs.forEach((xx, i) => {
        shift = Math.max(shift, lineAt(xx) - natural[i], lineAt(xx) - (heads[i].hi - minLen))
      })
      b -= shift
    } else {
      let shift = 0
      xs.forEach((xx, i) => {
        shift = Math.max(shift, natural[i] - lineAt(xx), heads[i].lo + minLen - lineAt(xx))
      })
      b += shift
    }
    evs.forEach((e, i) => {
      const yHead = dir === 'up' ? heads[i].lo - 0.168 * sp : heads[i].hi + 0.168 * sp
      e.lines.push({ x1: xs[i], x2: xs[i], y1: yHead, y2: lineAt(xs[i]), w: stemT })
    })
    const th = ENGRAVING.beam * sp
    const sgn = dir === 'up' ? 1 : -1
    const poly = (xa: number, xb: number, off: number) => {
      const ya = lineAt(xa) + sgn * off
      const yb = lineAt(xb) + sgn * off
      return `${xa},${ya} ${xb},${yb} ${xb},${yb + sgn * th} ${xa},${ya + sgn * th}`
    }
    beams.push({ key: `b${gid}`, points: poly(x0 - stemT / 2, x1 + stemT / 2, 0) })
    // Second beam for sixteenths (with short stubs when a 16th sits next to an 8th).
    const off = th + ENGRAVING.beamGap * sp
    infos.forEach((info, i) => {
      if (info.dur !== '16') return
      const next = infos[i + 1]
      const prev = infos[i - 1]
      if (next?.dur === '16') beams.push({ key: `b${gid}-${i}`, points: poly(xs[i] - stemT / 2, xs[i + 1] + stemT / 2, off) })
      else if (prev?.dur !== '16') {
        const stub = 1.1 * sp
        const [xa, xb] = next ? [xs[i], xs[i] + stub] : [xs[i] - stub, xs[i]]
        beams.push({ key: `b${gid}-${i}s`, points: poly(xa, xb, off) })
      }
    })
  }

  // ---- Ties ----
  const ties: Layout['ties'] = []
  const evItems = itemsEvents(items)
  events.forEach((e, i) => {
    if (!evItems[i]?.tie) return
    const next = events[i + 1]
    if (!next) return
    for (const n of e.notes) {
      const m = next.notes.find((k) => midiOf(k.note) === midiOf(n.note))
      if (!m) continue
      const info = stemInfo.get(e)
      const below = info ? info.dir === 'up' : n.p < 4
      const xa = n.x + e.headW + 0.15 * sp
      const xb = m.x - 0.15 * sp
      const y0 = n.y + (below ? 0.45 * sp : -0.45 * sp)
      const h = (below ? 1 : -1) * Math.min(1.4 * sp, 0.35 * sp + (xb - xa) * 0.08)
      const xm = (xa + xb) / 2
      ties.push({ key: `t${i}-${n.p}`, d: `M${xa},${y0} Q${xm},${y0 + h * 1.25} ${xb},${y0} Q${xm},${y0 + h * 0.9} ${xa},${y0} Z` })
    }
  })

  // ---- Text rows: chord symbols, finger numbers, note names ----
  const topStaff = staves[0]
  const botStaff = staves[staves.length - 1]
  const contentTop = (le: LaidEvent) => {
    let y = staffTop[topStaff]
    for (const n of le.notes) if (n.staff === topStaff) y = Math.min(y, n.y - 0.6 * sp)
    for (const l of le.lines) y = Math.min(y, l.y1, l.y2)
    for (const g of le.glyphs) y = Math.min(y, g.y - 1.8 * sp)
    return y
  }
  const contentBottom = (le: LaidEvent) => {
    let y = staffTop[botStaff] + 4 * sp
    for (const n of le.notes) if (n.staff === botStaff) y = Math.max(y, n.y + 0.6 * sp)
    for (const l of le.lines) y = Math.max(y, l.y1, l.y2)
    for (const g of le.glyphs) y = Math.max(y, g.y + 1.0 * sp)
    return y
  }
  const above = Math.min(staffTop[topStaff] - 0.9 * sp, ...events.map(contentTop).map((y) => y - 0.5 * sp))
  const below = Math.max(staffTop[botStaff] + 4.9 * sp, ...events.map(contentBottom).map((y) => y + 0.5 * sp))
  const lh = (size: number) => size * 1.05
  const labelsAbove = o.clef === 'grand'
  let aboveCursor = above
  let belowCursor = below

  const stackFor = (le: LaidEvent, s: StaffId, pick: (n: LaidNote) => string | undefined) =>
    le.notes.filter((n) => n.staff === s && pick(n)).sort((a, b) => b.p - a.p)

  // Fingers: right hand above the top staff; left hand (bass) below the bottom staff.
  if (o.fingers) {
    const fAbove = events.map((le) => stackFor(le, topStaff, (n) => (topStaff === 'treble' && n.spec.finger ? String(n.spec.finger) : undefined)))
    const maxA = Math.max(0, ...fAbove.map((x) => x.length))
    if (maxA) {
      events.forEach((le, i) =>
        fAbove[i].forEach((n, k) =>
          le.texts.push({ x: le.headX + le.headW / 2, y: aboveCursor - (fAbove[i].length - 1 - k) * lh(fingerSize), text: String(n.spec.finger), size: fingerSize, kind: 'finger' }),
        ),
      )
      aboveCursor -= maxA * lh(fingerSize) + 0.3 * sp
    }
    const fBelow = events.map((le) => stackFor(le, botStaff, (n) => (botStaff === 'bass' && n.spec.finger ? String(n.spec.finger) : undefined)))
    const maxB = Math.max(0, ...fBelow.map((x) => x.length))
    if (maxB) {
      events.forEach((le, i) =>
        fBelow[i].forEach((n, k) =>
          le.texts.push({ x: le.headX + le.headW / 2, y: belowCursor + fingerSize * 0.8 + k * lh(fingerSize), text: String(n.spec.finger), size: fingerSize, kind: 'finger' }),
        ),
      )
      belowCursor += maxB * lh(fingerSize) + 0.3 * sp
    }
  }
  if (o.labels) {
    const name = (n: LaidNote) => n.spec.label ?? o.labelFor(n.note)
    if (labelsAbove) {
      const la = events.map((le) => stackFor(le, 'treble', name))
      const maxA = Math.max(0, ...la.map((x) => x.length))
      if (maxA) {
        events.forEach((le, i) =>
          la[i].forEach((n, k) =>
            le.texts.push({ x: le.headX + le.headW / 2, y: aboveCursor - (la[i].length - 1 - k) * lh(labelSize), text: name(n), size: labelSize, kind: 'label', color: n.spec.color }),
          ),
        )
        aboveCursor -= maxA * lh(labelSize) + 0.3 * sp
      }
    }
    const lb = events.map((le) => stackFor(le, labelsAbove ? 'bass' : botStaff, name))
    const maxB = Math.max(0, ...lb.map((x) => x.length))
    if (maxB) {
      events.forEach((le, i) =>
        lb[i].forEach((n, k) =>
          le.texts.push({ x: le.headX + le.headW / 2, y: belowCursor + labelSize * 0.85 + k * lh(labelSize), text: name(n), size: labelSize, kind: 'label', color: n.spec.color }),
        ),
      )
      belowCursor += maxB * lh(labelSize) + 0.3 * sp
    }
  }
  // Event text (e.g. counting) and chord symbols.
  if (evItems.some((e) => e.text)) {
    events.forEach((le, i) => {
      const t = evItems[i]?.text
      if (t) le.texts.push({ x: le.headX + le.headW / 2, y: belowCursor + labelSize * 0.9, text: t, size: labelSize, kind: 'text' })
    })
    belowCursor += lh(labelSize) + 0.3 * sp
  }
  if (evItems.some((e) => e.chord)) {
    events.forEach((le, i) => {
      const c = evItems[i]?.chord
      if (c) {
        const centred = o.spacing === 'even'
        le.texts.push({ x: centred ? le.headX + le.headW / 2 : le.headX, y: aboveCursor - 0.3 * sp, text: c, size: chordSize, kind: 'chord', anchor: centred ? 'middle' : 'start' })
      }
    })
    aboveCursor -= chordSize + 0.4 * sp
  }

  // ---- Staff lines and bar lines ----
  const endX = contentEnd + (o.endBar ? 0.6 * sp : 0)
  const staffLines: Line[] = []
  for (const s of o.lines ? staves : []) {
    if (rhythm) staffLines.push({ x1: startX, x2: endX, y1: yOf(s, 4), y2: yOf(s, 4), w: ENGRAVING.staffLine * sp })
    else for (let i = 0; i < 5; i++) staffLines.push({ x1: startX, x2: endX, y1: staffTop[s] + i * sp, y2: staffTop[s] + i * sp, w: ENGRAVING.staffLine * sp })
  }
  const barTop = rhythm ? yOf(topStaff, 4) - sp : staffTop[topStaff]
  const barBot = rhythm ? yOf(botStaff, 4) + sp : staffTop[botStaff] + 4 * sp
  const bars: Line[] = []
  const thin = ENGRAVING.thinBar * sp
  const thick = ENGRAVING.thickBar * sp
  if (o.clef === 'grand' && o.lines) bars.push({ x1: startX, x2: startX, y1: barTop, y2: barBot, w: thin })
  for (const b of barXs) {
    bars.push({ x1: b.x, x2: b.x, y1: barTop, y2: barBot, w: thin })
    if (b.type === 'double') bars.push({ x1: b.x + 0.5 * sp, x2: b.x + 0.5 * sp, y1: barTop, y2: barBot, w: thin })
    if (b.type === 'final') bars.push({ x1: b.x + 0.55 * sp, x2: b.x + 0.55 * sp, y1: barTop, y2: barBot, w: thick })
  }
  if (o.endBar) {
    bars.push({ x1: endX - thick - 0.45 * sp, x2: endX - thick - 0.45 * sp, y1: barTop, y2: barBot, w: thin })
    bars.push({ x1: endX - thick / 2, x2: endX - thick / 2, y1: barTop, y2: barBot, w: thick })
  }
  if (o.clef === 'grand' && o.lines) header.push({ x: 0, y: barBot, ch: GLYPH.brace, size: barBot - barTop })

  // Vertical extent, with room reserved so the staff doesn't jump around as notes change.
  const minY = Math.min(aboveCursor, staffTop[topStaff] - o.reserveAbove * sp, staffTop[topStaff] - 1.6 * sp)
  const maxY = Math.max(belowCursor, staffTop[botStaff] + 4 * sp + o.reserveBelow * sp, staffTop[botStaff] + 5.8 * sp)
  const pad = 0.4 * sp
  return {
    sp,
    width: endX + 0.4 * sp,
    height: maxY - minY + pad * 2,
    offsetY: -minY + pad,
    staves,
    staffTop,
    staffLines,
    header,
    bars,
    events,
    beams,
    ties,
    contentStart,
    slots: events.length,
    rhythm,
  }
}

function itemsEvents(items: StaffItem[]): StaffEvent[] {
  return items.filter((i): i is StaffEvent => !isBar(i))
}
