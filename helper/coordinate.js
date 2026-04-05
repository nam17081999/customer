export function parseCoordinate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string') return NaN

  const trimmed = value.trim()
  if (!trimmed) return NaN

  const parsed = Number.parseFloat(trimmed.replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

export function hasValidCoordinates(lat, lng) {
  return (
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
  )
}
