'use client'

import { db } from '@/api/db/client'

// ─── Feed ─────────────────────────────────────────────────────────

/** Get my feed (filtered by my preferences, with read state) */
export async function getFeed(limit = 50, offset = 0) {
  const { data, error } = await db
    .rpc('get_notification_feed', { p_limit: limit, p_offset: offset })

  if (error) {
    console.warn('[notif-api] getFeed failed:', error.message)
    return []
  }
  return data || []
}

// ─── Read state ──────────────────────────────────────────────────

export async function markRead(feedId) {
  const { error } = await db.rpc('mark_feed_read', { p_feed_id: feedId })
  if (error) console.warn('[notif-api] markRead failed:', error.message)
}

export async function markAllRead(type = null) {
  const { error } = await db.rpc('mark_all_feed_read', { p_type: type })
  if (error) console.warn('[notif-api] markAllRead failed:', error.message)
}

// ─── Unread counts ───────────────────────────────────────────────

export async function getUnreadCounts() {
  const { data, error } = await db.rpc('get_unread_notification_counts')
  if (error) {
    console.warn('[notif-api] getUnreadCounts failed:', error.message)
    return {}
  }

  const map = {}
  for (const row of data || []) {
    map[row.type] = Number(row.cnt)
  }
  return map
}

/** Total unread (sum of all types) */
export async function getTotalUnread() {
  const counts = await getUnreadCounts()
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

// ─── Preferences ─────────────────────────────────────────────────

export async function getPreferences() {
  const { data, error } = await db.rpc('get_notification_preferences')
  if (error) {
    console.warn('[notif-api] getPreferences failed:', error.message)
    return {}
  }

  const map = {}
  for (const row of data || []) {
    map[row.type] = row.enabled
  }
  return map
}

export async function setPreference(type, enabled) {
  const { error } = await db.rpc('set_notification_preference', {
    p_type: type,
    p_enabled: enabled,
  })
  if (error) console.warn('[notif-api] setPreference failed:', error.message)
}

// ─── Insert into feed (for system use) ───────────────────────────

export async function insertIntoFeed({ id, type, title, detail, data: payload }) {
  const { error } = await db.rpc('insert_notification', {
    p_id: id,
    p_type: type,
    p_title: title,
    p_detail: detail,
    p_data: payload || null,
  })
  if (error) console.warn('[notif-api] insertIntoFeed failed:', error.message)
}
