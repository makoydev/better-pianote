/** Splitting and measuring text that contains ♯ ♭ ♮ (drawn with Bravura's chord-symbol glyphs). */

const ACC_GLYPH: Record<string, string> = { '♭': '', '♮': '', '♯': '', '𝄪': '', '𝄫': '' }
export const ACC_RE = /(♭|♮|♯|𝄪|𝄫)/u

export function splitMusic(text: string): { acc: boolean; s: string }[] {
  return text
    .split(ACC_RE)
    .filter(Boolean)
    .map((s) => (ACC_GLYPH[s] ? { acc: true, s: ACC_GLYPH[s] } : { acc: false, s }))
}

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
const cache = new Map<string, number>()

/** Width in px of `text` (with accidentals) at a size, for laying out chord symbols and labels. */
export function measureMusicText(text: string, size: number, display: boolean): number {
  const key = `${display ? 'd' : 's'}${size.toFixed(1)}:${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  let w = 0
  const ctx = canvas?.getContext('2d')
  for (const part of splitMusic(text)) {
    if (part.acc) w += size * 0.86 * 0.31 + size * 0.05
    else if (ctx) {
      ctx.font = display ? `700 ${size}px "Fraunces Variable", Georgia, serif` : `800 ${size}px "Nunito Variable", system-ui, sans-serif`
      w += ctx.measureText(part.s).width
    } else w += part.s.length * size * 0.62
  }
  cache.set(key, w)
  return w
}
