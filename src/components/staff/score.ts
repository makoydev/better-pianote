import { KEYSIG_POSITIONS, type Note, keySignature, midiOf, parseNote, stepOf } from '../../lib/theory'
import { ENGRAVING, GLYPH, WIDTH, accidentalGlyph, timeSigDigit, tupletDigit } from './glyphs'
import {
  BEAM_LEVELS,
  type Duration,
  type Glyph,
  type LaidEvent,
  type Layout,
  type Line,
  REST_GLYPH,
  REST_WIDTH,
  STEM_EXTRA,
  type StaffBar,
  type StaffId,
  type Text,
  flagGlyph,
  flagOffset,
} from './layout'

/**
 * Layout for real music in one or two staves. Every voice keeps its own rhythm, and everything that
 * starts at the same moment lines up in one column across both staves (a held bass note under a moving
 * melody, two melodies in one hand …). The song player uses this; lessons use the simpler layoutStaff.
 */

export interface ScoreNote {
  /** Identifies the note for highlighting (the timeline's note id). */
  id: number
  note: Note
  finger?: number
  /** Tied to the same note in this voice's next event. */
  tie: boolean
  /** The second half of a tie: held, not played again. */
  cont: boolean
}

export interface ScoreEvent {
  key: string
  /** When it starts, in quarter-note beats. */
  start: number
  dur: Duration
  dots: number
  tuplet?: { actual: number; normal: number; start?: boolean; end?: boolean }
  /** No notes = a rest. */
  notes: ScoreNote[]
  /** Takes time but draws nothing. */
  hidden?: boolean
}

export interface ScoreVoice {
  staff: StaffId
  events: ScoreEvent[]
}

export interface ScoreBar {
  start: number
  dur: number
  keySig: number
  time: [number, number]
}

export interface ScoreInput {
  staves: StaffId[]
  bars: ScoreBar[]
  voices: ScoreVoice[]
  chords: { start: number; text: string }[]
  /** End with a final bar line (off for an excerpt). */
  final?: boolean
  /** Treat the first bar as a pickup when it's short (its beats are counted from the end). */
  pickup?: boolean
}

export interface ScoreOptions {
  sp: number
  labels: boolean
  fingers: boolean
  labelFor: (n: Note) => string
  /** Text width in px (chord symbols use the display font). */
  measure: (text: string, size: number, display: boolean) => number
  /** Smallest gap between the staves, in staff spaces. */
  gap?: number
  reserveAbove?: number
  reserveBelow?: number
  /** Extra px added to every column (to fill a fixed width). */
  extraPerSlot?: number
}

export interface ScoreLayout extends Layout {
  /** Every moment where something starts: its time in beats and the notehead x there. */
  cols: { t: number; x: number }[]
  /** Chord symbols, tuplet numbers and brackets. */
  extras: { lines: Line[]; glyphs: Glyph[]; texts: Text[] }
}

const EPS = 1e-6
const tk = (t: number) => Math.round(t * 1e6)
const barLength = (time: [number, number]) => (time[0] * 4) / time[1]

/** Beam notes in groups of this many beats: dotted quarters in 6/8, 9/8, 12/8, half notes in x/2. */
function groupLength(time: [number, number]) {
  const [n, d] = time
  if (d === 8 && n % 3 === 0) return 1.5
  if (d === 2) return 2
  return 1
}

interface PNote {
  n: ScoreNote
  p: number
  acc: number | null
  accCol: number
  displaced: boolean
}

interface Info {
  v: number
  ev: ScoreEvent
  staff: StaffId
  bar: number
  col: number
  rest: boolean
  role: 'auto' | 'up' | 'down'
  dir: 'up' | 'down'
  beam: number | null
  tup: number | null
  notes: PNote[]
  dispLeft: boolean
  dispRight: boolean
  accCols: number
  headW: number
  /** Moved right to make room for another voice's notehead in the same column. */
  shift: number
  /** Draws one whole rest centred in the bar. */
  barRest: boolean
  /** Part of a whole-bar rest drawn elsewhere: draws nothing. */
  silent: boolean
}

