import { haversineKm } from '@/helper/distance'

export const NEARBY_STORES_LIMIT = 50

function normalizeLimit(limit) {
  const normalized = Number(limit)
  if (!Number.isFinite(normalized) || normalized <= 0) return 0
  return Math.floor(normalized)
}

function isValidCoords(coords) {
  return Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
}

function sortDescendingByDistance(items) {
  items.sort((a, b) => b.distance - a.distance)
}

export function selectNearestStores(stores, lat, lng, limit = NEARBY_STORES_LIMIT) {
  const safeLimit = normalizeLimit(limit)
  if (!safeLimit || !Number.isFinite(lat) || !Number.isFinite(lng)) return []

  const nearest = []
  const safeStores = Array.isArray(stores) ? stores : []

  for (const store of safeStores) {
    if (!isValidCoords(store?.coords)) continue

    const distance = haversineKm(lat, lng, store.coords.lat, store.coords.lng)
    if (!Number.isFinite(distance)) continue

    if (nearest.length < safeLimit) {
      nearest.push({ ...store, distance })
      sortDescendingByDistance(nearest)
      continue
    }

    if (distance >= nearest[0].distance) continue
    nearest[0] = { ...store, distance }
    sortDescendingByDistance(nearest)
  }

  return nearest.sort((a, b) => a.distance - b.distance)
}

export function buildNearbyStoresSignature(stores) {
  return (Array.isArray(stores) ? stores : [])
    .map((store) => String(store?.id ?? ''))
    .join('|')
}
