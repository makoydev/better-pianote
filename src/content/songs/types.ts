import type { Duration } from '../../components/staff/layout'

/** One note, chord or rest in a song, as written in the score. */
export interface SongEvent {
  /** Note names ("E4", "F#5"); empty for a rest. */
  notes: string[]
  dur: Duration
  dots: number
  /** Chord symbol that starts here ("C", "G7", "Am"). */
  chord?: string
  finger?: number
  /** Tied to the same note in the next event (held, not played again). */
  tie: boolean
}

/**
 * Songs are written in a compact text format, one token per note, bars separated by "|":
 *
 *   {C}E4:q/3   chord C starts here, E4, quarter note, finger 3
 *   D4:8        eighth note (durations: w h q 8 16; a duration carries over to following notes)
 *   E4:q.       dotted quarter          r:16   a sixteenth rest          D5:h.~   tied to the next note
 */
export interface SongSource {
  id: string
  title: string
  composer: string
  /** When it was written (all songs here are in the public domain). */
  year: string
  difficulty: 1 | 2 | 3
  /** Display name of the key, e.g. "C major". */
  keyName: string
  /** Sharps (+) or flats (−) in the key signature. */
  keySig: number
  time: [number, number]
  /** Suggested tempo in quarter notes per minute. */
  bpm: number
  /** Length of the pickup (anacrusis) before the first full bar, in quarter notes. */
  pickup?: number
  tags: string[]
  about: string
  rh: string
  /** Optional simple left-hand part, bar for bar with the right hand. */
  lh?: string
}

export interface Song extends Omit<SongSource, 'rh' | 'lh'> {
  rh: SongEvent[][]
  lh?: SongEvent[][]
}
