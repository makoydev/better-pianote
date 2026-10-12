/*
 * Tonic's service worker: after the first visit the whole app works offline (screens, fonts, the piano samples).
 * vite.config.ts fills in VERSION and FILES (everything in the build) and writes this to dist/sw.js.
 *
 * - Everything is served from the cache first; a new build installs alongside and waits.
 * - The page shows "New version ready · Reload"; Reload tells the waiting worker to take over.
 */
const VERSION = '__VERSION__'
const FILES = __FILES__
const CACHE = `tonic-${VERSION}`
const scope = self.registration.scope
const url = (f) => new URL(f, scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', ...FILES.filter((f) => f !== 'index.html')].map(url))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('tonic-') && key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return
  if (req.mode === 'navigate') {
    // The app is one page: open the cached version (it matches the cached files); fall back to the network.
    event.respondWith(caches.match(url('./'), { ignoreVary: true }).then((hit) => hit ?? fetch(req)))
    return
  }
  event.respondWith(
    // ignoreVary: module scripts carry an Origin header the pre-download didn't, and built files never change.
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          // Anything the build list missed is kept for next time.
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        }),
    ),
  )
})
