import { useSyncExternalStore } from 'react'

/** A tiny hash router: #/learn/u1-l2 → "/learn/u1-l2". Works anywhere, including GitHub Pages. */

const read = () => {
  const h = window.location.hash.slice(1)
  return h.split('?')[0] || '/'
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, read, () => '/')
}

export function go(path: string) {
  if (read() !== path) window.location.hash = path
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
