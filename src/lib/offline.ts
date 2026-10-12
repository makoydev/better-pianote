/**
 * The service worker (dist/sw.js, see vite.config.ts) keeps the whole app on the device. A new build installs in
 * the background and waits; the page offers "Reload" so an update never swaps screens under you mid-lesson.
 */

export const UPDATE_READY_EVENT = 'tonic:update-ready'

let waiting: ServiceWorker | null = null

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      const ready = (w: ServiceWorker) => {
        waiting = w
        window.dispatchEvent(new Event(UPDATE_READY_EVENT))
      }
      if (reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          // "installed" with a page already under an older worker means: a new version is waiting.
          if (w.state === 'installed' && navigator.serviceWorker.controller) ready(w)
        })
      })
      // The iPad app can stay open for days: look for a new version now and then.
      window.setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000)
    } catch {
      // No offline support here (private browsing, an old browser): the app still works online.
    }
  }
  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register(), { once: true })
}

/** Switch to the waiting version and reload. */
export function applyUpdate() {
  if (!waiting) return window.location.reload()
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  waiting.postMessage('skip-waiting')
}
