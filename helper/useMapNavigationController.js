import { useCallback, useEffect, useRef, useState } from 'react'

import { getBestPosition, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
import {
  MAP_EASE_DURATION_MS,
  buildUserCameraPayload,
  hasValidUserLocation,
  resolveCurrentHeading,
  shouldBuildRouteOnFollowStart,
} from '@/helper/mapNavigation'
import { appendE2EMapCameraEvent } from '@/lib/e2e-test-mode'

export function useMapNavigationController({
  mapRef,
  mapReady,
  initialHasRouteTarget,
  clearSelectedStore,
}) {
  const locatingUserPromiseRef = useRef(null)
  const pendingHeadingRef = useRef(null)

  const [locationError, setLocationError] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const [followUserHeading, setFollowUserHeading] = useState(false)
  const [navLoading, setNavLoading] = useState(false)

  const setMapBearing = useCallback((bearing) => {
    const map = mapRef.current
    if (!map) return

    map.easeTo({
      bearing,
      duration: MAP_EASE_DURATION_MS,
      essential: true,
    })
  }, [mapRef])

  const refreshUserLocation = useCallback(async ({ shouldRecenter = false, forceFreshPosition = false } = {}) => {
    if (locatingUserPromiseRef.current) return locatingUserPromiseRef.current

    setLocationError('')

    const locationTask = (async () => {
      try {
        const [positionResult, headingResult] = await Promise.all([
          getBestPosition({
            maxWaitTime: 2500,
            desiredAccuracy: 30,
            skipCache: forceFreshPosition,
          }),
          requestCompassHeading({ requestPermission: false }).catch(() => ({ heading: null, error: '' })),
        ])

        const { coords, error } = positionResult
        const gpsHeading = typeof coords?.heading === 'number' && Number.isFinite(coords.heading)
          ? coords.heading
          : null
        const nextHeading = resolveCurrentHeading({
          permissionHeading: headingResult?.heading ?? null,
          locationHeading: gpsHeading,
          previousHeading: pendingHeadingRef.current,
        })

        if (!coords) {
          setLocationError(getGeoErrorMessage(error))
          return null
        }

        if (nextHeading != null) {
          pendingHeadingRef.current = nextHeading
        }

        const nextLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy ?? null,
          heading: nextHeading,
        }

        setUserLocation((prev) => ({
          ...nextLocation,
          heading: nextHeading ?? prev?.heading ?? null,
        }))

        if (shouldRecenter) {
          const map = mapRef.current
          const cameraPayload = buildUserCameraPayload({
            latitude: coords.latitude,
            longitude: coords.longitude,
            heading: null,
          })
          if (map && cameraPayload) {
            clearSelectedStore?.()
            map.stop()
            map.easeTo(cameraPayload)
          }
        }

        return nextLocation
      } catch (err) {
        console.error('Recenter to user failed:', err)
        setLocationError(getGeoErrorMessage(err))
        return null
      } finally {
        locatingUserPromiseRef.current = null
      }
    })()

    locatingUserPromiseRef.current = locationTask
    return locationTask
  }, [clearSelectedStore, mapRef])

  const recenterToUserLocation = useCallback(() => {
    if (!hasValidUserLocation(userLocation)) {
      setLocationError('Chưa có vị trí hiện tại để quay về.')
      return null
    }

    const map = mapRef.current
    const cameraPayload = buildUserCameraPayload({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      heading: null,
    })
    if (!map || !cameraPayload) return null

    setLocationError('')
    clearSelectedStore?.()
    map.stop()
    map.easeTo(cameraPayload)

    return null
  }, [clearSelectedStore, mapRef, userLocation])

  const disableFollowUserHeading = useCallback(() => {
    setFollowUserHeading(false)
    setMapBearing(0)
  }, [setMapBearing])

  const toggleUserHeadingRotation = useCallback(async ({
    routeStopsLength = 0,
    routeFeatureCount = 0,
    buildRoute = null,
    onEnableRouteMode = null,
  } = {}) => {
    if (followUserHeading) {
      disableFollowUserHeading()
      return
    }

    const map = mapRef.current
    if (!map) return

    setNavLoading(true)
    try {
      const [freshLocation, headingResult] = await Promise.all([
        refreshUserLocation({ shouldRecenter: false, forceFreshPosition: true }),
        requestCompassHeading({ requestPermission: true }).catch(() => ({ heading: null, error: '' })),
      ])
      const currentLocation = freshLocation || userLocation
      const nextHeading = resolveCurrentHeading({
        permissionHeading: headingResult?.heading ?? null,
        locationHeading: currentLocation?.heading ?? null,
        previousHeading: pendingHeadingRef.current,
      })

      if (nextHeading != null) {
        pendingHeadingRef.current = nextHeading
        setUserLocation((prev) => (prev ? { ...prev, heading: nextHeading } : prev))
      }
      if (headingResult?.error && nextHeading == null) {
        setLocationError(headingResult.error)
      }

      if (!hasValidUserLocation(currentLocation)) {
        setLocationError('Không lấy được hướng hiện tại của thiết bị.')
        return
      }

      setFollowUserHeading(true)
      if (routeStopsLength > 0) onEnableRouteMode?.()
      if (!headingResult?.error || nextHeading != null) {
        setLocationError('')
      }

      clearSelectedStore?.()
      map.stop()

      const cameraPayload = buildUserCameraPayload({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        heading: nextHeading ?? 0,
      })
      if (cameraPayload) {
        appendE2EMapCameraEvent({
          source: 'follow-user-heading',
          type: 'easeTo',
          center: cameraPayload.center,
          ...(cameraPayload.bearing != null ? { bearing: cameraPayload.bearing } : {}),
        })
        map.easeTo(cameraPayload)
      }

      if (shouldBuildRouteOnFollowStart({ routeStopsLength, routeFeatureCount })) {
        await buildRoute?.({ skipFitBounds: true })
      }
    } finally {
      setNavLoading(false)
    }
  }, [clearSelectedStore, disableFollowUserHeading, followUserHeading, mapRef, refreshUserLocation, userLocation])

  useEffect(() => {
    if (!mapReady) return
    refreshUserLocation({ shouldRecenter: !initialHasRouteTarget })
  }, [initialHasRouteTarget, mapReady, refreshUserLocation])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    if (followUserHeading) {
      map.dragPan.disable()
    } else {
      map.dragPan.enable()
    }

    return () => {
      map.dragPan.enable()
    }
  }, [followUserHeading, mapReady, mapRef])

  useEffect(() => {
    if (!followUserHeading) return
    if (!mapReady) return
    if (!hasValidUserLocation(userLocation)) return

    const map = mapRef.current
    const cameraPayload = buildUserCameraPayload(userLocation)
    if (!map || !cameraPayload) return

    clearSelectedStore?.()
    map.stop()
    map.easeTo(cameraPayload)
  }, [clearSelectedStore, followUserHeading, mapReady, mapRef, userLocation])

  useEffect(() => {
    if (!mapReady) return undefined

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshUserLocation({ shouldRecenter: false, forceFreshPosition: true })
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [mapReady, refreshUserLocation])

  return {
    locationError,
    userLocation,
    followUserHeading,
    navLoading,
    refreshUserLocation,
    recenterToUserLocation,
    toggleUserHeadingRotation,
    disableFollowUserHeading,
  }
}
