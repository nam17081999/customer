/**
 * Geolocation utilities — GPS with watchPosition for progressive accuracy,
 * user-friendly error messages, and compass heading.
 */

import { getE2EGeolocationOverride, incrementE2EGeolocationCallCount } from '@/lib/e2e-test-mode'

const _posCache = {
  coords: null,
  ts: 0,
  TTL: 10_000,
  set(coords) {
    this.coords = coords
    this.ts = Date.now()
  },
  get(maxAge = this.TTL) {
    if (!this.coords) return null
    if (Date.now() - this.ts > maxAge) return null
    return this.coords
  },
  clear() {
    this.coords = null
    this.ts = 0
  },
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

export function calculateGeolocationDistanceMeters(a, b) {
  if (!a || !b) return Infinity
  const lat1 = Number(a.latitude)
  const lng1 = Number(a.longitude)
  const lat2 = Number(b.latitude)
  const lng2 = Number(b.longitude)
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity

  const R = 6371e3
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const aa = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return R * c
}

export function classifyGeolocationSample({ anchorCoords, candidate } = {}) {
  if (!anchorCoords || !candidate) return { isSuspicious: false, distanceMeters: 0, thresholdMeters: 0 }
  const distanceMeters = calculateGeolocationDistanceMeters(anchorCoords, candidate)
  const accuracy = Number(candidate?.accuracy || Infinity)
  const thresholdMeters = Math.max(250, accuracy * 4)
  return {
    isSuspicious: distanceMeters > thresholdMeters,
    distanceMeters,
    thresholdMeters,
  }
}

export function shouldFinishGeolocationEarly({
  desiredAccuracy,
  trustedFixCount,
  suspiciousFixCount,
  bestTrusted,
  bestSuspicious,
} = {}) {
  if (bestTrusted && Number(bestTrusted.accuracy || Infinity) <= desiredAccuracy && trustedFixCount >= 1) {
    return true
  }

  if (bestSuspicious && Number(bestSuspicious.accuracy || Infinity) <= desiredAccuracy && suspiciousFixCount >= 2) {
    return true
  }

  return false
}

export function selectGeolocationFinishResult({ bestTrusted, bestSuspicious } = {}) {
  return bestTrusted || bestSuspicious || null
}

export async function getBestPosition({
  maxWaitTime = 2000,
  desiredAccuracy = 30,
  skipCache = false,
  anchorCoords = null,
  attempts,
  timeout,
} = {}) {
  const e2eGeolocation = getE2EGeolocationOverride()
  if (e2eGeolocation.hasOverride) {
    incrementE2EGeolocationCallCount()
    const delayMs = Number(e2eGeolocation?.delayMs || 0)
    if (Number.isFinite(delayMs) && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    if (e2eGeolocation.coords) {
      return { coords: e2eGeolocation.coords, error: null }
    }
    return {
      coords: null,
      error: e2eGeolocation.error ? new Error(String(e2eGeolocation.error)) : new Error('Không lấy được vị trí'),
    }
  }

  if (!navigator.geolocation) {
    return { coords: null, error: new Error('Geolocation not supported') }
  }

  if (!skipCache) {
    const cached = _posCache.get()
    if (cached && (cached.accuracy || Infinity) <= desiredAccuracy) {
      return { coords: cached, error: null }
    }
  }

  return new Promise((resolve) => {
    let bestTrusted = null
    let bestSuspicious = null
    let watchId = null
    let resolved = false
    let trustedFixCount = 0
    let suspiciousFixCount = 0

    function considerCandidate(coords) {
      if (!coords) return
      const acc = coords.accuracy || Infinity
      const { isSuspicious } = classifyGeolocationSample({ anchorCoords, candidate: coords })

      if (isSuspicious) {
        const bestAcc = bestSuspicious?.accuracy || Infinity
        if (acc < bestAcc) bestSuspicious = coords
        if (acc <= desiredAccuracy) suspiciousFixCount += 1
      } else {
        const bestAcc = bestTrusted?.accuracy || Infinity
        if (acc < bestAcc) bestTrusted = coords
        if (acc <= desiredAccuracy) trustedFixCount += 1
      }

      if (shouldFinishGeolocationEarly({
        desiredAccuracy,
        trustedFixCount,
        suspiciousFixCount,
        bestTrusted,
        bestSuspicious,
      })) {
        finish()
      }
    }

    function finish() {
      if (resolved) return
      resolved = true
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      const result = selectGeolocationFinishResult({ bestTrusted, bestSuspicious })
      if (result) {
        _posCache.set(result)
        resolve({ coords: result, error: null })
      } else {
        resolve({ coords: null, error: new Error('Không lấy được vị trí') })
      }
    }

    function onPosition(pos) {
      if (resolved) return
      considerCandidate(pos?.coords)
    }

    function onError() {
      // wait until deadline/watch recovery
    }

    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: maxWaitTime,
      maximumAge: 0,
    })

    if (!skipCache) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (resolved) return
          considerCandidate(pos?.coords)
        },
        () => {},
        { enableHighAccuracy: true, timeout: 500, maximumAge: 30_000 },
      )
    }

    setTimeout(finish, maxWaitTime)
  })
}

