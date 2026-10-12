/**
 * Files to import that arrive from anywhere in the app (dropped on another page): they wait here until the
 * Songs page picks them up, as it opens or straight away if it's already open. Kept tiny and free of
 * imports so the app shell can use it without loading the Songs page.
 */

let pending: File[] = []
const listeners = new Set<() => void>()
/** Files already handed over, so two drop handlers that see the same drop don't import it twice. */
const seen = new WeakSet<File>()

/** Ask the Songs page to import these files (navigate there yourself). */
export function requestImport(files: File[]) {
  const fresh = files.filter((f) => !seen.has(f))
  if (!fresh.length) return
  for (const f of fresh) seen.add(f)
  pending = [...pending, ...fresh]
  listeners.forEach((fn) => fn())
}

/** The files waiting to be imported; they're handed over once. */
export function takeImportRequest(): File[] {
  const files = pending
  pending = []
  return files
}

/** Calls `fn` whenever files are requested. Returns a function that stops listening. */
export function onImportRequest(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
