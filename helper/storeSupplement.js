function parseCoordinate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string') return NaN
  const trimmed = value.trim()
  if (!trimmed) return NaN
  const parsed = Number.parseFloat(trimmed.replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

function hasText(value) {
  return Boolean(String(value ?? '').trim())
}

export function hasStoreCoordinates(store) {
  if (!store) return false
  const lat = parseCoordinate(store.latitude)
  const lng = parseCoordinate(store.longitude)
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
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
    !hasText(store.image_url) ||
    !hasStoreCoordinates(store)
  )
}