export function layoutScore(input: ScoreInput, o: ScoreOptions): ScoreLayout {
  const sp = o.sp
  const { staves, bars } = input
  const grand = staves.length > 1
  const stemT = ENGRAVING.stem * sp
  const fontSize = 4 * sp
  const labelSize = Math.max(11, sp * 1.15)
  const fingerSize = Math.max(11, sp * 1.05)
  const chordSize = Math.max(13, sp * 1.45)
  const staffTop: Record<StaffId, number> = { treble: 0, bass: 0 }
  const yRel = (p: number) => ((8 - p) * sp) / 2
  const yOf = (s: StaffId, p: number) => staffTop[s] + yRel(p)
  const pOf = (n: Note, s: StaffId) => stepOf(n) - (s === 'treble' ? 30 : 18)

  const barOf = (t: number) => {
    let lo = 0
    let hi = bars.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (bars[mid].start <= t + EPS) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  // ---- Columns: every moment where something visible starts, plus every bar start ----
  const colMap = new Map<number, number>()
  for (const b of bars) colMap.set(tk(b.start), b.start)
  for (const v of input.voices) for (const e of v.events) if (!e.hidden) colMap.set(tk(e.start), e.start)
  const colT = [...colMap.values()].sort((a, b) => a - b)
  const colOf = new Map(colT.map((t, i) => [tk(t), i]))
  const colBar = colT.map(barOf)

  // ---- One record per visible event ----
  const infos: Info[] = []
  const byVoice: Info[][] = input.voices.map(() => [])
  input.voices.forEach((v, vi) => {
    for (const ev of v.events) {
      if (ev.hidden) continue
      const inf: Info = {
        v: vi,
        ev,
        staff: v.staff,
        bar: barOf(ev.start),
        col: colOf.get(tk(ev.start))!,
        rest: ev.notes.length === 0,
        role: 'auto',
        dir: 'up',
        beam: null,
        tup: null,
        notes: ev.notes.map((n) => ({ n, p: pOf(n.note, v.staff), acc: null, accCol: 0, displaced: false })),
        dispLeft: false,
        dispRight: false,
        accCols: 0,
        headW: (ev.dur === 'w' ? WIDTH.whole : WIDTH.black) * sp,
        shift: 0,
        barRest: false,
        silent: false,
      }
      infos.push(inf)
      byVoice[vi].push(inf)
    }
  })

  // ---- Voice roles: when two voices share a staff in a bar, the higher one gets stems up ----
  const voiceAvg = input.voices.map((v) => {
    const ms = v.events.flatMap((e) => e.notes.map((n) => midiOf(n.note)))
    return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 60
  })
  const present = new Map<string, Map<number, number[]>>()
  for (const inf of infos) {
    const k = `${inf.staff}|${inf.bar}`
    const m = present.get(k) ?? present.set(k, new Map()).get(k)!
    const mids = m.get(inf.v) ?? m.set(inf.v, []).get(inf.v)!
    for (const pn of inf.notes) mids.push(midiOf(pn.n.note))
  }
  const roles = new Map<string, Info['role']>()
  for (const [k, m] of present) {
    const bar = k.split('|')[1]
    if (m.size < 2) {
      for (const v of m.keys()) roles.set(`${v}|${bar}`, 'auto')
      continue
    }
    const order = [...m.entries()]
      .map(([v, mids]) => [v, mids.length ? mids.reduce((a, b) => a + b, 0) / mids.length : voiceAvg[v]] as const)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    order.forEach(([v], i) => roles.set(`${v}|${bar}`, i === 0 ? 'up' : 'down'))
  }
  for (const inf of infos) inf.role = roles.get(`${inf.v}|${inf.bar}`) ?? 'auto'

  // ---- Whole-bar rests: a voice that only rests for a whole bar shows one whole rest, centred ----
  input.voices.forEach((v, vi) => {
    const perBar = new Map<number, ScoreEvent[]>()
    for (const e of v.events) {
      const b = barOf(e.start)
      ;(perBar.get(b) ?? perBar.set(b, []).get(b)!).push(e)
    }
    for (const [b, evs] of perBar) {
      if (!evs.every((e) => e.notes.length === 0 && !e.hidden)) continue
      const total = evs.reduce((s, e) => s + eventLength(e), 0)
      if (Math.abs(total - bars[b].dur) > EPS) continue
      const mine = byVoice[vi].filter((x) => x.bar === b)
      mine.forEach((x, i) => (i === 0 ? (x.barRest = true) : (x.silent = true)))
    }
  })

  // ---- Tuplet groups and beam groups, per voice ----
  let tupId = 0
  let beamId = 0
  input.voices.forEach((v, vi) => {
    const infoOf = new Map(byVoice[vi].map((x) => [x.ev, x]))
    let openTup: { id: number; ratio: string; bar: number } | null = null
    let lastKey: string | null = null
    for (const e of v.events) {
      const inf = infoOf.get(e)
      // Tuplets
      if (e.tuplet && inf) {
        const ratio = `${e.tuplet.actual}:${e.tuplet.normal}`
        if (!openTup || e.tuplet.start || openTup.ratio !== ratio || openTup.bar !== inf.bar) openTup = { id: ++tupId, ratio, bar: inf.bar }
        inf.tup = openTup.id
        if (e.tuplet.end) openTup = null
      } else openTup = null
      // Beams: eighths and shorter, inside one beat group (and one tuplet group)
      if (!inf || inf.rest || BEAM_LEVELS[e.dur] === 0) {
        lastKey = null
        continue
      }
      const bar = bars[inf.bar]
      const full = barLength(bar.time)
      const phase = inf.bar === 0 && input.pickup && bar.dur < full - EPS ? full - bar.dur : 0
      const beat = Math.floor((e.start - bar.start + phase) / groupLength(bar.time) + EPS)
      const key = `${inf.bar}:${beat}:${inf.tup ?? '-'}:${inf.role}`
      if (key !== lastKey || (e.tuplet?.start && lastKey !== null)) beamId++
      lastKey = key
      inf.beam = beamId
    }
  })
  const beamSize = new Map<number, number>()
  for (const inf of infos) if (inf.beam !== null) beamSize.set(inf.beam, (beamSize.get(inf.beam) ?? 0) + 1)
  for (const inf of infos) if (inf.beam !== null && beamSize.get(inf.beam)! < 2) inf.beam = null

  // ---- Stem directions: forced by the voice's role, else away from the middle line ----
  const autoDir = (ps: number[]): 'up' | 'down' => {
    const lo = Math.min(...ps)
    const hi = Math.max(...ps)
    return hi - 4 > 4 - lo || (hi - 4 === 4 - lo && hi >= 4) ? 'down' : 'up'
  }
  const beamMembers = new Map<number, Info[]>()
  for (const inf of infos) if (inf.beam !== null) (beamMembers.get(inf.beam) ?? beamMembers.set(inf.beam, []).get(inf.beam)!).push(inf)
  for (const inf of infos) {
    if (inf.rest) continue
    if (inf.role !== 'auto') inf.dir = inf.role
    else if (inf.beam !== null) inf.dir = autoDir(beamMembers.get(inf.beam)!.flatMap((x) => x.notes.map((n) => n.p)))
    else inf.dir = autoDir(inf.notes.map((n) => n.p))
  }

  // ---- Accidentals: per staff and bar, in time order; key signature can change per bar ----
  const sorted = [...infos].sort((a, b) => a.col - b.col || a.v - b.v)
  const measureAcc = new Map<string, number>()
  let accBar = -1
  for (const inf of sorted) {
    if (inf.bar !== accBar) {
      measureAcc.clear()
      accBar = inf.bar
    }
    const sig = keySignature(bars[inf.bar].keySig)
    for (const pn of inf.notes) {
      const k = `${inf.staff}${pn.n.note.letter}:${pn.n.note.oct}`
      const keyAcc = sig.letters.some((l) => 'CDEFGAB'.indexOf(l) === pn.n.note.letter) ? sig.acc : 0
      const current = measureAcc.has(k) ? measureAcc.get(k)! : keyAcc
      // A tied note carries its accidental over without showing it again (and doesn't set one for the bar).
      if (pn.n.cont) continue
      if (pn.n.note.acc !== current) pn.acc = pn.n.note.acc
      measureAcc.set(k, pn.n.note.acc)
    }
  }

  // ---- Seconds inside a chord sit on opposite sides of the stem; accidentals stack in columns ----
  for (const inf of infos) {
    if (inf.rest) continue
    const g = [...inf.notes].sort((a, b) => a.p - b.p)
    if (inf.dir === 'up' || inf.ev.dur === 'w') {
      for (let i = 1; i < g.length; i++) if (g[i].p - g[i - 1].p === 1 && !g[i - 1].displaced) g[i].displaced = true
      inf.dispRight = g.some((x) => x.displaced)
    } else {
      for (let i = g.length - 2; i >= 0; i--) if (g[i + 1].p - g[i].p === 1 && !g[i + 1].displaced) g[i].displaced = true
      inf.dispLeft = g.some((x) => x.displaced)
    }
    const withAcc = g.filter((x) => x.acc !== null).sort((a, b) => b.p - a.p)
    const cols: number[][] = []
    for (const x of withAcc) {
      let c = 0
      while (cols[c]?.some((p) => Math.abs(p - x.p) < 6)) c++
      ;(cols[c] ??= []).push(x.p)
      x.accCol = c
    }
    inf.accCols = cols.length
  }

  // ---- Two voices in one column: the upper voice moves right when the notes are a second apart or cross ----
  const atCol = new Map<string, Info[]>()
  for (const inf of infos) {
    if (inf.rest) continue
    const k = `${inf.col}|${inf.staff}`
    ;(atCol.get(k) ?? atCol.set(k, []).get(k)!).push(inf)
  }
  for (const group of atCol.values()) {
    const up = group.filter((x) => x.role === 'up')
    const down = group.filter((x) => x.role === 'down')
    if (!up.length || !down.length) continue
    const upLow = Math.min(...up.flatMap((x) => x.notes.map((n) => n.p)))
    const downHigh = Math.max(...down.flatMap((x) => x.notes.map((n) => n.p)))
    const sameHeads = up.every((x) => x.ev.dur === down[0].ev.dur && x.ev.dots === down[0].ev.dots)
    const unisonOnly = upLow === downHigh && sameHeads && up.length === 1 && up[0].notes.length === 1 && down[0].notes.length === 1
    if (upLow - downHigh <= 1 && !unisonOnly) for (const x of up) x.shift = Math.max(...down.map((d) => d.headW)) - stemT * 0.5
  }

  // ---- Column widths ----
  const leftExt = colT.map(() => 0)
  const rightExt = colT.map(() => 0)
  const textW = colT.map(() => 0)
  const dotsW = (dots: number) => (dots ? (0.75 + (dots - 1) * 0.5) * sp : 0)
  for (const inf of infos) {
    const c = inf.col
    if (inf.rest) {
      if (inf.barRest || inf.silent) continue
      rightExt[c] = Math.max(rightExt[c], REST_WIDTH[inf.ev.dur] * sp + dotsW(inf.ev.dots))
      continue
    }
    const l = (inf.dispLeft ? inf.headW - stemT : 0) + (inf.accCols ? inf.accCols * 1.12 * sp + 0.25 * sp : 0)
    const r = inf.shift + inf.headW + (inf.dispRight ? inf.headW - stemT : 0) + dotsW(inf.ev.dots)
    leftExt[c] = Math.max(leftExt[c], l)
    rightExt[c] = Math.max(rightExt[c], r)
    if (o.labels) for (const pn of inf.notes) textW[c] = Math.max(textW[c], o.measure(o.labelFor(pn.n.note), labelSize, false))
  }
  const chordAt = new Map<number, string>()
  for (const ch of input.chords) {
    // Chords land on the column where they start (or the last one before, if nothing starts there).
    let c = colOf.get(tk(ch.start))
    if (c === undefined) {
      c = 0
      while (c + 1 < colT.length && colT[c + 1] <= ch.start + EPS) c++
    }
    if (!chordAt.has(c)) chordAt.set(c, ch.text)
  }
  for (const [c, text] of chordAt) textW[c] = Math.max(textW[c], o.measure(text, chordSize, true) + leftExt[c] - 0.2 * sp)
  const slot = colT.map((t, c) => {
    const next = c + 1 < colT.length && colBar[c + 1] === colBar[c] ? colT[c + 1] : bars[colBar[c]].start + bars[colBar[c]].dur
    const dt = Math.max(0.0625, next - t)
    const natural = Math.max(leftExt[c] + rightExt[c] + 1.4 * sp, textW[c] + 0.8 * sp)
    return Math.max(natural, (2.1 + 2.6 * Math.pow(dt, 0.7)) * sp) + (o.extraPerSlot ?? 0)
  })

  // ---- The gap between the staves fits what hangs below the treble and sticks up from the bass ----
  if (grand) {
    let trebleLow = 4 * sp
    let bassHigh = 0
    for (const inf of infos) {
      const ps = inf.notes.map((n) => n.p)
      const stem = (3.5 + STEM_EXTRA[inf.ev.dur] + 0.8) * sp
      if (inf.staff === 'treble') {
        if (inf.rest) {
          if (inf.role === 'down') trebleLow = Math.max(trebleLow, yRel(0) + 1.6 * sp)
          continue
        }
        trebleLow = Math.max(trebleLow, yRel(Math.min(...ps)) + (inf.notes.some((n) => n.acc !== null) ? 1.3 : 0.7) * sp)
        if (inf.dir === 'down' && inf.ev.dur !== 'w') trebleLow = Math.max(trebleLow, yRel(Math.min(...ps)) + stem)
      } else {
        if (inf.rest) {
          if (inf.role === 'up') bassHigh = Math.min(bassHigh, yRel(8) - 1.6 * sp)
          continue
        }
        bassHigh = Math.min(bassHigh, yRel(Math.max(...ps)) - (inf.notes.some((n) => n.acc !== null) ? 1.6 : 0.8) * sp)
        if (inf.dir === 'up' && inf.ev.dur !== 'w') bassHigh = Math.min(bassHigh, yRel(Math.max(...ps)) - stem)
      }
    }
    staffTop.bass = Math.max((4 + (o.gap ?? 4.5)) * sp, trebleLow + 0.9 * sp - bassHigh)
  }

  // ---- Header: brace, clefs, key signature, time signature ----
  const header: Glyph[] = []
  const startX = grand ? 1.4 * sp : 0.2 * sp
  let hx = startX + 0.5 * sp
  for (const s of staves) header.push({ x: hx, y: yOf(s, s === 'treble' ? 2 : 6), ch: s === 'treble' ? GLYPH.gClef : GLYPH.fClef, size: fontSize })
  hx += WIDTH.fClef * sp + 0.9 * sp
  const first = bars[0] ?? { keySig: 0, time: [4, 4] as [number, number] }
  hx = drawSignature(header, null, first.keySig, first.time, hx)
  const contentStart = hx + 0.7 * sp

  /** Key signature (with naturals cancelling the old one) and time signature at x; returns the x after them. */
  function drawSignature(out: Glyph[], prevKey: number | null, key: number, time: [number, number] | null, x: number) {
    const sig = keySignature(key)
    if (prevKey !== null && prevKey !== key) {
      const old = keySignature(prevKey)
      const gone = old.letters.filter((l) => !(sig.acc === old.acc && sig.letters.includes(l)))
      if (gone.length) {
        for (const s of staves) {
          const positions = KEYSIG_POSITIONS[s][old.acc > 0 ? 'sharp' : 'flat']
          gone.forEach((l, i) => {
            const at = old.letters.indexOf(l)
            out.push({ x: x + i * 0.95 * sp, y: yOf(s, pOf(parseNote(positions[at]), s)), ch: GLYPH.natural, size: fontSize })
          })
        }
        x += gone.length * 0.95 * sp + 0.4 * sp
      }
    }
    if (sig.letters.length && (prevKey === null || prevKey !== key)) {
      for (const s of staves) {
        const positions = KEYSIG_POSITIONS[s][sig.acc > 0 ? 'sharp' : 'flat']
        sig.letters.forEach((_, i) => {
          out.push({ x: x + i * 1.05 * sp, y: yOf(s, pOf(parseNote(positions[i]), s)), ch: sig.acc > 0 ? GLYPH.sharp : GLYPH.flat, size: fontSize })
        })
      }
      x += sig.letters.length * 1.05 * sp + 0.6 * sp
    }
    if (time) {
      const dw = WIDTH.timeSig * sp * 0.9
      const [num, den] = time.map(String)
      const w = Math.max(num.length, den.length) * dw
      for (const s of staves) {
        const draw = (str: string, p: number) => {
          const sx = x + (w - str.length * dw) / 2
          ;[...str].forEach((d, i) => out.push({ x: sx + i * dw, y: yOf(s, p), ch: timeSigDigit(Number(d)), size: fontSize }))
        }
        draw(num, 6)
        draw(den, 2)
      }
      x += w + 0.8 * sp
    }
    return x
  }

  // ---- x positions, bar lines and mid-piece key/time changes ----
  const colX: number[] = []
  const colHead: number[] = []
  const barXs: { x: number; type: StaffBar['bar'] }[] = []
  const barStartX: number[] = []
  const barEndX: number[] = []
  const changeGlyphs: Glyph[] = []
  let x = contentStart
  let curBar = 0
  barStartX[0] = x
  for (let c = 0; c < colT.length; c++) {
    const b = colBar[c]
    if (b !== curBar) {
      const prev = bars[b - 1]
      const cur = bars[b]
      const keyChange = cur.keySig !== prev.keySig
      const timeChange = cur.time[0] !== prev.time[0] || cur.time[1] !== prev.time[1]
      barEndX[curBar] = x
      barXs.push({ x: x + 0.1 * sp, type: keyChange ? 'double' : 'single' })
      x += 1.3 * sp
      if (keyChange || timeChange) x = drawSignature(changeGlyphs, keyChange ? prev.keySig : cur.keySig, cur.keySig, timeChange ? cur.time : null, x + 0.3 * sp) + 0.4 * sp
      barStartX[b] = x
      curBar = b
    }
    colX[c] = x
    colHead[c] = x + leftExt[c]
    x += slot[c]
  }
  barEndX[curBar] = x
  const lastBarType: StaffBar['bar'] = input.final === false ? 'single' : 'final'
  barXs.push({ x: x + 0.1 * sp, type: lastBarType })
  const endX = lastBarType === 'final' ? x + 0.1 * sp + 0.55 * sp + (ENGRAVING.thickBar * sp) / 2 : x + 0.1 * sp + (ENGRAVING.thinBar * sp) / 2

  // ---- Draw every event ----
  const events: LaidEvent[] = []
  const laidOf = new Map<ScoreEvent, LaidEvent>()
  const stemInfo = new Map<LaidEvent, { inf: Info; x: number; yHead: number; minEnd: number }>()
  for (const inf of infos) {
    const c = inf.col
    const s = inf.staff
    const ev = inf.ev
    const headX = colHead[c] + inf.shift
    const le: LaidEvent = {
      key: ev.key,
      index: events.length,
      start: ev.start,
      x: colX[c],
      headX,
      headW: inf.headW,
      width: slot[c],
      state: 'normal',
      rest: inf.rest,
      notes: [],
      heads: [],
      glyphs: [],
      lines: [],
      dots: [],
      texts: [],
    }
    events.push(le)
    laidOf.set(ev, le)
    if (inf.rest) {
      if (inf.silent) continue
      const off = inf.role === 'up' ? 4 : inf.role === 'down' ? -4 : 0
      if (inf.barRest) {
        const w = WIDTH.restWhole * sp
        const cx = (barStartX[inf.bar] + barEndX[inf.bar]) / 2 - w / 2
        le.headX = cx
        le.glyphs.push({ x: cx, y: yOf(s, 6 + off), ch: GLYPH.restWhole, size: fontSize })
        continue
      }
      const ry = ev.dur === 'w' ? yOf(s, 6 + off) : yOf(s, 4 + off)
      le.glyphs.push({ x: headX, y: ry, ch: REST_GLYPH[ev.dur], size: fontSize })
      for (let k = 0; k < ev.dots; k++) le.dots.push({ x: headX + REST_WIDTH[ev.dur] * sp + 0.35 * sp + k * 0.5 * sp, y: yOf(s, 5 + off), r: 0.2 * sp })
      continue
    }
    const g = [...inf.notes].sort((a, b) => a.p - b.p)
    const dir = inf.dir
    const headCh = ev.dur === 'w' ? GLYPH.whole : ev.dur === 'h' ? GLYPH.half : GLYPH.black
    for (const pn of g) {
      let nx = headX
      if (pn.displaced) nx = dir === 'up' || ev.dur === 'w' ? headX + inf.headW - stemT : headX - inf.headW + stemT
      const y = yOf(s, pn.p)
      le.notes.push({ note: pn.n.note, spec: { note: pn.n.note, finger: pn.n.finger, id: pn.n.id }, staff: s, p: pn.p, x: nx, y, state: 'normal' })
      le.heads.push({ x: nx, y, ch: headCh, size: fontSize, state: 'normal', letter: pn.n.note.letter })
      if (pn.acc !== null) {
        const a = accidentalGlyph(pn.acc)
        const ax = headX - (inf.dispLeft ? inf.headW - stemT : 0) - 0.22 * sp - a.w * sp - pn.accCol * 1.12 * sp
        le.glyphs.push({ x: ax, y, ch: a.ch, size: fontSize })
      }
      if (ev.dots) {
        // Dots sit in a space: notes on a line move their dot up (or down, in a lower voice).
        const dy = pn.p % 2 === 0 ? yOf(s, pn.p + (inf.role === 'down' ? -1 : 1)) : y
        const dx = headX + inf.headW + (inf.dispRight ? inf.headW - stemT : 0) + 0.55 * sp
        for (let k = 0; k < ev.dots; k++) le.dots.push({ x: dx + k * 0.5 * sp, y: dy, r: 0.2 * sp })
      }
    }
    // Ledger lines
    const minP = g[0].p
    const maxP = g[g.length - 1].p
    const left = Math.min(...le.heads.map((h) => h.x)) - ENGRAVING.ledgerExt * sp
    const right = Math.max(...le.heads.map((h) => h.x)) + inf.headW + ENGRAVING.ledgerExt * sp
    for (let lp = -2; lp >= minP; lp -= 2) le.lines.push({ x1: left, x2: right, y1: yOf(s, lp), y2: yOf(s, lp), w: ENGRAVING.ledger * sp })
    for (let lp = 10; lp <= maxP; lp += 2) le.lines.push({ x1: left, x2: right, y1: yOf(s, lp), y2: yOf(s, lp), w: ENGRAVING.ledger * sp })
    // Stems (beamed ones are finished once the beam is placed)
    if (ev.dur !== 'w') {
      const sx = dir === 'up' ? headX + inf.headW - stemT / 2 : headX + stemT / 2
      const yHead = dir === 'up' ? yOf(s, minP) - 0.168 * sp : yOf(s, maxP) + 0.168 * sp
      const extra = STEM_EXTRA[ev.dur] * sp
      let yEnd = dir === 'up' ? yOf(s, maxP) - 3.5 * sp - extra : yOf(s, minP) + 3.5 * sp + extra
      // Notes far outside the staff reach the middle line (unless another voice is there).
      if (inf.role === 'auto') yEnd = dir === 'up' ? Math.min(yEnd, yOf(s, 4)) : Math.max(yEnd, yOf(s, 4))
      stemInfo.set(le, { inf, x: sx, yHead, minEnd: yEnd })
      if (inf.beam === null) {
        le.lines.push({ x1: sx, x2: sx, y1: yHead, y2: yEnd, w: stemT })
        const up = dir === 'up'
        const ch = flagGlyph(ev.dur, up)
        const back = flagOffset(ev.dur, up) * sp
        if (ch) le.glyphs.push({ x: sx - stemT / 2, y: up ? yEnd - 0.04 * sp + back : yEnd + 0.132 * sp - back, ch, size: fontSize })
      }
    }
  }

  // ---- Beams ----
  const beams: Layout['beams'] = []
  const groups = new Map<number, LaidEvent[]>()
  for (const [le, info] of stemInfo) if (info.inf.beam !== null) (groups.get(info.inf.beam) ?? groups.set(info.inf.beam, []).get(info.inf.beam)!).push(le)
  for (const [gid, evs] of groups) {
    evs.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
    const infos2 = evs.map((e) => stemInfo.get(e)!)
    const dir = infos2[0].inf.dir
    const xs = infos2.map((i) => i.x)
    const heads = evs.map((e) => {
      const ys = e.notes.map((n) => n.y)
      return { lo: Math.max(...ys), hi: Math.min(...ys) }
    })
    const natural = heads.map((h) => (dir === 'up' ? h.hi - 3.5 * sp : h.lo + 3.5 * sp))
    const x0 = xs[0]
    const x1 = xs[xs.length - 1]
    let slope = x1 > x0 ? (natural[natural.length - 1] - natural[0]) / (x1 - x0) : 0
    slope = Math.max(-0.2, Math.min(0.2, slope))
    let b = natural[0]
    const minLen = 2.6 * sp + Math.max(...infos2.map((i) => STEM_EXTRA[i.inf.ev.dur])) * sp
    const lineAt = (xx: number) => b + slope * (xx - x0)
    let shift = 0
    xs.forEach((xx, i) => {
      if (dir === 'up') shift = Math.max(shift, lineAt(xx) - natural[i], lineAt(xx) - (heads[i].hi - minLen))
      else shift = Math.max(shift, natural[i] - lineAt(xx), heads[i].lo + minLen - lineAt(xx))
    })
    b += dir === 'up' ? -shift : shift
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
    beams.push({ key: `b${gid}`, points: poly(x0 - stemT / 2, x1 + stemT / 2, 0), x0, x1 })
    const levels = infos2.map((i) => BEAM_LEVELS[i.inf.ev.dur])
    for (let lv = 2; lv <= Math.max(...levels); lv++) {
      const off = (lv - 1) * (th + ENGRAVING.beamGap * sp)
      levels.forEach((l, i) => {
        if (l < lv) return
        if ((levels[i + 1] ?? 0) >= lv) beams.push({ key: `b${gid}-${lv}-${i}`, points: poly(xs[i] - stemT / 2, xs[i + 1] + stemT / 2, off), x0: xs[i], x1: xs[i + 1] })
        else if ((levels[i - 1] ?? 0) < lv) {
          const stub = 1.1 * sp
          const [xa, xb] = i < levels.length - 1 ? [xs[i], xs[i] + stub] : [xs[i] - stub, xs[i]]
          beams.push({ key: `b${gid}-${lv}-${i}s`, points: poly(xa, xb, off), x0: xa, x1: xb })
        }
      })
    }
  }

  // ---- Ties: to the same note in the voice's next event ----
  const ties: Layout['ties'] = []
  const infoOfEv = new Map(infos.map((i) => [i.ev, i]))
  input.voices.forEach((v) => {
    v.events.forEach((ev, i) => {
      const next = v.events[i + 1]
      const a = laidOf.get(ev)
      const bLaid = next && laidOf.get(next)
      if (!a || !bLaid) return
      const inf = infoOfEv.get(ev)
      const tied = ev.notes.filter((n) => n.tie)
      tied.forEach((n) => {
        const na = a.notes.find((m) => m.spec.id === n.id)
        const nb = bLaid.notes.find((m) => midiOf(m.note) === midiOf(n.note))
        if (!na || !nb) return
        const chordIdx = [...a.notes].sort((p, q) => q.p - p.p).findIndex((m) => m === na)
        const role = inf?.role ?? 'auto'
        const above =
          role === 'up' ? true : role === 'down' ? false : a.notes.length > 1 ? chordIdx < a.notes.length / 2 : (inf?.dir ?? 'up') === 'down'
        const xa = na.x + a.headW + 0.15 * sp
        const xb = nb.x - 0.15 * sp
        const y0 = na.y + (above ? -0.45 * sp : 0.45 * sp)
        const h = (above ? -1 : 1) * Math.min(1.4 * sp, 0.35 * sp + (xb - xa) * 0.08)
        const xm = (xa + xb) / 2
        ties.push({ key: `t${a.key}-${n.id}`, d: `M${xa},${y0} Q${xm},${y0 + h * 1.25} ${xb},${y0} Q${xm},${y0 + h * 0.9} ${xa},${y0} Z`, x0: xa, x1: xb })
      })
    })
  })

  // ---- Tuplet numbers (and brackets when the group isn't one beam) ----
  const extras: ScoreLayout['extras'] = { lines: [], glyphs: [], texts: [] }
  const tupGroups = new Map<number, Info[]>()
  for (const inf of infos) if (inf.tup !== null) (tupGroups.get(inf.tup) ?? tupGroups.set(inf.tup, []).get(inf.tup)!).push(inf)
  for (const members of tupGroups.values()) {
    members.sort((a, b) => a.ev.start - b.ev.start)
    const lead = members.find((m) => !m.rest) ?? members[0]
    const above = lead.rest ? lead.role !== 'down' : lead.dir === 'up'
    const laid = members.map((m) => laidOf.get(m.ev)!)
    const beamed = members.every((m) => m.beam !== null && m.beam === members[0].beam)
    const xa = Math.min(...laid.map((l) => l.headX)) - 0.2 * sp
    const xb = Math.max(...laid.map((l) => l.headX + l.headW)) + 0.2 * sp
    let edge = above ? Infinity : -Infinity
    for (const l of laid) {
      const ys = [...l.lines.map((ln) => [ln.y1, ln.y2]).flat(), ...l.heads.map((h) => h.y + (above ? -0.6 : 0.6) * sp), ...l.glyphs.map((gl) => gl.y + (above ? -1.6 : 1.2) * sp)]
      for (const y of ys) edge = above ? Math.min(edge, y) : Math.max(edge, y)
    }
    const digits = String(lead.ev.tuplet?.actual ?? 3)
    const dw = 1.2 * sp
    const xm = (xa + xb) / 2
    const baseline = above ? edge - 0.5 * sp : edge + 1.9 * sp
    ;[...digits].forEach((d, i) => extras.glyphs.push({ x: xm - (digits.length * dw) / 2 + i * dw, y: baseline, ch: tupletDigit(Number(d)), size: fontSize }))
    if (!beamed) {
      const ym = baseline - 0.75 * sp
      const hook = (above ? 1 : -1) * 0.6 * sp
      const gap = (digits.length * dw) / 2 + 0.3 * sp
      const w = ENGRAVING.thinBar * sp
      extras.lines.push({ x1: xa, x2: xm - gap, y1: ym, y2: ym, w })
      extras.lines.push({ x1: xm + gap, x2: xb, y1: ym, y2: ym, w })
      extras.lines.push({ x1: xa, x2: xa, y1: ym, y2: ym + hook, w })
      extras.lines.push({ x1: xb, x2: xb, y1: ym, y2: ym + hook, w })
    }
  }

  // ---- Text rows: chord symbols, finger numbers, note names ----
  const topStaff = staves[0]
  const botStaff = staves[staves.length - 1]
  let above = staffTop[topStaff] - 0.9 * sp
  let below = staffTop[botStaff] + 4.9 * sp
  const extentOf = (ys: number[]) => {
    for (const y of ys) {
      above = Math.min(above, y - 0.5 * sp)
      below = Math.max(below, y + 0.5 * sp)
    }
  }
  for (const le of events) {
    extentOf(le.notes.flatMap((n) => [n.y - 0.1 * sp, n.y + 0.1 * sp]))
    extentOf(le.lines.flatMap((l) => [l.y1, l.y2]))
    extentOf(le.glyphs.flatMap((g) => [g.y - 1.8 * sp, g.y + 1.0 * sp]))
  }
  extentOf(extras.glyphs.flatMap((g) => [g.y - 1.6 * sp, g.y + 0.2 * sp]))
  for (const b of beams) for (const pt of b.points.split(' ')) extentOf([Number(pt.split(',')[1])])
  // Only the outer staves' content pushes the rows out.
  above = Math.min(above, staffTop[topStaff] - 0.9 * sp)
  below = Math.max(below, staffTop[botStaff] + 4.9 * sp)
  const lh = (size: number) => size * 1.05

  const stacks = (pick: (inf: Info, pn: PNote) => string | undefined, staff: StaffId) => {
    // Per column, the notes on one staff that get a text, top note first.
    const m = new Map<number, { le: LaidEvent; n: PNote; text: string }[]>()
    for (const inf of infos) {
      if (inf.staff !== staff || inf.rest) continue
      for (const pn of inf.notes) {
        const text = pick(inf, pn)
        if (!text) continue
        ;(m.get(inf.col) ?? m.set(inf.col, []).get(inf.col)!).push({ le: laidOf.get(inf.ev)!, n: pn, text })
      }
    }
    for (const list of m.values()) list.sort((a, b) => b.n.p - a.n.p)
    return m
  }
  const centreOf = (inf: { le: LaidEvent }) => inf.le.headX + inf.le.headW / 2
  if (o.fingers) {
    const top = stacks((_, pn) => (pn.n.finger ? String(pn.n.finger) : undefined), topStaff)
    const maxA = Math.max(0, ...[...top.values()].map((l) => l.length))
    for (const list of top.values()) list.forEach((it, k) => it.le.texts.push({ x: centreOf(it), y: above - (list.length - 1 - k) * lh(fingerSize), text: it.text, size: fingerSize, kind: 'finger' }))
    if (maxA) above -= maxA * lh(fingerSize) + 0.3 * sp
    if (grand) {
      const bot = stacks((_, pn) => (pn.n.finger ? String(pn.n.finger) : undefined), botStaff)
      const maxB = Math.max(0, ...[...bot.values()].map((l) => l.length))
      for (const list of bot.values()) list.forEach((it, k) => it.le.texts.push({ x: centreOf(it), y: below + fingerSize * 0.8 + k * lh(fingerSize), text: it.text, size: fingerSize, kind: 'finger' }))
      if (maxB) below += maxB * lh(fingerSize) + 0.3 * sp
    }
  }
  if (o.labels) {
    const name = (_: Info, pn: PNote) => o.labelFor(pn.n.note)
    if (grand) {
      const top = stacks(name, 'treble')
      const maxA = Math.max(0, ...[...top.values()].map((l) => l.length))
      for (const list of top.values()) list.forEach((it, k) => it.le.texts.push({ x: centreOf(it), y: above - (list.length - 1 - k) * lh(labelSize), text: it.text, size: labelSize, kind: 'label' }))
      if (maxA) above -= maxA * lh(labelSize) + 0.3 * sp
    }
    const bot = stacks(name, botStaff)
    const maxB = Math.max(0, ...[...bot.values()].map((l) => l.length))
    for (const list of bot.values()) list.forEach((it, k) => it.le.texts.push({ x: centreOf(it), y: below + labelSize * 0.85 + k * lh(labelSize), text: it.text, size: labelSize, kind: 'label' }))
    if (maxB) below += maxB * lh(labelSize) + 0.3 * sp
  }
  if (chordAt.size) {
    for (const [c, text] of chordAt) extras.texts.push({ x: colHead[c], y: above - 0.3 * sp, text, size: chordSize, kind: 'chord', anchor: 'start' })
    above -= chordSize + 0.4 * sp
  }

  // ---- Staff lines and bar lines ----
  const staffLines: Line[] = []
  for (const s of staves) for (let i = 0; i < 5; i++) staffLines.push({ x1: startX, x2: endX, y1: staffTop[s] + i * sp, y2: staffTop[s] + i * sp, w: ENGRAVING.staffLine * sp })
  const barTop = staffTop[topStaff]
  const barBot = staffTop[botStaff] + 4 * sp
  const barLines: Line[] = []
  const thin = ENGRAVING.thinBar * sp
  const thick = ENGRAVING.thickBar * sp
  if (grand) barLines.push({ x1: startX, x2: startX, y1: barTop, y2: barBot, w: thin })
  for (const b of barXs) {
    barLines.push({ x1: b.x, x2: b.x, y1: barTop, y2: barBot, w: thin })
    if (b.type === 'double') barLines.push({ x1: b.x + 0.5 * sp, x2: b.x + 0.5 * sp, y1: barTop, y2: barBot, w: thin })
    if (b.type === 'final') barLines.push({ x1: b.x + 0.55 * sp, x2: b.x + 0.55 * sp, y1: barTop, y2: barBot, w: thick })
  }
  if (grand) header.push({ x: 0, y: barBot, ch: GLYPH.brace, size: barBot - barTop })
  header.push(...changeGlyphs)

  const minY = Math.min(above, staffTop[topStaff] - (o.reserveAbove ?? 2.5) * sp, staffTop[topStaff] - 1.6 * sp)
  const maxY = Math.max(below, staffTop[botStaff] + 4 * sp + (o.reserveBelow ?? 2.5) * sp, staffTop[botStaff] + 5.8 * sp)
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
    bars: barLines,
    events,
    beams,
    ties,
    contentStart,
    slots: colT.length,
    rhythm: false,
    cols: colT.map((t, c) => ({ t, x: colHead[c] })),
    extras,
  }
}

/** How long a score event lasts in beats (dots and tuplets included). */
export function eventLength(e: Pick<ScoreEvent, 'dur' | 'dots' | 'tuplet'>) {
  const base = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125, '64': 0.0625 }[e.dur]
  return base * (2 - 0.5 ** e.dots) * (e.tuplet ? e.tuplet.normal / e.tuplet.actual : 1)
}

/** The notehead x of the column at (or just before) moment t. */
export function colX(layout: ScoreLayout, t: number): number {
  const cols = layout.cols
  if (!cols.length) return 0
  let lo = 0
  let hi = cols.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cols[mid].t <= t + EPS) lo = mid
    else hi = mid - 1
  }
  return cols[lo].x
}
