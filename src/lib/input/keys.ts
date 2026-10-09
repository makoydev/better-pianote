import { useLive } from '../../state/live'
import { useSettings } from '../../state/settings'
import { noteOff, noteOn, releaseAll } from './bus'

/**
 * Play with the computer keyboard, laid out like a piano (the usual DAW layout):
 *   W E   T Y U   O P        ← black keys
 *  A S D F G H J K L ;       ← white keys, A = C
 * Z / X shift down / up an octave.
 */
export const KEY_MAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9,
  KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
}

const down = new Map<string, number>()
let installed = false
/** Screens can borrow keys (e.g. Space in the rhythm game) by pausing the piano mapping. */
let paused = 0

export function pauseComputerKeys() {
  paused++
  releaseAll('keys')
  return () => {
    paused--
  }
}

function typingInField(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function installComputerKeys() {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (e) => {
    if (paused || e.repeat || e.metaKey || e.ctrlKey || e.altKey || typingInField(e.target)) return
    if (!useSettings.getState().computerKeys) return
    const live = useLive.getState()
    if (e.code === 'KeyZ' || e.code === 'KeyX') {
      const next = Math.min(7, Math.max(1, live.keysOctave + (e.code === 'KeyX' ? 1 : -1)))
      releaseAll('keys')
      down.clear()
      useLive.setState({ keysOctave: next })
      return
    }
    const off = KEY_MAP[e.code]
    if (off === undefined) return
    const m = (live.keysOctave + 1) * 12 + off
    down.set(e.code, m)
    noteOn(m, 0.75, 'keys')
  })
  window.addEventListener('keyup', (e) => {
    const m = down.get(e.code)
    if (m === undefined) return
    down.delete(e.code)
    noteOff(m, 'keys')
  })
  window.addEventListener('blur', () => {
    down.clear()
    releaseAll('keys')
  })
}
