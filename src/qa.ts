/**
 * Test mode, only when the URL has ?static (e.g. http://[::1]:5392/?static#/learn).
 * A background browser tab gets no animation frames, so animations would freeze mid-way in
 * automated screenshots. Here frames run on timers and animations jump to their end.
 * Imported first in main.tsx, before the animation library reads requestAnimationFrame.
 */
export const STATIC = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('static')

if (STATIC) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16)
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id)
}
