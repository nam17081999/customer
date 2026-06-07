import { parseCoordinate } from '@/helper/coordinate'

/**
 * Register an event listener on a MapLibre map with automatic cleanup.
 * Supports both (map, event, layer, handler) and (map, event, handler) signatures.
 */
export function addMapEventListener(map, eventName, layerOrHandler, maybeHandler) {
  if (typeof maybeHandler === 'function') {
    map.on(eventName, layerOrHandler, maybeHandler)
    return () => {
      if (!map.getLayer(layerOrHandler)) return
      map.off(eventName, layerOrHandler, maybeHandler)
    }
  }

  map.on(eventName, layerOrHandler)
  return () => {
    map.off(eventName, layerOrHandler)
  }
}

/**
 * Convert a store to { lat, lng } with automatic coordinate swap fix.
 * Returns null if coordinates are invalid.
 */
export function toLatLng(store) {
  let lat = parseCoordinate(store.latitude)
  let lng = parseCoordinate(store.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // Fix swapped coordinates when latitude/longitude are reversed in data.
  if ((lat < -90 || lat > 90) && lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
    const temp = lat
    lat = lng
    lng = temp
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}
