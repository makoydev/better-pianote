import { type CSSProperties, createContext, useContext, useEffect, useEffectEvent } from 'react'
import { useElementSize } from '../../hooks/useElementSize'
import { useViewportHeight } from '../../hooks/useViewport'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../../lib/focus'

/**
 * On inside a lesson step, where the picture or widget is the one thing on screen: it fills the space left (its
 * keyboard shrinks to fit instead of running under the footer) and Space runs its main action. Off elsewhere (the
 * widget gallery shows them all at once), where everything keeps its full size and Space does nothing.
 */
export const InStep = createContext(false)

/** Short screens (a 13" MacBook, an iPad in landscape) get a little less room for each picture. */
export const useShortScreen = () => useViewportHeight() < 880

/**
 * The area a widget's keyboard sits in: put the returned ref, class and style on it. In a lesson step it's a flex
 * item that grows into the space left (up to the keyboard's full height, `ideal`, plus `room` above it for sparks)
 * and shrinks down to `min`, and the keyboard takes its height from it, so its parent must be a flex column.
 * Elsewhere the keyboard keeps `ideal`.
 *
 * `below` is the row under the keys (the middle C and octave labels: 24 px when shown).
 */
export function useFitKeyboard(ideal: number, { min = 100, below = 0, room = 0 }: { min?: number; below?: number; room?: number } = {}) {
  const fit = useContext(InStep)
  const [ref, { height }] = useElementSize<HTMLDivElement>()
  // At least a little air between the keys and whatever is above them.
  const air = Math.min(room, 12)
  const piano = fit && height > 0 ? Math.round(Math.max(min, Math.min(ideal, height - below - air))) : ideal
  const style: CSSProperties = fit ? { flex: '1 1 0%', minHeight: min + below + air, maxHeight: ideal + below + room } : { paddingTop: room }
  return [ref, { fit, piano, style, className: fit ? 'flex flex-col justify-end' : '' }] as const
}

/**
 * Space runs a widget's main action (Play, Play loop, hear it again), in a lesson step only. A focused button keeps
 * Space for itself, and so do sliders and radio groups. Pass null while there's nothing to run.
 */
export function useSpaceKey(action: (() => void) | null | undefined) {
  const inStep = useContext(InStep)
  const run = useEffectEvent(() => action?.())
  const on = inStep && !!action
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isPlainKey(e) || isTypingTarget(e.target) || isButtonTarget(e.target)) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on])
}
