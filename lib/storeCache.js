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
const STORE_VERSION_KEY = 'stores'
const STORE_VERSION_TABLE = 'store_cache_versions'
const FETCH_PAGE_SIZE = 1000
const SELECT_FIELDS = 'id,name,store_type,image_url,latitude,longitude,address_detail,ward,district,phone,phone_secondary,note,active,created_at,updated_at,is_potential,last_called_at,last_call_result,last_call_result_at,last_order_reported_at,sales_note'
const COUNT_CHECK_COOLDOWN_MS = 60_000 // 60 seconds
const VERSION_CHECK_COOLDOWN_MS = 15_000 // 15 seconds

// ── In-memory cache (module-level singleton) ──────────────────────────
let memCache = null        // { data: [...], count: number, cacheSavedAt: number, cacheVersion: number|null, lastSyncedAt: string|null } | null
let lastCountCheckAt = 0   // timestamp of last Supabase count query
let lastVersionCheckAt = 0 // timestamp of last Supabase version query
let inflightPromise = null // dedup: shared promise for concurrent callers

function parseVersion(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.trunc(parsed)
}

function toStoreIdKey(value) {
  return value == null ? '' : String(value)
}

function getMaxUpdatedAt(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  let maxUpdatedAt = null
  for (const store of data) {
    const updatedAt = store?.updated_at || null
    if (updatedAt && (!maxUpdatedAt || updatedAt > maxUpdatedAt)) {
      maxUpdatedAt = updatedAt
    }
  }
  return maxUpdatedAt
}

async function getServerStoreVersion() {
  try {
    const { data, error } = await supabase
      .from(STORE_VERSION_TABLE)
      .select('version')
      .eq('cache_key', STORE_VERSION_KEY)
      .single()

    if (error) return null
    return parseVersion(data?.version)
  } catch {
    return null
  }
}

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
          memCache = {
            data: result.data,
            count: result.count,
            cacheSavedAt: typeof result.cacheSavedAt === 'number' ? result.cacheSavedAt : 0,
            cacheVersion: parseVersion(result.cacheVersion),
            lastSyncedAt: typeof result.lastSyncedAt === 'string' ? result.lastSyncedAt : null,
          }
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
export async function setCachedStores(data, count, options = {}) {
  const normalizedCount = typeof count === 'number' ? count : (Array.isArray(data) ? data.length : 0)
  const cacheSavedAt = Date.now()
  const cacheVersion = parseVersion(options.cacheVersion)
  const lastSyncedAt = typeof options.lastSyncedAt === 'string'
    ? options.lastSyncedAt
    : getMaxUpdatedAt(data)
  memCache = { data, count: normalizedCount, cacheSavedAt, cacheVersion, lastSyncedAt }
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ data, count: normalizedCount, cacheSavedAt, cacheVersion, lastSyncedAt }, CACHE_KEY)
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
  lastVersionCheckAt = 0
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
 * Fetch all non-deleted stores from Supabase (paginated).
 * Falls back to `cached.data` (or []) if the network fails.
 * @param {{ data: Array }|null} cached - existing cache entry for fallback
 */
async function _fetchAllNonDeleted(cached, options = {}) {
  try {
    const serverVersion = parseVersion(options.serverVersion)
    const all = []
    let from = 0

    while (true) {
      const to = from + FETCH_PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('stores')
        .select(SELECT_FIELDS)
        .is('deleted_at', null)
        .range(from, to)

      if (error) throw error

      const pageData = Array.isArray(data) ? data : []
      all.push(...pageData)

      if (pageData.length < FETCH_PAGE_SIZE) break
      from += FETCH_PAGE_SIZE
    }

    await setCachedStores(all, all.length, {
      cacheVersion: serverVersion,
      lastSyncedAt: getMaxUpdatedAt(all),
    })
    lastCountCheckAt = Date.now()
    lastVersionCheckAt = Date.now()
    return all
  } catch {
    // Network failed — return stale cache if available
    if (cached) return cached.data
    return []
  }
}

async function _fetchServerNonDeletedCount() {
  const { count, error } = await supabase
    .from('stores')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (error) throw error
  return typeof count === 'number' ? count : null
}

