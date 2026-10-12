import { useEffect, useEffectEvent } from 'react'
import { isButtonTarget, isPlainKey, isTypingTarget } from '../lib/focus'
import { onNote } from '../lib/input/bus'
import { onPedalTap } from '../lib/input/pedalTap'
import { useSettings } from '../state/settings'

/** The highest key on the CT-S1 (C7). */
export const TOP_C = 96

/**
 * One hands-free scheme for every screen: the screen's main action right now (Start, Continue, Next, Play again)
 * also runs on Enter, a quick tap of the sustain pedal, or the top C (C7), which works through the mic, too, where
 * the app can't see a pedal. Pass `null` while there's no main action (e.g. while notes are answers).
 *
 * - `pedal: false` for screens about the pedal itself.
 * - `topC: false` where C7 is a note you'd play.
 * - Inputs in the first `delay` ms after the action appears are ignored, so the Enter or pedal that finished a
 *   round doesn't also skip its results.
 */
export function useHandsFree(action: (() => void) | null | undefined, opts: { pedal?: boolean; topC?: boolean; delay?: number } = {}) {
  const { pedal = true, topC = true, delay = 700 } = opts
  const run = useEffectEvent(() => action?.())
  const enabled = !!action
  useEffect(() => {
    if (!enabled) return
    const since = performance.now()
    const fire = () => {
      if (performance.now() - since >= delay) run()
    }
    const onKey = (e: KeyboardEvent) => {
      // Enter on a focused button already clicks it.
      if (e.key !== 'Enter' || !isPlainKey(e) || isTypingTarget(e.target) || isButtonTarget(e.target)) return
      e.preventDefault()
      fire()
    }
    window.addEventListener('keydown', onKey)
    const offPedal = pedal ? onPedalTap(fire) : () => {}
    const offNote = topC
      ? onNote((e) => {
          if (e.type === 'on' && e.midi === TOP_C && useSettings.getState().topCContinue) fire()
        })
      : () => {}
    return () => {
      window.removeEventListener('keydown', onKey)
      offPedal()
      offNote()
    }
  }, [enabled, pedal, topC, delay])
}
