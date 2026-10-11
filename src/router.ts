import { useSyncExternalStore } from 'react'

/** A tiny hash router: #/learn/u1-l2 → "/learn/u1-l2". Works anywhere, including GitHub Pages. */

const read = () => {
  const h = window.location.hash.slice(1)
  return h.split('?')[0] || '/'
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** How you got to the current page: opened the app here, followed a link, or used Back/Forward. */
export type NavKind = 'load' | 'push' | 'pop'
let lastNav: NavKind = 'load'
export const navKind = (): NavKind => lastNav

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    lastNav = 'pop'
    notify()
  })
  // A typed URL or an old-style link changes the hash without going through go().
  window.addEventListener('hashchange', notify)
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, read, () => '/')
}

/** How many in-app pages are behind this one (0 when the app was opened right here). */
const depth = (): number => (window.history.state as { depth?: number } | null)?.depth ?? 0

/** Open a page. `replace` swaps the current history entry (e.g. lesson → next lesson), so Back skips it. */
export function go(path: string, opts: { replace?: boolean } = {}) {
  if (read() === path) return
  lastNav = 'push'
  const url = `#${path}`
  if (opts.replace) window.history.replaceState({ depth: depth() }, '', url)
  else window.history.pushState({ depth: depth() + 1 }, '', url)
  notify()
}

/** Back to the page you came from in the app, or up to `fallback` if you opened the app on this page. */
export function goBack(fallback: string) {
  if (depth() > 0) window.history.back()
  else go(fallback, { replace: true })
}

/** Match "/learn/:id" against a path; returns params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/')
  const a = path.split('/')
  if (p.length !== a.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}

export function queryParam(name: string): string | null {
  const h = window.location.hash
  const q = h.indexOf('?')
  return q < 0 ? null : new URLSearchParams(h.slice(q + 1)).get(name)
}
