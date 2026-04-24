import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  FIXED_ROUTE_POINT,
  MAP_ROUTE_STORAGE_KEY,
  applyOptimizedRouteOrder,
  buildCompletedRouteStopIdSet,
  buildNavigationInfo,
  buildPersistedRoutePlan,
  buildRouteBounds,
  buildRouteRequestStops,
  buildRouteStopIdSet,
  buildRouteStopOrderById,
  reconcileRouteStopStatus,
  seedRouteStopStatuses,
} from '@/helper/mapRoute'
import { appendE2EMapCameraEvent } from '@/lib/e2e-test-mode'

const EMPTY_ROUTE_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] }

export function useMapRouteController({
  loading,
  storesWithCoords,
  userLocation,
  followUserHeading,
  onRouteStopsEmpty,
  mapRef,
  isDesktop,
}) {
  const [routeStops, setRouteStops] = useState([])
  const [routeGeojson, setRouteGeojson] = useState(EMPTY_ROUTE_FEATURE_COLLECTION)
  const [routeSummary, setRouteSummary] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeSorting, setRouteSorting] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [hideUnselectedStores, setHideUnselectedStores] = useState(false)
  const [routeStopStatusById, setRouteStopStatusById] = useState({})
  const [routePlanHydrated, setRoutePlanHydrated] = useState(false)
  const restoredRoutePlanRef = useRef(false)

  const routeStopIds = useMemo(() => buildRouteStopIdSet(routeStops), [routeStops])
  const routeStopOrderById = useMemo(
    () => buildRouteStopOrderById(routeStops, routeStopStatusById),
    [routeStops, routeStopStatusById]
  )
  const completedRouteStopIdSet = useMemo(
    () => buildCompletedRouteStopIdSet(routeStops, routeStopStatusById),
    [routeStops, routeStopStatusById]
  )
  const navigationInfo = useMemo(
    () => buildNavigationInfo({ followUserHeading, routeStops, routeStopStatusById, userLocation }),
    [followUserHeading, routeStops, routeStopStatusById, userLocation]
  )

  const resetRouteProgress = useCallback(() => {
    setRouteStopStatusById({})
    setRouteError('')
  }, [])

  useEffect(() => {
    const latestById = new Map(storesWithCoords.map((store) => [String(store.id), store]))
    setRouteStops((prev) => prev
      .map((store) => latestById.get(String(store.id)) || null)
      .filter(Boolean)
    )
  }, [storesWithCoords])

  useEffect(() => {
    if (restoredRoutePlanRef.current) return
    if (typeof window === 'undefined') return
    if (loading) return

    try {
      const raw = window.localStorage.getItem(MAP_ROUTE_STORAGE_KEY)
      restoredRoutePlanRef.current = true
      if (!raw) return

      const parsed = JSON.parse(raw)
      const savedIds = Array.isArray(parsed?.routeStopIds) ? parsed.routeStopIds.map(String) : []
      const byId = new Map(storesWithCoords.map((store) => [String(store.id), store]))
      const restoredStops = savedIds
        .map((id) => byId.get(id) || null)
        .filter(Boolean)

      setRouteStops(restoredStops)
      // Always start /map with out-of-route stores visible, regardless of the previous session toggle.
      setHideUnselectedStores(false)
    } catch (error) {
      restoredRoutePlanRef.current = true
      console.error('Restore route plan failed:', error)
    } finally {
      if (restoredRoutePlanRef.current) {
        setRoutePlanHydrated(true)
      }
    }
  }, [loading, storesWithCoords])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!routePlanHydrated) return

    try {
      window.localStorage.setItem(
        MAP_ROUTE_STORAGE_KEY,
        JSON.stringify(buildPersistedRoutePlan(routeStops, hideUnselectedStores))
      )
    } catch (error) {
      console.error('Persist route plan failed:', error)
    }
  }, [routePlanHydrated, routeStops, hideUnselectedStores])

  useEffect(() => {
    setRouteGeojson(EMPTY_ROUTE_FEATURE_COLLECTION)
    setRouteSummary(null)
    setRouteError('')
  }, [routeStops])

  useEffect(() => {
    if (routeStops.length === 0) setHideUnselectedStores(false)
  }, [routeStops.length])

  useEffect(() => {
    setRouteStopStatusById((prev) => seedRouteStopStatuses(routeStops, prev))
    if (routeStops.length === 0) onRouteStopsEmpty?.()
  }, [routeStops, onRouteStopsEmpty])

  useEffect(() => {
    const { changed, nextRouteStopStatusById } = reconcileRouteStopStatus({
      followUserHeading,
      routeStops,
      routeStopStatusById,
      userLocation,
    })
    if (changed) {
      setRouteStopStatusById(nextRouteStopStatusById)
    }
  }, [followUserHeading, routeStops, routeStopStatusById, userLocation])

  const addStoreToRoute = useCallback((store) => {
    if (!store?.coords) return
    setRouteStops((prev) => {
      if (prev.some((item) => String(item.id) === String(store.id))) return prev
      return [...prev, store]
    })
    resetRouteProgress()
  }, [resetRouteProgress])

  const removeRouteStop = useCallback((storeId) => {
    setRouteStops((prev) => prev.filter((store) => String(store.id) !== String(storeId)))
    setRouteStopStatusById((prev) => {
      const next = { ...prev }
      delete next[String(storeId)]
      return next
    })
  }, [])

  const clearRoutePlan = useCallback(() => {
    setRouteStops([])
    setRouteGeojson(EMPTY_ROUTE_FEATURE_COLLECTION)
    setRouteSummary(null)
    setRouteError('')
    setRouteStopStatusById({})
  }, [])

  const buildRoute = useCallback(async (options = {}) => {
    const { skipFitBounds = false } = options
    const stops = buildRouteRequestStops(routeStops, routeStopStatusById)
    if (stops.length < 1) {
      setRouteError('Chọn ít nhất 1 cửa hàng để vẽ tuyến.')
      return
    }

    setRouteLoading(true)
    setRouteError('')

    try {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: FIXED_ROUTE_POINT,
          end: FIXED_ROUTE_POINT,
          stops,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Không lấy được tuyến đường.')
      }

      setRouteGeojson({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: payload.geometry,
          properties: {
            distance: payload.distance,
            duration: payload.duration,
          },
        }],
      })
      setRouteSummary({
        distance: payload.distance,
        duration: payload.duration,
        returnsToFixedPoint: true,
      })

      const map = mapRef.current
      const bounds = buildRouteBounds(payload.geometry)
      if (map && bounds && !skipFitBounds) {
        appendE2EMapCameraEvent({
          source: 'build-route',
          type: 'fitBounds',
          bounds,
        })
        map.fitBounds(bounds, {
          padding: isDesktop
            ? { top: 110, right: 370, bottom: 70, left: 70 }
            : { top: 110, right: 40, bottom: 220, left: 40 },
          duration: 900,
        })
      }
    } catch (err) {
      const errorMessage = err?.message || 'Không thể vẽ tuyến đường ngay lúc này.'
      console.error(`Build route failed: ${errorMessage}`)
      setRouteError(errorMessage)
    } finally {
      setRouteLoading(false)
    }
  }, [isDesktop, mapRef, routeStopStatusById, routeStops])

  const optimizeRouteOrder = useCallback(async () => {
    if (routeStops.length < 2) {
      setRouteError('Chọn ít nhất 2 cửa hàng để sắp xếp.')
      return
    }

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Sắp xếp lại thứ tự cửa hàng cho tuyến đi và quay về điểm xuất phát cố định? Thứ tự hiện tại sẽ được thay đổi.')

    if (!confirmed) return

    setRouteSorting(true)
    setRouteError('')

    try {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'optimize',
          start: FIXED_ROUTE_POINT,
          end: FIXED_ROUTE_POINT,
          stops: buildRouteRequestStops(routeStops, routeStopStatusById, { includeCompleted: true }),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Không thể sắp xếp danh sách cửa hàng.')
      }

      setRouteStops(applyOptimizedRouteOrder(routeStops, payload?.orderedStopIds))
      setRouteGeojson(EMPTY_ROUTE_FEATURE_COLLECTION)
      setRouteSummary(null)
      setRouteStopStatusById({})
    } catch (err) {
      const errorMessage = err?.message || 'Không thể sắp xếp danh sách cửa hàng lúc này.'
      console.error(`Optimize route order failed: ${errorMessage}`)
      setRouteError(errorMessage)
    } finally {
      setRouteSorting(false)
    }
  }, [routeStopStatusById, routeStops])

  return {
    routeStops,
    setRouteStops,
    routeGeojson,
    routeSummary,
    routeLoading,
    routeSorting,
    routeError,
    setRouteError,
    hideUnselectedStores,
    setHideUnselectedStores,
    routeStopStatusById,
    setRouteStopStatusById,
    routeStopIds,
    routeStopOrderById,
    completedRouteStopIdSet,
    navigationInfo,
    addStoreToRoute,
    removeRouteStop,
    clearRoutePlan,
    buildRoute,
    optimizeRouteOrder,
    resetRouteProgress,
  }
}
