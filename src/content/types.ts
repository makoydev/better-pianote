import type { KeyMark, MarkKind } from '../components/piano/Piano'
import type { StaffItem } from '../components/staff/Staff'
import type { IconName } from '../components/ui/Icon'

/**
 * Lesson content is plain data. Notes are written as names ("C4", "F#3", "Bb4");
 * chords as symbols ("Am7", "C/E"). Body text supports the RichText markup:
 * **bold**, *emphasis*, [[C4]] note chips, {{Am}} chord chips, "- " bullets, blank-line paragraphs.
 */

export interface KeyboardVisual {
  /** Lowest/highest key shown, e.g. "C3" and "C5". */
  from: string
  to: string
  /** Highlights by note name, e.g. { C4: 'target', E4: { kind: 'chord', label: '3' } }. */
  marks?: Record<string, MarkKind | KeyMark>
  fingers?: Record<string, number>
  labels?: 'all' | 'c' | 'none' | 'marked'
  octaveLabels?: boolean
}

export interface StaffVisual {
  clef: 'treble' | 'bass' | 'grand' | 'rhythm'
  items: StaffItem[]
  keySig?: number
  time?: [number, number]
  labels?: boolean
  spacing?: 'even' | 'proportional'
}

/** A "listen" button. Each entry in `notes` is a note or (array) a chord, played in order. */
export interface AudioClip {
  label: string
  notes: (string | string[])[]
  /** Seconds between steps (default 0.5). */
  gap?: number
  /** How long each step rings (default gap × 1.5). */
  dur?: number
}

export type Widget =
  /** The whole 61-key CT-S1 keyboard: black-key groups, octaves, middle C. */
  | { type: 'keyboard-map' }
  /** Play or tap any key and watch where it lands on the staff. */
  | { type: 'staff-mapper'; clef: 'treble' | 'bass' | 'grand' }
  /** Whole → halves → quarters → eighths, tap to hear each. */
  | { type: 'note-values' }
  | { type: 'metronome'; bpm?: number; beats?: number }
  /** Pick two keys and see the interval (half steps, name, a song that starts with it). */
  | { type: 'interval-lab' }
  /** Builds a scale step by step from its W/H pattern. */
  | { type: 'step-pattern'; tonic: string; scale: string }
  /** Choose a root and chord quality and see/hear the chord. */
  | { type: 'chord-builder'; root?: string; quality?: string }
  | { type: 'circle-of-fifths' }
  /** Plays a progression in a key, lighting up each chord card. */
  | { type: 'progression'; key: string; romans: string[]; bpm?: number; pattern?: 'block' | 'arpeggio' | 'ballad' }

export interface Visual {
  keyboard?: KeyboardVisual
  staff?: StaffVisual
  audio?: AudioClip[]
  widget?: Widget
}

export interface ExplainStep {
  kind: 'explain'
  title: string
  body: string
  visual?: Visual
  tip?: string
  /** Connects the idea to guitar (shown as a "Guitar brain" note). */
  guitar?: string
}

export type Target =
  /** Play any one of these notes. */
  | { type: 'note'; notes: string[]; anyOctave?: boolean }
  /** Play all of these, in any order (e.g. every C on the keyboard). */
  | { type: 'set'; notes: string[]; anyOctave?: boolean }
  /** Play these in order (a scale, a melody). */
  | { type: 'sequence'; notes: string[]; anyOctave?: boolean }
  /**
   * Play these together (on screen: tap each key). Exact notes unless `anyOctave` (then any voicing of
   * the same note names counts). `bass` requires that note to be lowest (inversions).
   */
  | { type: 'chord'; notes: string[]; anyOctave?: boolean; bass?: string }

export interface PlayStep {
  kind: 'play'
  title?: string
  prompt: string
  body?: string
  target: Target
  /** Keyboard shown for playing (defaults to a range that fits the targets). */
  keyboard?: KeyboardVisual
  /** Staff shown above the keyboard. */
  staff?: StaffVisual
  /** Light up the target keys from the start (otherwise only as a hint after mistakes). */
  showTargets?: boolean
  hint?: string
  success?: string
}

export interface QuizStep {
  kind: 'quiz'
  question: string
  body?: string
  visual?: Visual
  /** Played automatically when the question appears (ear questions). */
  listen?: AudioClip
  options: string[]
  answer: number
  /** Shown after answering. */
  explain?: string
}

export interface WidgetStep {
  kind: 'widget'
  title: string
  body?: string
  widget: Widget
  tip?: string
  guitar?: string
}

export type Step = ExplainStep | PlayStep | QuizStep | WidgetStep

export interface Lesson {
  id: string
  title: string
  subtitle: string
  minutes: number
  icon: IconName
  steps: Step[]
}

export interface Unit {
  id: string
  title: string
  subtitle: string
  /** Accent colour for the unit's path. */
  color: string
  icon: IconName
  lessons: Lesson[]
}
