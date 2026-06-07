'use client'

import { getFeed, getUnreadCounts, getTotalUnread, markRead as apiMarkRead, markAllRead as apiMarkAllRead, getPreferences } from '@/api/notifications/notification-api-client'

// ─── In-memory store ──────────────────────────────────────────────
let cachedFeed = []
let cachedPrefs = {}
let feedListeners = []
let prefsListeners = []
let unreadCountListeners = []

function notifyFeed() {
  for (const fn of feedListeners) fn(cachedFeed)
}
function notifyPrefs() {
  for (const fn of prefsListeners) fn(cachedPrefs)
}
function notifyUnreadCount(total) {
  for (const fn of unreadCountListeners) fn(total)
}

// ─── Feed ─────────────────────────────────────────────────────────

export async function loadFeed(limit = 50, offset = 0) {
  try {
    const feed = await getFeed(limit, offset)
    if (!Array.isArray(feed)) {
      console.warn('[notif-store] invalid feed response, keeping cache')
      return cachedFeed
    }
    cachedFeed = feed
    notifyFeed()
    return feed
  } catch (e) {
    console.warn('[notif-store] loadFeed failed, keeping cache:', e.message)
    return cachedFeed
  }
}

export function getCachedFeed() {
  return cachedFeed
}

/** Thêm entry vào cache local (ko cần gọi API load lại) */
export function appendToFeed(newEntry) {
  // Chỉ thêm nếu chưa tồn tại
  if (cachedFeed.some(e => e.id === newEntry.id)) return
  cachedFeed = [{ ...newEntry, is_read: false }, ...cachedFeed]
  notifyFeed()
  const total = cachedFeed.filter(e => !e.is_read).length
  notifyUnreadCount(total)
}

export function subscribeFeed(fn) {
  feedListeners.push(fn)
  return () => { feedListeners = feedListeners.filter(f => f !== fn) }
}

export async function markFeedRead(feedId) {
  await apiMarkRead(feedId).catch(() => {})
  cachedFeed = cachedFeed.map(e =>
    e.id === feedId ? { ...e, is_read: true } : e
  )
  notifyFeed()
  // Update unread count silently (no API call)
  const total = cachedFeed.filter(e => !e.is_read).length
  notifyUnreadCount(total)
}

export async function markAllFeedRead(type = null) {
  await apiMarkAllRead(type).catch(() => {})
  cachedFeed = cachedFeed.map(e =>
    (type === null || e.type === type) ? { ...e, is_read: true } : e
  )
  notifyFeed()
  const total = cachedFeed.filter(e => !e.is_read).length
  notifyUnreadCount(total)
}

// ─── Unread count (cached, no API unless forced) ───────────────────

let _cachedUnreadTotal = 0
let _lastCountFetch = 0

export async function refreshUnreadCount(force = false) {
  const now = Date.now()
  // Cache 10s
  if (!force && now - _lastCountFetch < 10000) return _cachedUnreadTotal

  try {
    const total = await getTotalUnread()
    _cachedUnreadTotal = total
    _lastCountFetch = now
    notifyUnreadCount(total)
    return total
  } catch {
    return _cachedUnreadTotal
  }
}

export function subscribeUnreadCount(fn) {
  unreadCountListeners.push(fn)
  return () => { unreadCountListeners = unreadCountListeners.filter(f => f !== fn) }
}

export function getCachedUnreadCount() {
  return _cachedUnreadTotal
}

export async function getUnreadCountsByType() {
  return await getUnreadCounts()
}

// ─── Preferences ─────────────────────────────────────────────────

export async function loadPreferences() {
  const prefs = await getPreferences()
  cachedPrefs = prefs
  notifyPrefs()
  return prefs
}

export function getCachedPreferences() {
  return cachedPrefs
}

export function subscribePreferences(fn) {
  prefsListeners.push(fn)
  return () => { prefsListeners = prefsListeners.filter(f => f !== fn) }
}

export async function setPreference(type, enabled) {
  const { setPreference: apiSet } = await import('@/api/notifications/notification-api-client')
  await apiSet(type, enabled)
  cachedPrefs = { ...cachedPrefs, [type]: enabled }
  notifyPrefs()
}
