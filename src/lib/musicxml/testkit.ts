/**
 * Builders for small MusicXML scores (and zip archives) in tests. Durations default to DIV divisions per
 * quarter note, which fits triplets, quintuplets and 64th notes exactly.
 */
export const DIV = 240

const TYPE_LEN: Record<string, number> = {
  breve: 8,
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 0.0625,
  '128th': 0.03125,
}

export interface NoteOpts {
  dots?: number
  voice?: number | string
  staff?: number
  chord?: boolean
  tie?: 'start' | 'stop' | 'both'
  /** [actual, normal, normal-type?] */
  tm?: [number, number] | [number, number, string]
  tuplet?: 'start' | 'stop' | 'both'
  finger?: number
  grace?: boolean
  cue?: boolean
  /** print-object="no" */
  hidden?: boolean
  /** Leave out <type> (the importer then works from <duration>). */
  noType?: boolean
  /** Duration in divisions, instead of working it out from the type. */
  dur?: number
  /** Divisions per quarter in effect (default DIV). */
  div?: number
  measureRest?: boolean
}

export const lengthOf = (type: string, o: NoteOpts = {}) =>
  Math.round(TYPE_LEN[type] * (2 - 0.5 ** (o.dots ?? 0)) * (o.tm ? o.tm[1] / o.tm[0] : 1) * (o.div ?? DIV))

function noteXml(body: string, type: string, o: NoteOpts): string {
  const dots = o.dots ?? 0
  const ties = (o.tie === 'start' || o.tie === 'both' ? ['start'] : []).concat(o.tie === 'stop' || o.tie === 'both' ? ['stop'] : [])
  const tuplets = (o.tuplet === 'start' || o.tuplet === 'both' ? ['start'] : []).concat(o.tuplet === 'stop' || o.tuplet === 'both' ? ['stop'] : [])
  const notations = [
    ...ties.map((t) => `<tied type="${t}"/>`),
    ...tuplets.map((t) => `<tuplet type="${t}"/>`),
    o.finger ? `<technical><fingering>${o.finger}</fingering></technical>` : '',
  ].join('')
  const tm = o.tm
    ? `<time-modification><actual-notes>${o.tm[0]}</actual-notes><normal-notes>${o.tm[1]}</normal-notes>${o.tm[2] ? `<normal-type>${o.tm[2]}</normal-type>` : ''}</time-modification>`
    : ''
  return [
    `<note${o.hidden ? ' print-object="no"' : ''}>`,
    o.grace ? '<grace/>' : '',
    o.cue ? '<cue/>' : '',
    o.chord ? '<chord/>' : '',
    body,
    o.grace ? '' : `<duration>${o.dur ?? lengthOf(type, o)}</duration>`,
    ...ties.map((t) => `<tie type="${t}"/>`),
    `<voice>${o.voice ?? 1}</voice>`,
    o.noType ? '' : `<type>${type}</type>`,
    '<dot/>'.repeat(dots),
    tm,
    o.staff ? `<staff>${o.staff}</staff>` : '',
    notations ? `<notations>${notations}</notations>` : '',
    '</note>',
  ].join('')
}

/** A pitched note: n('F#4', 'quarter', { dots: 1 }). */
export function n(pitch: string, type: string, o: NoteOpts = {}): string {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d)$/.exec(pitch)
  if (!m) throw new Error(`Bad pitch ${pitch}`)
  const alter = m[2] ? (m[2][0] === '#' ? m[2].length : -m[2].length) : 0
  return noteXml(`<pitch><step>${m[1]}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${m[3]}</octave></pitch>`, type, o)
}

export const r = (type: string, o: NoteOpts = {}) => noteXml(`<rest${o.measureRest ? ' measure="yes"' : ''}/>`, type, o)
export const backup = (div: number) => `<backup><duration>${div}</duration></backup>`
export const forward = (div: number, voice = 1) => `<forward><duration>${div}</duration><voice>${voice}</voice></forward>`

export function attrs(o: { div?: number; fifths?: number; mode?: string; time?: [number, number] | string; staves?: number; clef?: string } = {}): string {
  const time = typeof o.time === 'string' ? o.time : o.time ? `<beats>${o.time[0]}</beats><beat-type>${o.time[1]}</beat-type>` : ''
  return [
    '<attributes>',
    o.div !== undefined ? `<divisions>${o.div}</divisions>` : '',
    o.fifths !== undefined ? `<key><fifths>${o.fifths}</fifths>${o.mode ? `<mode>${o.mode}</mode>` : ''}</key>` : '',
    time ? `<time>${time}</time>` : '',
    o.staves ? `<staves>${o.staves}</staves>` : '',
    o.clef ? `<clef><sign>${o.clef}</sign><line>${o.clef === 'F' ? 4 : 2}</line></clef>` : '',
    '</attributes>',
  ].join('')
}

/** The usual first-measure attributes: DIV divisions, C major, 4/4 (override any of them). */
export const start = (o: Parameters<typeof attrs>[0] = {}) => attrs({ div: DIV, fifths: 0, time: [4, 4], ...o })

export const measure = (num: number | string, ...content: string[]) => `<measure number="${num}">${content.join('')}</measure>`
export const implicit = (num: number | string, ...content: string[]) => `<measure number="${num}" implicit="yes">${content.join('')}</measure>`

