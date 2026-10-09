import { parseChord } from '../theory'

/** A MusicXML <harmony>, unpacked. */
export interface HarmonyParts {
  rootStep: string
  rootAlter: number
  kind: string
  /** The kind's `text` attribute: how the score displays it ("7sus4", "m7b5"). */
  kindText?: string
  bassStep?: string
  bassAlter?: number
  degrees: { value: number; alter: number; type: string }[]
}

// MusicXML chord kinds → the suffixes `parseChord` understands.
const KIND: Record<string, string> = {
  major: '',
  minor: 'm',
  augmented: 'aug',
  diminished: 'dim',
  dominant: '7',
  'major-seventh': 'maj7',
  'minor-seventh': 'm7',
  'diminished-seventh': 'dim7',
  'half-diminished': 'm7b5',
  'major-minor': 'm(maj7)',
  'major-sixth': '6',
  'minor-sixth': 'm6',
  'dominant-ninth': '9',
  'major-ninth': 'maj9',
  'minor-ninth': 'm9',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus4',
  power: '5',
}

const accText = (alter: number) => (alter === 1 ? '#' : alter === -1 ? 'b' : alter === 0 ? '' : null)

/**
 * The chord symbol for a <harmony> ("F#m7", "C/E"): null when the app can't show it (C7♭9, say), and
 * undefined for "no chord" (N.C.), which isn't a symbol at all.
 */
export function harmonySymbol(h: HarmonyParts): string | null | undefined {
  if (h.kind === 'none') return undefined
  const rootAcc = accText(h.rootAlter)
  if (!/^[A-G]$/.test(h.rootStep) || rootAcc === null) return null
  const root = h.rootStep + rootAcc

  // MuseScore writes an empty kind for a symbol that's just the root ("G", "C/A"): a major chord.
  let suffix: string | undefined = h.kind === '' && !h.kindText ? '' : KIND[h.kind]
  const d = h.degrees
  if (d.length) {
    const only = (value: number, alter: number, type = 'add') => d.length === 1 && d[0].value === value && d[0].alter === alter && d[0].type === type
    const has = (value: number, type: string) => d.some((x) => x.value === value && x.type === type)
    if (h.kind === 'major' && (only(9, 0) || only(2, 0))) suffix = 'add9'
    else if (h.kind === 'minor' && (only(9, 0) || only(2, 0))) suffix = 'm(add9)'
    else if (h.kind === 'suspended-fourth' && only(7, -1)) suffix = '7sus4'
    else if (h.kind === 'dominant' && d.length === 2 && has(4, 'add') && has(3, 'subtract')) suffix = '7sus4'
    // Any other added or altered note (C7♭9 …) can't be shown, so leave the symbol out rather than guess.
    else suffix = undefined
  } else if (suffix === undefined && h.kindText) {
    // Kinds without a fixed suffix: the displayed text sometimes is one the app knows.
    suffix = h.kindText.replace(/♭/g, 'b').replace(/♯/g, '#').trim()
  }
  if (suffix === undefined) return null

  let symbol = root + suffix
  if (h.bassStep !== undefined) {
    const bassAcc = accText(h.bassAlter ?? 0)
    if (!/^[A-G]$/.test(h.bassStep) || bassAcc === null) return null
    symbol += `/${h.bassStep}${bassAcc}`
  }
  try {
    parseChord(symbol)
    return symbol
  } catch {
    return null
  }
}
