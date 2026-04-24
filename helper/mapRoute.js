import { haversineKm } from '@/helper/distance'

export const MAP_ROUTE_STORAGE_KEY = 'storevis:map-route-plan'
export const FIXED_ROUTE_POINT = {
  lat: 21.0774332,
  lng: 105.6951599,
  name: 'Điểm xuất phát',
}

export const NAV_ARRIVE_DISTANCE_M = 45
export const NAV_LEAVE_DISTANCE_M = 90
export const NAV_WAREHOUSE_DISTANCE_M = 55

export const ROUTE_STOP_STATUS = {
  PENDING: 'pending',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
}

export function formatShortAddress(store) {
  if (!store) return ''
  const parts = []
  if (store.ward) parts.push(store.ward)
  if (store.district) parts.push(store.district)
  return parts.join(', ')
}

export function formatRouteDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return ''
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`
  return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} km`
}

export function formatRouteDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return ''
  const totalMinutes = Math.round(durationSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} phút`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} giờ`
  return `${hours} giờ ${minutes} phút`
}

export function moveItem(list, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return list
  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function buildRouteStopIdSet(routeStops) {
  return new Set((routeStops || []).map((store) => String(store.id)))
}

export function buildRouteStopOrderById(routeStops, routeStopStatusById = {}) {
  const remainingStops = (routeStops || []).filter((store) => {
    const id = String(store.id)
    return (routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING) !== ROUTE_STOP_STATUS.COMPLETED
  })
  return new Map(remainingStops.map((store, index) => [String(store.id), String(index + 1)]))
}

export function buildCompletedRouteStopIdSet(routeStops, routeStopStatusById = {}) {
  const ids = []
  for (const store of routeStops || []) {
    const id = String(store.id)
    if ((routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING) === ROUTE_STOP_STATUS.COMPLETED) {
      ids.push(id)
    }
  }
  return new Set(ids)
}

export function buildPersistedRoutePlan(routeStops, hideUnselectedStores) {
  return {
    routeStopIds: (routeStops || []).map((store) => String(store.id)),
    hideUnselectedStores: Boolean(hideUnselectedStores),
  }
}

export function seedRouteStopStatuses(routeStops, previousStatuses = {}) {
  const next = {}
  for (const store of routeStops || []) {
    const id = String(store.id)
    next[id] = previousStatuses[id] || ROUTE_STOP_STATUS.PENDING
  }
  return next
}

export function buildRouteRequestStops(routeStops, routeStopStatusById = {}, options = {}) {
  const { includeCompleted = false } = options
  const completedSet = includeCompleted
    ? new Set()
    : buildCompletedRouteStopIdSet(routeStops, routeStopStatusById)

  return (routeStops || [])
    .filter((store) => !completedSet.has(String(store.id)))
    .map((store) => ({
      id: String(store.id),
      name: store.name || 'Cửa hàng',
      lat: store.coords.lat,
      lng: store.coords.lng,
    }))
}

export function applyOptimizedRouteOrder(routeStops, orderedStopIds) {
  const nextIds = Array.isArray(orderedStopIds) ? orderedStopIds.map(String) : []
  const currentStops = Array.isArray(routeStops) ? routeStops : []
  if (nextIds.length !== currentStops.length) {
    throw new Error('Không thể sắp xếp lại đầy đủ danh sách cửa hàng.')
  }

  const storeById = new Map(currentStops.map((store) => [String(store.id), store]))
  const nextRouteStops = nextIds
    .map((id) => storeById.get(id) || null)
    .filter(Boolean)

  if (nextRouteStops.length !== currentStops.length) {
    throw new Error('Không thể khôi phục đầy đủ danh sách sau khi sắp xếp.')
  }

  return nextRouteStops
}

export function buildRouteBounds(geometry) {
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : []
  return coordinates.reduce((acc, [lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return acc
    if (!acc) return [[lng, lat], [lng, lat]]
    return [
      [Math.min(acc[0][0], lng), Math.min(acc[0][1], lat)],
      [Math.max(acc[1][0], lng), Math.max(acc[1][1], lat)],
    ]
  }, null)
}

export function reconcileRouteStopStatus({ followUserHeading, routeStops, routeStopStatusById = {}, userLocation }) {
  if (!followUserHeading) {
    return { changed: false, nextRouteStopStatusById: routeStopStatusById }
  }
  if (!Number.isFinite(userLocation?.latitude) || !Number.isFinite(userLocation?.longitude)) {
    return { changed: false, nextRouteStopStatusById: routeStopStatusById }
  }
  if (!Array.isArray(routeStops) || routeStops.length === 0) {
    return { changed: false, nextRouteStopStatusById: routeStopStatusById }
  }

  const next = { ...routeStopStatusById }
  let changed = false

  const orderedStops = routeStops.map((store) => {
    const id = String(store.id)
    const status = next[id] || ROUTE_STOP_STATUS.PENDING
    next[id] = status
    return { id, store, status }
  })

  const arrivedEntry = orderedStops.find((entry) => next[entry.id] === ROUTE_STOP_STATUS.ARRIVED) || null
  if (arrivedEntry) {
    const distanceFromArrived = haversineKm(
      userLocation.latitude,
      userLocation.longitude,
      arrivedEntry.store.coords.lat,
      arrivedEntry.store.coords.lng
    ) * 1000

    if (distanceFromArrived > NAV_LEAVE_DISTANCE_M) {
      next[arrivedEntry.id] = ROUTE_STOP_STATUS.COMPLETED
      changed = true
    }
  }

  const activeArrivedEntry = orderedStops.find((entry) => next[entry.id] === ROUTE_STOP_STATUS.ARRIVED) || null
  if (!activeArrivedEntry) {
    const firstRemaining = orderedStops.find((entry) => next[entry.id] !== ROUTE_STOP_STATUS.COMPLETED) || null
    if (firstRemaining) {
      const distanceToFirstRemaining = haversineKm(
        userLocation.latitude,
        userLocation.longitude,
        firstRemaining.store.coords.lat,
        firstRemaining.store.coords.lng
      ) * 1000
      if (distanceToFirstRemaining <= NAV_ARRIVE_DISTANCE_M) {
        next[firstRemaining.id] = ROUTE_STOP_STATUS.ARRIVED
        changed = true
      }
    }
  }

  let firstArrivedFound = false
  for (const entry of orderedStops) {
    if (next[entry.id] !== ROUTE_STOP_STATUS.ARRIVED) continue
    if (!firstArrivedFound) {
      firstArrivedFound = true
      continue
    }
    next[entry.id] = ROUTE_STOP_STATUS.PENDING
    changed = true
  }

  return changed
    ? { changed: true, nextRouteStopStatusById: next }
    : { changed: false, nextRouteStopStatusById: routeStopStatusById }
}

export function buildNavigationInfo({ followUserHeading, routeStops, routeStopStatusById = {}, userLocation }) {
  if (!followUserHeading || !Array.isArray(routeStops) || routeStops.length === 0) return null

  const orderedStops = routeStops.map((store) => {
    const id = String(store.id)
    return {
      id,
      store,
      status: routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING,
    }
  })

  const arrivedIndex = orderedStops.findIndex((entry) => entry.status === ROUTE_STOP_STATUS.ARRIVED)
  const activeStore = arrivedIndex >= 0 ? orderedStops[arrivedIndex].store : null
  const nextStore = arrivedIndex >= 0
    ? (orderedStops.slice(arrivedIndex + 1).find((entry) => entry.status !== ROUTE_STOP_STATUS.COMPLETED)?.store || null)
    : (orderedStops.find((entry) => entry.status !== ROUTE_STOP_STATUS.COMPLETED)?.store || null)
  const distanceTargetStore = nextStore || activeStore || null
  const canMeasureDistance = Number.isFinite(userLocation?.latitude) && Number.isFinite(userLocation?.longitude)
  const distanceFromLat = canMeasureDistance ? userLocation.latitude : FIXED_ROUTE_POINT.lat
  const distanceFromLng = canMeasureDistance ? userLocation.longitude : FIXED_ROUTE_POINT.lng
  const targetLat = Number.isFinite(distanceTargetStore?.coords?.lat) ? distanceTargetStore.coords.lat : null
  const targetLng = Number.isFinite(distanceTargetStore?.coords?.lng) ? distanceTargetStore.coords.lng : null
  const rawNextDistanceMeters = (targetLat != null && targetLng != null)
    ? haversineKm(distanceFromLat, distanceFromLng, targetLat, targetLng) * 1000
    : 0
  const nextDistanceMeters = Number.isFinite(rawNextDistanceMeters) ? rawNextDistanceMeters : 0

  const completedStops = orderedStops.filter((entry) => entry.status === ROUTE_STOP_STATUS.COMPLETED)
  const lastCompletedStore = completedStops.length > 0 ? completedStops[completedStops.length - 1].store : null

  const atWarehouse = Number.isFinite(userLocation?.latitude) && Number.isFinite(userLocation?.longitude)
    ? (haversineKm(
      userLocation.latitude,
      userLocation.longitude,
      FIXED_ROUTE_POINT.lat,
      FIXED_ROUTE_POINT.lng
    ) * 1000) <= NAV_WAREHOUSE_DISTANCE_M
    : false

  if (activeStore) {
    return {
      currentLabel: 'Hiện tại',
      currentStore: activeStore,
      nextStore,
      nextDistanceMeters,
    }
  }

  if (atWarehouse) {
    return {
      currentLabel: 'Hiện tại',
      currentText: 'Kho',
      nextStore,
      nextDistanceMeters,
    }
  }

  if (lastCompletedStore) {
    return {
      currentLabel: 'Đã qua',
      currentStore: lastCompletedStore,
      nextStore,
      nextDistanceMeters,
    }
  }

  return {
    currentLabel: 'Hiện tại',
    currentText: 'Đang di chuyển',
    nextStore,
    nextDistanceMeters,
  }
}
