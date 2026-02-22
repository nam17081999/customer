/**
 * Shared store cache using IndexedDB to minimize Supabase API calls.
 * Validates cache by comparing stored count with current DB count.
 * IndexedDB is async & handles large datasets (2000+ stores) without blocking the UI.
 */

const DB_NAME = 'storevis_cache'
const DB_VERSION = 1
const STORE_NAME = 'map_stores'
const CACHE_KEY = 'all'

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not available'))
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Read cached stores + count from IndexedDB.
 * Returns { data, count } or null if cache is missing/corrupt.
 */
export async function getCachedStores() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(CACHE_KEY)
      request.onsuccess = () => {
        const result = request.result
        if (result && Array.isArray(result.data) && typeof result.count === 'number') {
          resolve({ data: result.data, count: result.count })
        } else {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Write stores + count to IndexedDB cache.
 */
export async function setCachedStores(data, count) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ data, count }, CACHE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // IndexedDB unavailable – silently ignore
  }
}

/**
 * Invalidate (clear) the store cache.
 * Call this after creating/updating/deleting a store.
 */
export async function invalidateStoreCache() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(CACHE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // silently ignore
  }
}
