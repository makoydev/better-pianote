/** SMuFL code points in the Bravura font, and glyph widths in staff spaces (from Bravura's metadata). */
export const GLYPH = {
  brace: '',
  gClef: '',
  fClef: '',
  percClef: '',
  common: '',
  whole: '',
  half: '',
  black: '',
  flag8Up: '',
  flag8Down: '',
  flag16Up: '',
  flag16Down: '',
  flag32Up: '\uE244',
  flag32Down: '\uE245',
  flag64Up: '\uE246',
  flag64Down: '\uE247',
  flat: '',
  natural: '',
  sharp: '',
  dblSharp: '',
  dblFlat: '',
  restWhole: '',
  restHalf: '',
  restQuarter: '',
  rest8: '',
  rest16: '',
  rest32: '\uE4E8',
  rest64: '\uE4E9',
  ped: '',
  pedUp: '',
} as const

export const timeSigDigit = (d: number) => String.fromCharCode(0xe080 + d)
/** Small digits for tuplet numbers (the 3 over a triplet). */
export const tupletDigit = (d: number) => String.fromCharCode(0xe880 + d)

export const WIDTH = {
  gClef: 2.684,
  fClef: 2.736,
  percClef: 1.528,
  black: 1.18,
  whole: 1.688,
  sharp: 0.996,
  flat: 0.904,
  natural: 0.672,
  dblSharp: 0.988,
  dblFlat: 1.644,
  timeSig: 1.8,
  restWhole: 1.128,
  restHalf: 1.128,
  restQuarter: 1.08,
  rest8: 0.988,
  rest16: 1.28,
  rest32: 1.452,
  rest64: 1.696,
} as const

/** Bravura engraving defaults (staff spaces). */
export const ENGRAVING = {
  staffLine: 0.13,
  stem: 0.12,
  ledger: 0.16,
  ledgerExt: 0.4,
  beam: 0.5,
  beamGap: 0.25,
  thinBar: 0.16,
  thickBar: 0.5,
  barGap: 0.4,
} as const

export function accidentalGlyph(acc: number): { ch: string; w: number } {
  switch (acc) {
    case 2:
      return { ch: GLYPH.dblSharp, w: WIDTH.dblSharp }
    case 1:
      return { ch: GLYPH.sharp, w: WIDTH.sharp }
    case -1:
      return { ch: GLYPH.flat, w: WIDTH.flat }
    case -2:
      return { ch: GLYPH.dblFlat, w: WIDTH.dblFlat }
    default:
      return { ch: GLYPH.natural, w: WIDTH.natural }
  }
}
