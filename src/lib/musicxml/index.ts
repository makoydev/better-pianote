import { convertScore } from './convert'
import type { ImportResult } from './convert'
import { parseMusicXml } from './parse'
import { readScoreText } from './zip'

/**
 * Import a MusicXML score (.musicxml, .xml or compressed .mxl) as a Song: one part, its two staves as the
 * hands, extra voices as extra lines, repeats written out. Throws ImportError with a message to show.
 */
/**
 * Bump this when a change to the importer would read files differently: songs saved on the device are re-read
 * from their original file (keeping the title, composer and level you chose).
 */
export const IMPORTER_VERSION = 1

export { ImportError } from './errors'
export type { ImportPart, ImportResult } from './convert'
export { readScoreText } from './zip'
export { validateSong } from './validate'

export function importMusicXml(xml: string, fileName: string, opts?: { partIndex?: number }): ImportResult {
  return convertScore(parseMusicXml(xml), fileName, opts)
}

export async function importScoreFile(bytes: Uint8Array, fileName: string, opts?: { partIndex?: number }): Promise<ImportResult> {
  return importMusicXml(await readScoreText(bytes), fileName, opts)
}
