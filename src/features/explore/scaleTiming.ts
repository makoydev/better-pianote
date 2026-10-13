/** Best clean tempo per scale run, kept in "scale:best-bpm": a scale, hands, octaves and direction → BPM. */
export const bestKey = (pc: number, typeId: string, hands: string, octaves: number, upDown: boolean) => `${pc}:${typeId}:${hands}:${octaves}:${upDown ? 'up-down' : 'up'}`

/** Best tempos read back from prefs: only sensible numbers survive. */
export function readBests(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, bpm] of Object.entries(v)) if (typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= 20 && bpm <= 400) out[k] = Math.round(bpm)
  return out
}
