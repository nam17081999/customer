import { supabase } from '@/lib/supabaseClient'

const DEFAULT_EXCLUDED_KEYS = new Set([
  'created_at',
  'updated_at',
  'distance',
])

function normalizeNullableText(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null
  return Number.parseFloat(num.toFixed(6))
}

function normalizeValue(key, value) {
  if (key === 'latitude' || key === 'longitude') return normalizeCoordinate(value)
  if (typeof value === 'string') return normalizeNullableText(value)
  return value === undefined ? null : value
}

export function buildStoreDiff(beforeStore, afterPartial, options = {}) {
  const excludedKeys = options.excludedKeys || DEFAULT_EXCLUDED_KEYS
  const changes = {}

  const before = beforeStore && typeof beforeStore === 'object' ? beforeStore : {}
  const after = afterPartial && typeof afterPartial === 'object' ? afterPartial : {}

  for (const key of Object.keys(after)) {
    if (!key) continue
    if (excludedKeys && excludedKeys.has(key)) continue

    const beforeNorm = normalizeValue(key, before[key])
    const afterNorm = normalizeValue(key, after[key])

    const same = Object.is(beforeNorm, afterNorm)
    if (same) continue

    changes[key] = { from: beforeNorm, to: afterNorm }
  }

  return changes
}

export async function logStoreEditHistory({ storeId, actionType, actorUserId, actorRole, changes }) {
  if (!storeId || !actionType) return { ok: false, error: new Error('Missing storeId/actionType') }
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) return { ok: true, skipped: true }

  const payload = {
    store_id: storeId,
    action_type: actionType,
    actor_user_id: actorUserId || null,
    actor_role: actorRole || 'admin',
    changes,
  }

  const { error } = await supabase.from('store_edit_history').insert([payload])
  if (error) return { ok: false, error }
  return { ok: true }
}

export async function logStoreEditHistoryBatch(rows) {
  const payloads = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.store_id && row.action_type && row.changes && Object.keys(row.changes).length > 0)
    .map((row) => ({
      store_id: row.store_id,
      action_type: row.action_type,
      actor_user_id: row.actor_user_id || null,
      actor_role: row.actor_role || 'admin',
      changes: row.changes,
    }))

  if (payloads.length === 0) return { ok: true, skipped: true }

  const CHUNK_SIZE = 100
  for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
    const chunk = payloads.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('store_edit_history').insert(chunk)
    if (error) return { ok: false, error }
  }

  return { ok: true }
}

