import { useState, useCallback } from 'react'

/**
 * Custom hook for high-accuracy geolocation with multiple attempts
 * @param {Object} options - Configuration options
 * @returns {Object} - Geolocation state and methods
 */
export function useGeolocation(options = {}) {
  const {
    attempts = 3,
    timeout = 10000,
    desiredAccuracy = 30,
    enableHighAccuracy = true,
  } = options

  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [accuracy, setAccuracy] = useState(null)

  /**
   * Try multiple high-accuracy geolocation attempts and pick the best sample
   */
  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      const err = new Error('Geolocation not supported')
      setError(err)
      throw err
    }

    setLoading(true)
    setError(null)

    const samples = []

    for (let i = 0; i < attempts; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy,
              timeout,
              maximumAge: 0,
            }
          )
        })

        if (position?.coords) {
          samples.push(position.coords)

          // If we got desired accuracy, use it immediately
          if (
            typeof position.coords.accuracy === 'number' &&
            position.coords.accuracy <= desiredAccuracy
          ) {
            const result = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            }
            setLocation(result)
            setAccuracy(position.coords.accuracy)
            setLoading(false)
            return result
          }
        }
      } catch (err) {
        // Continue to next attempt
        if (i === attempts - 1) {
          // Last attempt failed
          setError(err)
        }
      }
    }

    // Pick the best sample (lowest accuracy number = most accurate)
    if (samples.length === 0) {
      const err = new Error('Không lấy được vị trí sau nhiều lần thử')
      setError(err)
      setLoading(false)
      throw err
    }

    samples.sort((a, b) => (a.accuracy || Infinity) - (b.accuracy || Infinity))
    const bestCoords = samples[0]

    const result = {
      latitude: bestCoords.latitude,
      longitude: bestCoords.longitude,
      accuracy: bestCoords.accuracy,
      altitude: bestCoords.altitude,
      altitudeAccuracy: bestCoords.altitudeAccuracy,
      heading: bestCoords.heading,
      speed: bestCoords.speed,
    }

    setLocation(result)
    setAccuracy(bestCoords.accuracy)
    setLoading(false)

    return result
  }, [attempts, timeout, desiredAccuracy, enableHighAccuracy])

  const clearLocation = useCallback(() => {
    setLocation(null)
    setError(null)
    setAccuracy(null)
  }, [])

  return {
    location,
    loading,
    error,
    accuracy,
    getLocation,
    clearLocation,
    isSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  }
}

/**
 * Get stored location from localStorage
 */
export function getStoredLocation(key = 'userLocation') {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return parsed
    }
  } catch (err) {
    console.error('Error parsing stored location:', err)
  }
  return null
}

/**
 * Store location to localStorage
 */
export function storeLocation(location, key = 'userLocation') {
  if (typeof window === 'undefined' || !location) return false
  try {
    localStorage.setItem(key, JSON.stringify(location))
    return true
  } catch (err) {
    console.error('Error storing location:', err)
    return false
  }
}

