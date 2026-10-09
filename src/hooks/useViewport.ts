import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/** Window height in px, kept up to date on resize. */
export function useViewportHeight(): number {
  return useSyncExternalStore(subscribe, () => window.innerHeight, () => 900)
}
