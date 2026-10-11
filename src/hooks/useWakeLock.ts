import { useEffect } from 'react'

/**
 * Keep the screen on while `active` (practising at the piano you rarely touch it, and on an iPad a locked
 * screen also stops the mic). The browser drops the lock when the page is hidden, so take it again on return.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (stopped) void l.release()
        else lock = l
      } catch {
        // Not allowed right now (e.g. low battery mode): the screen just sleeps as usual.
      }
    }
    const onVisibility = () => void request()
    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibility)
      void lock?.release()
    }
  }, [active])
}