async function _fetchChangedNonDeletedSince(cached, options = {}) {
  const baseData = Array.isArray(cached?.data) ? cached.data : []
  const since = cached?.lastSyncedAt || getMaxUpdatedAt(baseData)
  const serverVersion = parseVersion(options.serverVersion)
  if (!since || baseData.length === 0) {
    return _fetchAllNonDeleted(cached, { serverVersion })
  }

  try {
    const changedRows = []
    let from = 0

    while (true) {
      const to = from + FETCH_PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('stores')
        .select(SELECT_FIELDS)
        .is('deleted_at', null)
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .range(from, to)

      if (error) throw error

      const pageData = Array.isArray(data) ? data : []
      changedRows.push(...pageData)
      if (pageData.length < FETCH_PAGE_SIZE) break
      from += FETCH_PAGE_SIZE
    }

    const mergedById = new Map()
    baseData.forEach((store) => {
      const idKey = toStoreIdKey(store?.id)
      if (idKey) mergedById.set(idKey, store)
    })
    changedRows.forEach((store) => {
      const idKey = toStoreIdKey(store?.id)
      if (!idKey) return
      const existing = mergedById.get(idKey)
      mergedById.set(idKey, existing ? { ...existing, ...store } : store)
    })

    const mergedData = Array.from(mergedById.values())
    const dbCount = await _fetchServerNonDeletedCount()

    if (typeof dbCount === 'number' && dbCount !== mergedData.length) {
      return _fetchAllNonDeleted(cached, { serverVersion })
    }

    const nextSyncedAt = getMaxUpdatedAt(changedRows) || since
    await setCachedStores(mergedData, mergedData.length, {
      cacheVersion: serverVersion,
      lastSyncedAt: nextSyncedAt,
    })
    lastCountCheckAt = Date.now()
    lastVersionCheckAt = Date.now()
    return mergedData
  } catch {
    if (cached) return cached.data
    return []
  }
}

/**
 * Core logic — fetch or validate stores from Supabase.
 * Called only from getOrRefreshStores; never call directly.
 *
 * Strategy:
 *   - No IndexedDB cache  → fetch all rows where deleted_at IS NULL
 *   - Cache exists        → get (count, max updated_at) of non-deleted rows
 *                           from Supabase; if either differs, refetch all.
 *   - Network unavailable → fall back to cached data so search works offline.
 */
async function _fetchOrValidate() {
  const now = Date.now()
  const skipCheck = memCache && (now - lastCountCheckAt < COUNT_CHECK_COOLDOWN_MS)

  // Fast path: cooldown not expired & we have memory cache → instant return
  if (skipCheck) return memCache.data

  // 1) Check local cache (memory → IndexedDB)
  const cached = await getCachedStores()
  const hasCache = cached && Array.isArray(cached.data) && typeof cached.count === 'number'

  // If we have a recent cache write, prefer local data and skip any remote check.
  if (cached && (now - (cached.cacheSavedAt || 0) < COUNT_CHECK_COOLDOWN_MS)) {
    lastCountCheckAt = now
    return cached.data
  }

  // 2) No cache → fetch everything from Supabase (non-deleted only)
  if (!hasCache) {
    const serverVersion = await getServerStoreVersion()
    return _fetchAllNonDeleted(cached, { serverVersion })
  }

  // 3) Cache exists → preferred lightweight check: global version row
  if (now - lastVersionCheckAt >= VERSION_CHECK_COOLDOWN_MS) {
    const serverVersion = await getServerStoreVersion()
    lastVersionCheckAt = now

    if (serverVersion != null) {
      if (cached.cacheVersion != null && cached.cacheVersion === serverVersion) {
        lastCountCheckAt = now
        return cached.data
      }
      return _fetchChangedNonDeletedSince(cached, { serverVersion })
    }
  }

  // 4) Fallback when version table is unavailable: count + max updated_at
  let dbCount, dbMaxUpdatedAt
  try {
    const { data, count, error } = await supabase
      .from('stores')
      .select('updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) throw error
    dbCount = count
    dbMaxUpdatedAt = data?.[0]?.updated_at ?? null
    lastCountCheckAt = Date.now()
  } catch {
    // Network/Supabase unavailable — serve from cache
    return cached.data
  }

  // 5) Find max updated_at in local cache
  let cacheMaxUpdatedAt = null
  for (const s of cached.data) {
    if (s.updated_at && (!cacheMaxUpdatedAt || s.updated_at > cacheMaxUpdatedAt)) {
      cacheMaxUpdatedAt = s.updated_at
    }
  }

  // 6) If count and max updated_at both match → cache is fresh
  //    Use Date.parse() to avoid false mismatches from different ISO-string formats
  //    (e.g. "+00:00" vs "Z" suffix returned by different Supabase query paths)
  const dbMaxUpdatedAtMs = dbMaxUpdatedAt ? Date.parse(dbMaxUpdatedAt) : null
  const cacheMaxUpdatedAtMs = cacheMaxUpdatedAt ? Date.parse(cacheMaxUpdatedAt) : null
  const maxUpdatedAtMatches = (
    (dbMaxUpdatedAtMs == null && cacheMaxUpdatedAtMs == null)
    || (
      Number.isFinite(dbMaxUpdatedAtMs)
      && Number.isFinite(cacheMaxUpdatedAtMs)
      && dbMaxUpdatedAtMs === cacheMaxUpdatedAtMs
    )
  )

  if (dbCount === cached.data.length && maxUpdatedAtMatches) {
    return cached.data
  }

  // 7) Something changed (new store, edit, or soft-delete) → refetch
  return _fetchAllNonDeleted(cached)
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
    const targetId = toStoreIdKey(newStore.id)
    const existingIndex = targetId
      ? cached.data.findIndex((store) => toStoreIdKey(store?.id) === targetId)
      : -1
    const updatedData = existingIndex >= 0
      ? cached.data.map((store, index) => (index === existingIndex ? { ...store, ...newStore } : store))
      : [...cached.data, newStore]
    const nextVersion = cached.cacheVersion != null ? cached.cacheVersion + 1 : null
    await setCachedStores(updatedData, updatedData.length, { cacheVersion: nextVersion })
    lastCountCheckAt = Date.now()
  } catch {
    // silently ignore — next load will refetch
  }
}

