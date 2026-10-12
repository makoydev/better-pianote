import type { SongProblem } from './validate'

/**
 * What stopped an import: `file` when it isn't a score the app can read (another kind of file, damaged),
 * `score` when it is MusicXML but something in the music stopped it.
 */
export type ImportErrorKind = 'file' | 'score'

/** A problem with the file someone picked, in words they can act on (shown as is). */
export class ImportError extends Error {
  kind: ImportErrorKind
  /** What exactly was wrong with the song the importer made (for "Show details"). */
  problems: SongProblem[]
  /** The score's own bar numbers, for each bar in playing order (repeats written out). */
  barNames: string[]
  constructor(message: string, opts: { kind?: ImportErrorKind; problems?: SongProblem[]; barNames?: string[] } = {}) {
    super(message)
    this.name = 'ImportError'
    this.kind = opts.kind ?? 'file'
    this.problems = opts.problems ?? []
    this.barNames = opts.barNames ?? []
  }
}

export const HOW_TO_EXPORT = 'In MuseScore (or another notation app), choose File → Export → MusicXML, then import that file.'

/** Problems that share a fix, each with where it is ("Bar 12 · Left hand"). */
export interface ProblemGroup {
  fix: string
  items: { where: string; text: string }[]
}

/**
 * The first few problems for people: in bar order, named by the score's own bar numbers, each one once
 * (repeats written out would list it again), grouped under the fix they share.
 */
export function describeProblems(problems: SongProblem[], barNames: string[] = [], max = 6): { groups: ProblemGroup[]; more: number } {
  const barName = (b: number) => {
    const name = barNames[b]?.trim() || String(b + 1)
    return name === '0' ? 'Pickup bar' : `Bar ${name}`
  }
  const seen = new Set<string>()
  const items: (SongProblem & { where: string })[] = []
  for (const p of [...problems].sort((a, b) => (a.bar ?? -1) - (b.bar ?? -1))) {
    const where = [p.bar === undefined ? '' : barName(p.bar), p.line].filter(Boolean).join(' · ')
    const key = `${where}|${p.text}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ ...p, where })
  }
  const groups: ProblemGroup[] = []
  for (const p of items.slice(0, max)) {
    let group = groups.find((g) => g.fix === p.fix)
    if (!group) groups.push((group = { fix: p.fix, items: [] }))
    group.items.push({ where: p.where, text: p.text })
  }
  return { groups, more: Math.max(0, items.length - max) }
}
