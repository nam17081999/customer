/**
 * Duplicate-detection utilities for store names.
 *
 * Normalises Vietnamese text, strips common "ignored" business-type prefixes,
 * and compares remaining keywords to find nearby or global duplicates.
 */

import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { haversineKm } from '@/helper/distance'
import { getOrRefreshStores } from '@/lib/storeCache'

/** Common business-type words that should be ignored when comparing names. */
export const IGNORED_NAME_TERMS = [
  'cửa hàng',
  'tạp hoá',
  'quán nước',
  'giải khát',
  'nhà nghỉ',
  'nhà hàng',
  'cyber cà phê',
  'cafe',
  'lẩu',
  'siêu thị',
  'quán',
  'gym',
  'đại lý',
  'cơm',
  'phở',
  'bún',
  'shop',
  'kok',
  'karaoke',
  'bi-a',
  'bia',
  'net',
  'game',
  'internet',
  'beer',
  'coffee',
  'mart',
  'store',
  'minimart',
]

/** Quick-pick labels shown on the create-store form. */
export const NAME_SUGGESTIONS = [
  'Cửa hàng',
  'Tạp hoá',
  'Quán nước',
  'Karaoke',
  'Nhà hàng',
  'Quán',
  'Cafe',
  'Siêu thị',
]

// ── Internal helpers ────────────────────────────────────────────────────

export function normalizeNameForMatch(raw) {
  const base = removeVietnameseTones(String(raw || ''))
  return base
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripIgnoredPhrases(normalized) {
  const ignoredList = IGNORED_NAME_TERMS
    .map((t) => normalizeNameForMatch(t))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  let out = ` ${normalized} `
  for (const phrase of ignoredList) {
    if (!phrase) continue
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'g')
    out = out.replace(re, ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function extractWords(normalized) {
  const cleaned = stripIgnoredPhrases(normalized)
  return cleaned
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
}

// ── Comparison functions ────────────────────────────────────────────────

/** Returns true if *any* keyword from `inputWords` appears in the store name. */
export function isSimilarNameByWords(inputWords, storeName, storeNameSearch) {
  const storeNorm = normalizeNameForMatch(storeNameSearch || storeName || '')
  if (!storeNorm || inputWords.length === 0) return false
  const storeWords = extractWords(storeNorm)
  if (storeWords.length === 0) return false
  const storeSet = new Set(storeWords)
  for (const w of inputWords) {
    if (storeSet.has(w)) return true
  }
  return false
}

/** Returns true if *all* keywords from `inputWords` appear in the store name. */
export function containsAllInputWords(inputWords, storeName, storeNameSearch) {
  if (!Array.isArray(inputWords) || inputWords.length === 0) return false
  const storeNorm = normalizeNameForMatch(storeNameSearch || storeName || '')
  if (!storeNorm) return false
  const storeWords = extractWords(storeNorm)
  if (storeWords.length === 0) return false
  const storeSet = new Set(storeWords)
  for (const w of inputWords) {
    if (!storeSet.has(w)) return false
  }
  return true
}

// ── High-level search helpers ───────────────────────────────────────────

/**
 * Find stores within `radiusKm` that share at least one keyword with `inputName`.
 */
export async function findNearbySimilarStores(lat, lng, inputName, radiusKm = 0.1) {
  const inputNorm = normalizeNameForMatch(inputName)
  if (!inputNorm || lat == null || lng == null) return []
  const inputWords = extractWords(inputNorm)
  if (inputWords.length === 0) return []

  const allStores = await getOrRefreshStores()

  return allStores
    .filter((s) => isFinite(s?.latitude) && isFinite(s?.longitude))
    .map((s) => ({ ...s, distance: haversineKm(lat, lng, s.latitude, s.longitude) }))
    .filter((s) => s.distance <= radiusKm && isSimilarNameByWords(inputWords, s.name, s.name_search))
    .sort((a, b) => a.distance - b.distance)
}

/**
 * Find stores anywhere whose name contains *all* keywords from `inputName`.
 */
export async function findGlobalExactNameMatches(inputName) {
  const inputNorm = normalizeNameForMatch(inputName)
  if (!inputNorm) return []

  const inputWords = extractWords(inputNorm)
  if (inputWords.length === 0) return []

  const allStores = await getOrRefreshStores()

  return allStores
    .filter((s) => containsAllInputWords(inputWords, s.name, s.name_search))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
}

/**
 * Merge nearby + global duplicate candidates, de-duplicate by id, sort by distance first.
 */
export function mergeDuplicateCandidates(nearbyMatches = [], globalMatches = []) {
  const byId = new Map()
  globalMatches.forEach((s) => {
    byId.set(s.id, { ...s, matchScope: 'global' })
  })
  nearbyMatches.forEach((s) => {
    const existing = byId.get(s.id)
    byId.set(s.id, {
      ...(existing || {}),
      ...s,
      matchScope: existing ? 'nearby+global' : 'nearby',
    })
  })

  return Array.from(byId.values()).sort((a, b) => {
    const aHasDistance = typeof a.distance === 'number'
    const bHasDistance = typeof b.distance === 'number'
    if (aHasDistance && bHasDistance) return a.distance - b.distance
    if (aHasDistance) return -1
    if (bHasDistance) return 1
    return (a.name || '').localeCompare(b.name || '', 'vi')
  })
}