/**
 * Append multiple stores to the cache and increment count.
 * Skips ids already present in cache.
 * @param {Array<Object>} newStores
 */
export async function appendStoresToCache(newStores) {
  if (!Array.isArray(newStores) || newStores.length === 0) return
  try {
    const cached = await getCachedStores()
    if (!cached) return

    const byId = new Map()
    cached.data.forEach((store) => {
      const idKey = toStoreIdKey(store?.id)
      if (idKey) byId.set(idKey, store)
    })

    let hasNewStore = false
    newStores.forEach((store) => {
      const idKey = toStoreIdKey(store?.id)
      if (!idKey) return
      const existing = byId.get(idKey)
      byId.set(idKey, existing ? { ...existing, ...store } : store)
      if (!existing) hasNewStore = true
    })

    if (!hasNewStore) return

    const nextVersion = cached.cacheVersion != null ? cached.cacheVersion + 1 : null
    const updatedData = Array.from(byId.values())
    await setCachedStores(updatedData, updatedData.length, { cacheVersion: nextVersion })
    lastCountCheckAt = Date.now()
  } catch {
    // silently ignore — next load will refetch
  }
}

/**
 * Remove a single store from cache (memory + IndexedDB).
 * Returns the resulting cache length for consistency checks.
 * @param {string|number} storeId
 * @returns {Promise<{removed:boolean, cacheLength:number|null}>}
 */
export async function removeStoreFromCache(storeId) {
  if (storeId == null) return { removed: false, cacheLength: null }
  try {
    const cached = await getCachedStores()
    if (!cached || !Array.isArray(cached.data)) {
      return { removed: false, cacheLength: null }
    }

    const prevData = cached.data
    const targetId = String(storeId)
    const updatedData = prevData.filter((store) => String(store?.id) !== targetId)
    const removed = updatedData.length !== prevData.length
    const nextCount = updatedData.length

    const nextVersion = cached.cacheVersion != null ? cached.cacheVersion + 1 : null
    await setCachedStores(updatedData, nextCount, { cacheVersion: nextVersion })
    lastCountCheckAt = Date.now()
    return { removed, cacheLength: updatedData.length }
  } catch {
    return { removed: false, cacheLength: null }
  }
}

/**
 * Merge a partial update into one cached store by id.
 * @param {string|number} storeId
 * @param {Object} patch
 * @returns {Promise<{updated:boolean}>}
 */
export async function updateStoreInCache(storeId, patch) {
  if (storeId == null || !patch || typeof patch !== 'object') return { updated: false }
  try {
    const cached = await getCachedStores()
    if (!cached || !Array.isArray(cached.data)) {
      return { updated: false }
    }

    const targetId = String(storeId)
    let updated = false
    const nextData = cached.data.map((store) => {
      if (String(store?.id) !== targetId) return store
      updated = true
      return { ...store, ...patch }
    })

    if (!updated) return { updated: false }
    const nextVersion = cached.cacheVersion != null ? cached.cacheVersion + 1 : null
    await setCachedStores(nextData, cached.count, { cacheVersion: nextVersion })
    lastCountCheckAt = Date.now()
    return { updated: true }
  } catch {
    return { updated: false }
  }
}

/**
 * Merge partial updates into multiple cached stores.
 * @param {Array<{id:string|number} & Object>} updates
 * @returns {Promise<{updatedCount:number}>}
 */
export async function updateStoresInCache(updates) {
  if (!Array.isArray(updates) || updates.length === 0) return { updatedCount: 0 }
  try {
    const cached = await getCachedStores()
    if (!cached || !Array.isArray(cached.data)) {
      return { updatedCount: 0 }
    }

    const updatesById = new Map()
    updates.forEach((item) => {
      const idKey = toStoreIdKey(item?.id)
      if (!idKey) return
      const prev = updatesById.get(idKey) || {}
      updatesById.set(idKey, { ...prev, ...item })
    })

    if (updatesById.size === 0) return { updatedCount: 0 }

    let updatedCount = 0
    const nextData = cached.data.map((store) => {
      const patch = updatesById.get(toStoreIdKey(store?.id))
      if (!patch) return store
      updatedCount += 1
      return { ...store, ...patch }
    })

    if (updatedCount === 0) return { updatedCount: 0 }
    const nextVersion = cached.cacheVersion != null ? cached.cacheVersion + 1 : null
    await setCachedStores(nextData, cached.count, { cacheVersion: nextVersion })
    lastCountCheckAt = Date.now()
    return { updatedCount }
  } catch {
    return { updatedCount: 0 }
  }
}
