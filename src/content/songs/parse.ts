import type { Duration } from '../../components/staff/layout'
import type { Song, SongEvent, SongSource } from './types'

/** Length of each duration in quarter notes. */
export const BEATS: Record<Duration, number> = { w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25 }

export const eventBeats = (e: Pick<SongEvent, 'dur' | 'dots'>) => BEATS[e.dur] * (e.dots ? 1.5 : 1)

/** Length of one full bar in quarter notes (4/4 → 4, 3/4 → 3, 3/8 → 1.5). */
export const barBeats = (time: [number, number]) => (time[0] * 4) / time[1]

const TOKEN = /^(?:\{([^}]+)\})?(r|\[[^\]]+\]|[A-G](?:#|b)?-?\d)(?::(w|h|q|8|16))?(\.)?(?:\/([1-5]))?(~)?$/

/** Parse the compact song format (see SongSource) into bars of events. */
export function parseBars(src: string): SongEvent[][] {
  let dur: Duration = 'q'
  return src
    .split('|')
    .map((bar) => bar.trim())
    .filter(Boolean)
    .map((bar) =>
      bar.split(/\s+/).map((tok) => {
        const m = TOKEN.exec(tok)
        if (!m) throw new Error(`Bad song token "${tok}"`)
        const [, chord, body, d, dot, finger, tie] = m
        if (d) dur = d as Duration
        const notes = body === 'r' ? [] : body.startsWith('[') ? body.slice(1, -1).split(',') : [body]
        return { notes, dur, dots: dot ? 1 : 0, chord, finger: finger ? Number(finger) : undefined, tie: !!tie }
      }),
    )
}

export function parseSong(s: SongSource): Song {
  const { rh, lh, ...meta } = s
  return { ...meta, rh: parseBars(rh), lh: lh ? parseBars(lh) : undefined }
}
