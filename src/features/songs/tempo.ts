/**
 * The tempo you hear a song at, as a % of its own tempo. Kept unrounded (72 % of 66 is 47.52 BPM), so the % stays
 * exact as you step through it; screens show the BPM rounded.
 */

export const TEMPO_PRESETS = [50, 60, 75, 90, 100]
export const MIN_PCT = 25
export const MAX_PCT = 150
/** −/+ and "speed up each loop" move in steps of 5 % of the song's tempo. */
const STEP = 5
const EPS = 1e-6

/** The tempo as a whole % of the song's tempo. */
export const tempoPct = (bpm: number, songBpm: number) => Math.round((bpm / songBpm) * 100)

/** Beats per minute at a % of the song's tempo. */
export const bpmAt = (songBpm: number, pct: number) => (songBpm * pct) / 100

/** A remembered tempo, kept in range (in case the song's own tempo changed). */
export const clampTempo = (bpm: number, songBpm: number) => Math.min(bpmAt(songBpm, MAX_PCT), Math.max(bpmAt(songBpm, MIN_PCT), bpm))

/** −/+: the next 5 % step down or up, landing on the 5 % grid (72 % → 75 % or 70 %). */
export function stepTempo(bpm: number, songBpm: number, dir: 1 | -1): number {
  const steps = ((bpm / songBpm) * 100) / STEP
  const next = (dir > 0 ? Math.floor(steps + EPS) + 1 : Math.ceil(steps - EPS) - 1) * STEP
  return bpmAt(songBpm, Math.min(MAX_PCT, Math.max(MIN_PCT, next)))
}

/** Speed up each loop: 5 % of the song's tempo faster per pass, up to the song's tempo. */
export function loopSpeedUp(bpm: number, songBpm: number): number {
  if (bpm >= songBpm - EPS) return bpm
  return Math.min(songBpm, bpm + bpmAt(songBpm, STEP))
}
