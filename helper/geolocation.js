/**
 * Geolocation utilities — GPS with watchPosition for progressive accuracy,
 * user-friendly error messages, and compass heading.
 */

/**
 * Get the best GPS position using watchPosition for progressive accuracy.
 * Returns the first position that meets desiredAccuracy, or the best one
 * collected within maxWaitTime.
 *
 * Strategy:
 * 1. Start watchPosition immediately (gets coarse → fine updates)
 * 2. If a cached position (<60s) with acceptable accuracy exists, return it fast
 * 3. As watch updates arrive, keep the best sample
 * 4. Early-exit as soon as desiredAccuracy is met
 * 5. After maxWaitTime, return the best sample collected
 *
 * @param {Object} options
 * @param {number} options.maxWaitTime    — total budget in ms (default 2000)
 * @param {number} options.desiredAccuracy — early-exit threshold in metres (default 20)
 * @param {boolean} options.skipCache     — skip cached position shortcut (default false)
 * @returns {Promise<{coords: GeolocationCoordinates|null, error: Error|null}>}
 */
export async function getBestPosition({
  maxWaitTime = 2000,
  desiredAccuracy = 20,
  skipCache = false,
  // Legacy params — ignored but accepted to avoid breaking callers
  attempts,
  timeout,
} = {}) {
  if (!navigator.geolocation) {
    return { coords: null, error: new Error('Geolocation not supported') }
  }

  return new Promise((resolve) => {
    let best = null
    let watchId = null
    let resolved = false
    const startTime = Date.now()

    function finish() {
      if (resolved) return
      resolved = true
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      if (best) {
        resolve({ coords: best, error: null })
      } else {
        resolve({ coords: null, error: new Error('Không lấy được vị trí') })
      }
    }

    function onPosition(pos) {
      if (resolved) return
      const coords = pos?.coords
      if (!coords) return

      const acc = coords.accuracy || Infinity
      const bestAcc = best?.accuracy || Infinity

      if (acc < bestAcc) {
        best = coords
      }

      // Early exit if accuracy is good enough
      if (acc <= desiredAccuracy) {
        finish()
      }
    }

    function onError() {
      // Don't resolve yet — wait for timeout, watchPosition may recover
    }

    // Start continuous watch immediately
    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: maxWaitTime,
      maximumAge: 0,
    })

    // Also try a quick cached position in parallel
    if (!skipCache) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (resolved) return
          const coords = pos?.coords
          if (coords?.accuracy && coords.accuracy <= desiredAccuracy * 1.5) {
            const bestAcc = best?.accuracy || Infinity
            if (coords.accuracy < bestAcc) {
              best = coords
            }
            // If cache is excellent, finish early
            if (coords.accuracy <= desiredAccuracy) {
              finish()
            }
          }
        },
        () => { /* ignore cache error */ },
        { enableHighAccuracy: true, timeout: 500, maximumAge: 60000 },
      )
    }

    // Hard deadline
    setTimeout(finish, maxWaitTime)
  })
}

/**
 * Map a geolocation error to a user-friendly Vietnamese message.
 */
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

/**
 * Request a single compass heading sample from the device orientation API.
 * Collects up to 5 samples in 1.2 s and returns the circular mean in degrees.
 *
 * @param {{requestPermission?: boolean}} options
 * @returns {Promise<{heading: number|null, error: string}>}
 */
export async function requestCompassHeading(options = {}) {
  const { requestPermission = false } = options

  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    return { heading: null, error: '' }
  }

  // iOS 13+ requires explicit permission and browsers only allow prompting
  // inside a direct user gesture (click/tap).
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
