import type { Duration } from '../../components/staff/layout'

/** One note, chord or rest in a song, as written in the score. */
export interface SongEvent {
  /** Note names ("E4", "F#5"); empty for a rest. */
  notes: string[]
  dur: Duration
  /** 0, 1 or 2 augmentation dots. */
  dots: number
  /** Chord symbol that starts here ("C", "G7", "Am"). */
  chord?: string
  finger?: number
  /** Finger for each note of a chord, in the same order as `notes` (null = none). */
  fingers?: (number | null)[]
  /** Tied to the same note in the next event (held, not played again). */
  tie: boolean
  /** Only these notes are tied to the next event (when not all of them are). */
  tieNotes?: string[]
  /**
   * Part of a tuplet: `actual` notes in the time of `normal` (a triplet is 3 in the time of 2).
   * `start`/`end` mark the first and last event of each bracketed group.
   */
  tuplet?: { actual: number; normal: number; start?: boolean; end?: boolean }
  /** Fills time silently without drawing a rest (a voice that drops out for a while). */
  hidden?: boolean
}

/** A second (or third) melody line in one hand, with its own rhythm. Bars line up with `rh`. */
export interface SongVoice {
  hand: 'rh' | 'lh'
  bars: SongEvent[][]
}

/** A key or time signature change at the start of a bar. */
export interface SongChange {
  bar: number
  keySig?: number
  time?: [number, number]
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
  /** The right hand's main line, bar by bar. Every voice's bars line up with these. */
  rh: SongEvent[][]
  lh?: SongEvent[][]
  /** Extra lines with their own rhythm (imported scores; built-in songs have none). */
  voices?: SongVoice[]
  /** Key or time signature changes after the first bar. */
  changes?: SongChange[]
  /** Set for songs you imported yourself (stored on this device). */
  imported?: { fileName: string; at: number }
}
