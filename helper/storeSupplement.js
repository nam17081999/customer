import { hasValidCoordinates, parseCoordinate } from '@/helper/coordinate'

function hasText(value) {
  return Boolean(String(value ?? '').trim())
}

export function hasStoreCoordinates(store) {
  if (!store) return false
  const lat = parseCoordinate(store.latitude)
  const lng = parseCoordinate(store.longitude)
  return hasValidCoordinates(lat, lng)
}

export function hasStoreSupplementOpportunity(store) {
  if (!store) return false
  return (
    !hasText(store.store_type) ||
    !hasText(store.address_detail) ||
    !hasText(store.ward) ||
    !hasText(store.district) ||
    !hasText(store.phone) ||
    !hasText(store.note) ||
    !hasStoreCoordinates(store)
  )
}
