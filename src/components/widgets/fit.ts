import { type CSSProperties, createContext, useContext } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { useViewportHeight } from '../../hooks/useViewport'

/**
 * On in lesson steps: a picture or widget fills the space left on screen, and its keyboard shrinks to fit instead
 * of running under the footer. Off elsewhere (the widget gallery), where everything keeps its full size.
 */
export const FitContext = createContext(false)

/** Short screens (a 13" MacBook, an iPad in landscape) get a little less room for each picture. */
export const useShortScreen = () => useViewportHeight() < 880

/**
 * The area a widget's keyboard sits in: put the returned ref, class and style on it. When fitting, it's a flex item
 * that grows into the space left (up to the keyboard's full height, `ideal`, plus `room` above it for sparks) and
 * shrinks down to `min`, and the keyboard takes its height from it, so its parent must be a flex column. When not
 * fitting, the keyboard keeps `ideal`.
 *
 * `below` is the row under the keys (the middle C and octave labels: 24 px when shown).
 */
export function useFitKeyboard(ideal: number, { min = 100, below = 0, room = 0 }: { min?: number; below?: number; room?: number } = {}) {
  const fit = useContext(FitContext)
  const [ref, { height }] = useElementSize<HTMLDivElement>()
  // At least a little air between the keys and whatever is above them.
  const air = Math.min(room, 12)
  const piano = fit && height > 0 ? Math.round(Math.max(min, Math.min(ideal, height - below - air))) : ideal
  const style: CSSProperties = fit ? { flex: '1 1 0%', minHeight: min + below + air, maxHeight: ideal + below + room } : { paddingTop: room }
  return [ref, { fit, piano, style, className: fit ? 'flex flex-col justify-end' : '' }] as const
}
