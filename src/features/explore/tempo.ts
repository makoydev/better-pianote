/** Metronome helpers (pure). */

export const MIN_BPM = 30
export const MAX_BPM = 240

export const clampBpm = (bpm: number) => Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)))

/** The Italian tempo marking musicians use for a speed (ranges vary a little between sources). */
export function tempoName(bpm: number): string {
  if (bpm < 40) return 'Grave'
  if (bpm < 60) return 'Largo'
  if (bpm < 66) return 'Larghetto'
  if (bpm < 76) return 'Adagio'
  if (bpm < 108) return 'Andante'
  if (bpm < 120) return 'Moderato'
  if (bpm < 156) return 'Allegro'
  if (bpm < 176) return 'Vivace'
  if (bpm < 200) return 'Presto'
  return 'Prestissimo'
}

/**
 * Tempo from tap times (ms, oldest first). Uses up to the last 4 gaps and ignores taps
 * before a pause of more than 2 seconds. Returns null until there are two taps.
 */
export function tapTempo(times: number[]): number | null {
  let start = times.length - 1
  while (start > 0 && times[start] - times[start - 1] <= 2000) start--
  const recent = times.slice(start).slice(-5)
  if (recent.length < 2) return null
  const gaps = recent.slice(1).map((t, i) => t - recent[i])
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return clampBpm(60000 / avg)
}

export interface Meter {
  id: string
  label: string
  beats: number
  /** Beats that get an accent (0 = the first beat). */
  accents: number[]
}

export const METERS: Meter[] = [
  { id: '2/4', label: '2/4', beats: 2, accents: [0] },
  { id: '3/4', label: '3/4', beats: 3, accents: [0] },
  { id: '4/4', label: '4/4', beats: 4, accents: [0] },
  { id: '5/4', label: '5/4', beats: 5, accents: [0] },
  { id: '6/8', label: '6/8', beats: 6, accents: [0, 3] },
]
