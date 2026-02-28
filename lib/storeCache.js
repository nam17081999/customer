/**
 * Shared store cache with 3 layers:
 *   1. In-memory (module-level) — instant, no I/O
 *   2. IndexedDB — persists across page reloads
 *   3. Supabase — source of truth
 *
 * Optimizations:
 *   - Count check cooldown (COUNT_CHECK_COOLDOWN_MS) — avoids hitting
 *     Supabase on every page navigation
 *   - Promise deduplication — concurrent callers share one in-flight request
 *   - In-memory layer — avoids repeated IndexedDB reads within a session
 */

import { supabase } from '@/lib/supabaseClient'

const DB_NAME = 'storevis_cache'
const DB_VERSION = 1
const STORE_NAME = 'map_stores'
const CACHE_KEY = 'all'
const FETCH_PAGE_SIZE = 1000
const SELECT_FIELDS = 'id,name,image_url,latitude,longitude,address_detail,ward,district,phone,note,active,created_at'
const COUNT_CHECK_COOLDOWN_MS = 60_000 // 60 seconds

// ── In-memory cache (module-level singleton) ──────────────────────────
let memCache = null        // { data: [...], count: number } | null
let lastCountCheckAt = 0   // timestamp of last Supabase count query
let inflightPromise = null // dedup: shared promise for concurrent callers

// ── IndexedDB helpers ─────────────────────────────────────────────────
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
  // Return from memory first
  if (memCache) return memCache

  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(CACHE_KEY)
      request.onsuccess = () => {
        const result = request.result
        if (result && Array.isArray(result.data) && typeof result.count === 'number') {
          memCache = { data: result.data, count: result.count }
          resolve(memCache)
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
 * Write stores + count to both in-memory cache and IndexedDB.
 */
export async function setCachedStores(data, count) {
  memCache = { data, count }
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
    // IndexedDB unavailable – in-memory cache still works
  }
}

/**
 * Invalidate (clear) the store cache — both in-memory and IndexedDB.
 * Call this after updating/deleting a store.
 */
export async function invalidateStoreCache() {
  memCache = null
  lastCountCheckAt = 0
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

/**
 * Core logic — fetch or validate stores from Supabase.
 * Called only from getOrRefreshStores; never call directly.
 *
 * When the network is unavailable (offline), the function gracefully
 * falls back to cached data (memory → IndexedDB) instead of throwing,
 * so search still works offline.
 */
async function _fetchOrValidate() {
  const now = Date.now()
  const skipCountCheck = memCache && (now - lastCountCheckAt < COUNT_CHECK_COOLDOWN_MS)

  // Fast path: cooldown not expired & we have memory cache → instant return
  if (skipCountCheck) {
    return memCache.data
  }

  // 1) Quick count (very cheap — head: true)
  let dbCount
  try {
    const { count, error: countErr } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })

    if (countErr) throw countErr
    dbCount = count
    lastCountCheckAt = Date.now()
  } catch {
    // Network/Supabase unavailable — fall back to cached data
    const cached = await getCachedStores()
    if (cached) return cached.data
    return [] // no cache at all — return empty rather than crash
  }

  // 2) Check cache (memory → IndexedDB)
  const cached = await getCachedStores()
  if (cached && cached.count === dbCount) {
    return cached.data
  }

  // 3) Fetch all rows (paginated)
  let all
  try {
    all = []
    let from = 0

    while (true) {
      const to = from + FETCH_PAGE_SIZE - 1
      const { data, error: queryError } = await supabase
        .from('stores')
        .select(SELECT_FIELDS)
        .range(from, to)

      if (queryError) throw queryError

      const pageData = Array.isArray(data) ? data : []
      all.push(...pageData)

      if (pageData.length < FETCH_PAGE_SIZE) break
      from += FETCH_PAGE_SIZE
    }
  } catch {
    // Network failed mid-fetch — return stale cache if available
    if (cached) return cached.data
    return []
  }

  // 4) Update both caches
  await setCachedStores(all, dbCount)

  return all
}

/**
 * Get all stores — the ONLY function pages should call.
 *
 * Layers of optimization:
 *   1. If cooldown hasn't expired → return in-memory data instantly (0 I/O)
 *   2. If count matches → return from memory/IndexedDB (0 row-reads)
 *   3. Otherwise fetch all rows, update caches, return fresh data
 *   4. Concurrent callers share a single in-flight promise (dedup)
 *
 * @returns {Promise<Array>} all store rows
 */
export async function getOrRefreshStores() {
  // Dedup: if a request is already in-flight, piggyback on it
  if (inflightPromise) return inflightPromise

  inflightPromise = _fetchOrValidate().finally(() => {
    inflightPromise = null
  })

  return inflightPromise
}

/**
 * Append a single new store to the cache and increment count.
 * Updates both in-memory and IndexedDB. Resets cooldown so the
 * next getOrRefreshStores call won't skip the count check.
 * @param {Object} newStore - the newly created store row
 */
export async function appendStoreToCache(newStore) {
  if (!newStore) return
  try {
    const cached = await getCachedStores()
    if (!cached) return // no cache to append to
    const updatedData = [...cached.data, newStore]
    await setCachedStores(updatedData, cached.count + 1)
  } catch {
    // silently ignore — next load will refetch
  }
}
