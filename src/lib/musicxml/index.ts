import { convertScore } from './convert'
import type { ImportResult } from './convert'
import { ImportError } from './errors'
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
export const IMPORTER_VERSION = 2

export { ImportError, describeProblems } from './errors'
export type { ImportErrorKind, ProblemGroup } from './errors'
export type { ImportPart, ImportResult } from './convert'
export { readScoreText } from './zip'
export { songProblems, validateSong } from './validate'
export type { SongProblem } from './validate'

export function importMusicXml(xml: string, fileName: string, opts?: { partIndex?: number }): ImportResult {
  const score = parseMusicXml(xml)
  try {
    return convertScore(score, fileName, opts)
  } catch (e) {
    // The file read as MusicXML, so whatever stopped it is in the music ("which files work" won't help).
    if (e instanceof ImportError) {
      e.kind = 'score'
      throw e
    }
    console.error('MusicXML import failed:', e)
    throw new ImportError('Something in this score confused the importer, so it couldn’t be imported.', { kind: 'score' })
  }
}

export async function importScoreFile(bytes: Uint8Array, fileName: string, opts?: { partIndex?: number }): Promise<ImportResult> {
  return importMusicXml(await readScoreText(bytes), fileName, opts)
}
