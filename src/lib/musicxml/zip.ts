import { HOW_TO_EXPORT, ImportError } from './errors'

/**
 * Reading a score file's text: plain MusicXML (UTF-8 or UTF-16), or compressed MusicXML (.mxl), which is a
 * zip archive. A small zip reader is enough: it reads the central directory (so sizes are right even when
 * the archive uses data descriptors) and inflates with the browser's DecompressionStream.
 */

interface ZipEntry {
  name: string
  method: number
  flags: number
  compSize: number
  offset: number
}

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0

const startsWith = (b: Uint8Array, s: string) => [...s].every((ch, i) => b[i] === ch.charCodeAt(0))
const isZip = (b: Uint8Array) => startsWith(b, 'PK\x03\x04') || startsWith(b, 'PK\x05\x06')

const DAMAGED = 'This .mxl file looks damaged, so it can’t be opened.'

function listZip(b: Uint8Array): ZipEntry[] {
  // The end-of-central-directory record sits at the very end, before an optional comment.
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ImportError(DAMAGED)
  const count = u16(b, eocd + 10)
  const dirOffset = u32(b, eocd + 16)
  if (count === 0xffff || dirOffset === 0xffffffff) {
    throw new ImportError('This .mxl file uses a zip format the app can’t read. Try exporting uncompressed MusicXML (.musicxml) instead.')
  }
  const entries: ZipEntry[] = []
  let p = dirOffset
  for (let k = 0; k < count; k++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw new ImportError(DAMAGED)
    const nameLen = u16(b, p + 28)
    entries.push({
      flags: u16(b, p + 8),
      method: u16(b, p + 10),
      compSize: u32(b, p + 20),
      offset: u32(b, p + 42),
      name: new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen)),
    })
    p += 46 + nameLen + u16(b, p + 30) + u16(b, p + 32)
  }
  return entries
}

async function readEntry(b: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
  if (e.flags & 1) throw new ImportError('This .mxl file is password-protected, so it can’t be opened.')
  if (e.offset + 30 > b.length || u32(b, e.offset) !== 0x04034b50) throw new ImportError(DAMAGED)
  const start = e.offset + 30 + u16(b, e.offset + 26) + u16(b, e.offset + 28)
  const data = b.subarray(start, start + e.compSize)
  if (e.method === 0) return data
  if (e.method !== 8) throw new ImportError('This .mxl file is compressed in a way the app can’t read. Try exporting uncompressed MusicXML (.musicxml) instead.')
  try {
    return await inflateRaw(data)
  } catch {
    throw new ImportError(DAMAGED)
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(data)
  const stream = new ReadableStream<BufferSource>({
    start(c) {
      c.enqueue(input)
      c.close()
    },
  }).pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** Bytes to text, honouring a byte-order mark (MusicXML is UTF-8 or UTF-16). */
export function decodeText(b: Uint8Array): string {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3))
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2))
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2))
  // UTF-16 without a mark: "<" followed (or preceded) by a zero byte.
  if (b[0] === 0x3c && b[1] === 0) return new TextDecoder('utf-16le').decode(b)
  if (b[0] === 0 && b[1] === 0x3c) return new TextDecoder('utf-16be').decode(b)
  return new TextDecoder('utf-8').decode(b)
}

/** The MusicXML text inside a file: unzips .mxl, and explains what to do with other kinds of files. */
export async function readScoreText(bytes: Uint8Array): Promise<string> {
  if (startsWith(bytes, '%PDF')) {
    throw new ImportError(
      'That’s a PDF, which is a picture of the music, not the notes themselves. Open it in a sheet-music scanner (MuseScore can import PDFs) and export MusicXML.',
    )
  }
  if (startsWith(bytes, 'MThd')) {
    throw new ImportError(`That’s a MIDI file. The app needs MusicXML, which keeps the written notes. Open the MIDI file in MuseScore, then: ${HOW_TO_EXPORT}`)
  }
  if (!isZip(bytes)) return decodeText(bytes)

  const entries = listZip(bytes)
  const byName = new Map(entries.map((e) => [e.name, e]))
  let root: ZipEntry | undefined
  const container = byName.get('META-INF/container.xml')
  if (container) {
    const xml = decodeText(await readEntry(bytes, container))
    const files = [...xml.matchAll(/<rootfile\b[^>]*>/g)].map((m) => ({
      path: /\bfull-path\s*=\s*["']([^"']+)["']/.exec(m[0])?.[1],
      type: /\bmedia-type\s*=\s*["']([^"']+)["']/.exec(m[0])?.[1],
    }))
    const pick = files.find((f) => f.path && (!f.type || f.type.includes('musicxml'))) ?? files.find((f) => f.path)
    if (pick?.path) root = byName.get(pick.path.replace(/^\.?\//, ''))
  }
  root ??= entries.find((e) => !e.name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(e.name))
  if (!root) {
    if (entries.some((e) => /\.mscx$/i.test(e.name))) throw new ImportError(`That’s a MuseScore file (.mscz). ${HOW_TO_EXPORT}`)
    throw new ImportError('This zip file doesn’t contain a MusicXML score.')
  }
  return decodeText(await readEntry(bytes, root))
}
