export const HEADING_JITTER_DEG = 6
export const HEADING_SMOOTHING_ALPHA = 0.22
export const MAP_EASE_DURATION_MS = 900

export function normalizeHeading(deg) {
  if (!Number.isFinite(deg)) return null
  return ((deg % 360) + 360) % 360
}

export function shortestHeadingDelta(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180
}

export function smoothHeading(previous, next) {
  const prev = normalizeHeading(previous)
  const nextNorm = normalizeHeading(next)
  if (nextNorm == null) return null
  if (prev == null) return nextNorm

  const delta = shortestHeadingDelta(prev, nextNorm)
  if (Math.abs(delta) <= HEADING_JITTER_DEG) return prev

  return normalizeHeading(prev + (delta * HEADING_SMOOTHING_ALPHA))
}

export function resolveCurrentHeading({
  permissionHeading = null,
  locationHeading = null,
  previousHeading = null,
}) {
  const nextHeading = permissionHeading ?? locationHeading ?? previousHeading
  const normalizedHeading = normalizeHeading(nextHeading)
  return smoothHeading(previousHeading, normalizedHeading)
}

export function hasValidUserLocation(userLocation) {
  return Number.isFinite(userLocation?.latitude) && Number.isFinite(userLocation?.longitude)
}

export function buildUserCameraPayload(userLocation) {
  if (!hasValidUserLocation(userLocation)) return null

  return {
    center: [userLocation.longitude, userLocation.latitude],
    ...(userLocation.heading != null ? { bearing: userLocation.heading } : {}),
    duration: MAP_EASE_DURATION_MS,
    essential: true,
  }
}

export function shouldBuildRouteOnFollowStart({ routeStopsLength = 0, routeFeatureCount = 0 }) {
  return routeStopsLength > 0 && routeFeatureCount === 0
}
