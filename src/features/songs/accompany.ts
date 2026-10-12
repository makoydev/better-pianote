import type { NoteFilter } from './listen'
import type { Hands } from './results'
import { type Timeline, type TimedNote, addShared } from './timeline'

/** The app playing the hand you're not practising: in Listen, and along with you in Practice ("Accompany me"). */

const EPS = 1e-6

/** What Listen plays: everything, one hand, or the hand you're not practising. */
export type ListenPart = 'all' | 'rh' | 'lh' | 'other'
export const LISTEN_PARTS: readonly ListenPart[] = ['all', 'rh', 'lh', 'other']

/** The hand the app plays for you while you practise one (none while you practise both). */
export const otherHand = (hands: Hands): 'rh' | 'lh' | null => (hands === 'rh' ? 'lh' : hands === 'lh' ? 'rh' : null)

/** The hand Listen plays ('all' for both), with "the other hand" worked out from the hands you practise. */
export const listenHand = (part: ListenPart, hands: Hands): 'all' | 'rh' | 'lh' => (part === 'other' ? (otherHand(hands) ?? 'all') : part)

/** Only the notes of one hand (nothing to filter for both). */
export const handFilter = (hand: 'all' | 'rh' | 'lh'): NoteFilter | undefined => (hand === 'all' ? undefined : (n) => n.hand === hand)

/**
 * Accompany me: when you finish the step at `from`, the other hand's notes from then up to your next step (`to`),
 * each with its offset in beats, so they come in time at your tempo and then wait for you. A key your own step
 * plays at that moment isn't doubled, and a pitch two voices start together sounds once.
 */
export function accompaniment(tl: Timeline, hand: 'rh' | 'lh', from: number, to: number, mine: number[] = []): { note: TimedNote; at: number }[] {
  const moments = new Map<number, TimedNote[]>()
  for (const n of tl.notes) {
    if (n.cont || n.hand !== hand || n.start < from - EPS || n.start >= to - EPS) continue
    if (n.start < from + EPS && mine.includes(n.midi)) continue
    const k = Math.round(n.start * 1e6)
    const list = moments.get(k) ?? []
    addShared(list, n)
    moments.set(k, list)
  }
  return [...moments.values()]
    .flat()
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
    .map((note) => ({ note, at: note.start - from }))
}