export function barline(location: 'left' | 'right', o: { repeat?: 'forward' | 'backward'; times?: number; ending?: [string, 'start' | 'stop' | 'discontinue'] }) {
  return [
    `<barline location="${location}">`,
    o.ending ? `<ending number="${o.ending[0]}" type="${o.ending[1]}"/>` : '',
    o.repeat ? `<repeat direction="${o.repeat}"${o.times ? ` times="${o.times}"` : ''}/>` : '',
    '</barline>',
  ].join('')
}

export function direction(o: { sound?: Record<string, string>; segno?: boolean; coda?: boolean; words?: string; metronome?: [string, number, number?] }) {
  const types = [
    o.segno ? '<segno/>' : '',
    o.coda ? '<coda/>' : '',
    o.words ? `<words>${o.words}</words>` : '',
    o.metronome ? `<metronome><beat-unit>${o.metronome[0]}</beat-unit>${'<beat-unit-dot/>'.repeat(o.metronome[2] ?? 0)}<per-minute>${o.metronome[1]}</per-minute></metronome>` : '',
  ]
    .filter(Boolean)
    .map((t) => `<direction-type>${t}</direction-type>`)
    .join('')
  const sound = o.sound ? `<sound ${Object.entries(o.sound).map(([k, v]) => `${k}="${v}"`).join(' ')}/>` : ''
  return `<direction placement="above">${types}${sound}</direction>`
}

export function harmony(root: string, kind: string, o: { text?: string; bass?: string; degrees?: [number, number, string][]; offset?: number } = {}) {
  const step = (s: string, tag: string) =>
    `<${tag}-step>${s[0]}</${tag}-step>${s.length > 1 ? `<${tag}-alter>${s[1] === '#' ? 1 : -1}</${tag}-alter>` : ''}`
  return [
    '<harmony>',
    `<root>${step(root, 'root')}</root>`,
    `<kind${o.text !== undefined ? ` text="${o.text}"` : ''}>${kind}</kind>`,
    o.bass ? `<bass>${step(o.bass, 'bass')}</bass>` : '',
    ...(o.degrees ?? []).map(([v, a, t]) => `<degree><degree-value>${v}</degree-value><degree-alter>${a}</degree-alter><degree-type>${t}</degree-type></degree>`),
    o.offset ? `<offset>${o.offset}</offset>` : '',
    '</harmony>',
  ].join('')
}

export interface PartSpec {
  name?: string
  measures: string[]
}

export function score(parts: PartSpec[], meta: { title?: string; composer?: string; movementTitle?: string; credits?: [string, string][] } = {}): string {
  const list = parts.map((p, i) => `<score-part id="P${i + 1}"><part-name>${p.name ?? 'Piano'}</part-name></score-part>`).join('')
  const body = parts.map((p, i) => `<part id="P${i + 1}">${p.measures.join('')}</part>`).join('')
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    meta.title ? `<work><work-title>${meta.title}</work-title></work>` : '',
    meta.movementTitle ? `<movement-title>${meta.movementTitle}</movement-title>` : '',
    meta.composer ? `<identification><creator type="composer">${meta.composer}</creator></identification>` : '',
    ...(meta.credits ?? []).map(([type, text]) => `<credit page="1"><credit-type>${type}</credit-type><credit-words>${text}</credit-words></credit>`),
    `<part-list>${list}</part-list>`,
    body,
    '</score-partwise>',
  ].join('\n')
}

// ---- Zip archives (for .mxl) ----

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(b: Uint8Array) {
  let c = 0xffffffff
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(data)
  const stream = new ReadableStream<BufferSource>({
    start(c) {
      c.enqueue(input)
      c.close()
    },
  }).pipeThrough(new CompressionStream('deflate-raw'))
  const parts: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return concat(parts)
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/**
 * A zip archive. `deflate` compresses an entry; `descriptor` writes its sizes after the data (bit 3), the
 * way streaming zip writers do, leaving zeros in the local header.
 */
export async function makeZip(entries: { name: string; text: string; deflate?: boolean; descriptor?: boolean }[]): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const raw = enc.encode(e.text)
    const data = e.deflate ? await deflateRaw(raw) : raw
    const name = enc.encode(e.name)
    const crc = crc32(raw)
    const flags = e.descriptor ? 8 : 0
    const method = e.deflate ? 8 : 0
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, flags, true)
    local.setUint16(8, method, true)
    local.setUint32(14, e.descriptor ? 0 : crc, true)
    local.setUint32(18, e.descriptor ? 0 : data.length, true)
    local.setUint32(22, e.descriptor ? 0 : raw.length, true)
    local.setUint16(26, name.length, true)
    const parts = [new Uint8Array(local.buffer), name, data]
    if (e.descriptor) {
      const dd = new DataView(new ArrayBuffer(16))
      dd.setUint32(0, 0x08074b50, true)
      dd.setUint32(4, crc, true)
      dd.setUint32(8, data.length, true)
      dd.setUint32(12, raw.length, true)
      parts.push(new Uint8Array(dd.buffer))
    }
    const block = concat(parts)
    locals.push(block)
    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint16(8, flags, true)
    central.setUint16(10, method, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, data.length, true)
    central.setUint32(24, raw.length, true)
    central.setUint16(28, name.length, true)
    central.setUint32(42, offset, true)
    centrals.push(concat([new Uint8Array(central.buffer), name]))
    offset += block.length
  }
  const dir = concat(centrals)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, dir.length, true)
  end.setUint32(16, offset, true)
  return concat([...locals, dir, new Uint8Array(end.buffer)])
}

export const CONTAINER = (path: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><container><rootfiles><rootfile full-path="${path}" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`