export function clearPositionCache() {
  _posCache.clear()
}

export function getGeoErrorMessage(err) {
  const base =
    'Không lấy được vị trí. Vui lòng bật định vị và mở cài đặt quyền vị trí của trình duyệt để cho phép.'
  const code = err?.code ?? err?.cause?.code
  if (code === 1) {
    return 'Bạn đã từ chối quyền định vị. Vui lòng mở cài đặt quyền vị trí của trình duyệt để cho phép và thử lại.'
  }
  if (code === 2) {
    return 'Không xác định được vị trí. Hãy bật GPS, kiểm tra tín hiệu hoặc thử lại.'
  }
  if (code === 3) {
    return 'Lấy vị trí quá lâu. Vui lòng kiểm tra GPS/mạng và thử lại.'
  }
  const msg = (err?.message || err?.cause?.message || '').toLowerCase()
  if (msg.includes('not supported')) {
    return 'Thiết bị hoặc trình duyệt không hỗ trợ định vị. Vui lòng dùng thiết bị khác.'
  }
  if (msg.includes('timeout')) {
    return 'Lấy vị trí quá lâu. Vui lòng kiểm tra GPS/mạng và thử lại.'
  }
  return base
}

export async function requestCompassHeading(options = {}) {
  const { requestPermission = false } = options
  const e2eGeolocation = getE2EGeolocationOverride()
  if (e2eGeolocation.hasOverride) {
    return {
      heading: e2eGeolocation.heading,
      error: '',
    }
  }

  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    return { heading: null, error: '' }
  }

  if (requestPermission && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission()
      if (res !== 'granted') {
        return { heading: null, error: 'Cần cho phép la bàn để xoay bản đồ theo hướng' }
      }
    } catch {
      return { heading: null, error: 'Không thể xin quyền la bàn' }
    }
  }

  return new Promise((resolve) => {
    const samples = []
    let done = false

    function circularMean(degs) {
      const rad = degs.map((d) => (d * Math.PI) / 180)
      const sinSum = rad.reduce((a, r) => a + Math.sin(r), 0)
      const cosSum = rad.reduce((a, r) => a + Math.cos(r), 0)
      const mean = Math.atan2(sinSum / rad.length, cosSum / rad.length)
      return ((mean * 180) / Math.PI + 360) % 360
    }

    const pushSample = (deg) => {
      const v = ((deg % 360) + 360) % 360
      samples.push(v)
      if (samples.length >= 5) {
        done = true
        window.removeEventListener('deviceorientation', handler, true)
        resolve({ heading: circularMean(samples), error: '' })
      }
    }

    const handler = (event) => {
      if (done) return
      if (typeof event.webkitCompassHeading === 'number') {
        pushSample(event.webkitCompassHeading)
        return
      }
      if (typeof event.alpha === 'number') {
        pushSample((360 - event.alpha) % 360)
      }
    }

    window.addEventListener('deviceorientation', handler, true)

    setTimeout(() => {
      if (!done) {
        window.removeEventListener('deviceorientation', handler, true)
        if (samples.length > 0) {
          resolve({ heading: circularMean(samples), error: '' })
        } else {
          resolve({ heading: null, error: '' })
        }
      }
    }, 1200)
  })
}
