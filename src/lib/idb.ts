/** A tiny promise wrapper around one IndexedDB object store (keyed by `id`). */

const DB_NAME = 'tonic'
const DB_VERSION = 1
export const STORES = ['songs'] as const
type Store = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open storage'))
    req.onblocked = () => reject(new Error('Storage is busy in another tab'))
  })
  dbPromise.catch(() => (dbPromise = null))
  return dbPromise
}

function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error ?? req.error ?? new Error('Storage error'))
        tx.onabort = () => reject(tx.error ?? new Error('Storage was full or blocked'))
      }),
  )
}

export const idbAll = <T>(store: Store) => run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
export const idbPut = <T>(store: Store, value: T) => run(store, 'readwrite', (s) => s.put(value)).then(() => undefined)
export const idbDelete = (store: Store, id: string) => run(store, 'readwrite', (s) => s.delete(id)).then(() => undefined)
