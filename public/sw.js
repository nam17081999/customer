/**
 * Service Worker for StoreVis PWA
 *
 * Strategy:
 *   - App shell (HTML/JS/CSS): Cache-first with network fallback
 *   - API calls & Supabase: Network-first with cache fallback
 *   - Images (ImageKit): Cache-first with network fallback
 *   - Map tiles (OSM): Cache-first with network fallback
 *   - Offline fallback page for navigation requests
 */

const CACHE_VERSION = 'v1'
const APP_CACHE = `storevis-app-${CACHE_VERSION}`
const DATA_CACHE = `storevis-data-${CACHE_VERSION}`
const IMG_CACHE = `storevis-img-${CACHE_VERSION}`
const TILE_CACHE = `storevis-tiles-${CACHE_VERSION}`

const ALL_CACHES = [APP_CACHE, DATA_CACHE, IMG_CACHE, TILE_CACHE]

// Pages & assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/store/create',
  '/map',
  '/manifest.json',
]

// ── Install ─────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache partial fail:', err)
      })
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// ── Activate — clean old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  // Claim all clients immediately
  self.clients.claim()
})

// ── Fetch ───────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET
  if (request.method !== 'GET') return

  // Skip chrome-extension, etc.
  if (!url.protocol.startsWith('http')) return

  // ── Connectivity check — always go to network (bypass cache) ───────
  if (url.searchParams.has('__connectivity_check')) return

  // ── Map tiles (OSM) — Cache-first ─────────────────────────────────
  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(cacheFirst(request, TILE_CACHE, 30 * 24 * 60 * 60 * 1000)) // 30 days
    return
  }

  // ── ImageKit images — Cache-first ──────────────────────────────────
  if (url.hostname === 'ik.imagekit.io') {
    event.respondWith(cacheFirst(request, IMG_CACHE, 7 * 24 * 60 * 60 * 1000)) // 7 days
    return
  }

  // ── Supabase API — Network-first ───────────────────────────────────
  if (url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }

  // ── API routes — Network only (no cache for mutations) ─────────────
  if (url.pathname.startsWith('/api/')) {
    return // let browser handle
  }

  // ── Next.js data/static assets — Cache-first ──────────────────────
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(cacheFirst(request, APP_CACHE))
    return
  }

  // ── Navigation (HTML pages) — Network-first with offline fallback ──
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      networkFirst(request, APP_CACHE).catch(() => {
        return caches.match('/') || new Response(
          '<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#000;color:#fff"><div style="text-align:center"><h2>Bạn đang offline</h2><p>Vui lòng kiểm tra kết nối mạng</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      })
    )
    return
  }

  // ── Everything else — Cache-first ──────────────────────────────────
  event.respondWith(cacheFirst(request, APP_CACHE))
})

// ── Cache strategies ────────────────────────────────────────────────────

/**
 * Cache-first: return cached response if available, else fetch & cache.
 */
async function cacheFirst(request, cacheName, maxAge) {
  const cached = await caches.match(request)
  if (cached) {
    // Optional TTL check
    if (maxAge) {
      const dateHeader = cached.headers.get('sw-cached-at')
      if (dateHeader) {
        const cachedAt = parseInt(dateHeader, 10)
        if (Date.now() - cachedAt > maxAge) {
          // Expired — fetch in background, return stale
          fetchAndCache(request, cacheName).catch(() => {})
        }
      }
    }
    return cached
  }
  return fetchAndCache(request, cacheName)
}

/**
 * Network-first: try network, fall back to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      const cloned = response.clone()
      // Add timestamp header for TTL
      const headers = new Headers(cloned.headers)
      headers.set('sw-cached-at', String(Date.now()))
      const body = await cloned.blob()
      cache.put(request, new Response(body, { status: cloned.status, statusText: cloned.statusText, headers }))
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    throw new Error('Network failed and no cache available')
  }
}

/**
 * Fetch, clone, and put in cache.
 */
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    const cloned = response.clone()
    const headers = new Headers(cloned.headers)
    headers.set('sw-cached-at', String(Date.now()))
    const body = await cloned.blob()
    cache.put(request, new Response(body, { status: cloned.status, statusText: cloned.statusText, headers }))
  }
  return response
}

// ── Background sync: offline store queue ────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
