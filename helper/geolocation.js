/**
 * Geolocation utilities — GPS sampling with progressive timeout,
 * user-friendly error messages, and compass heading.
 */

/**
 * Get the best GPS position with multiple attempts, progressive timeouts,
 * and optional cached-position shortcut.
 *
 * @param {Object} options
 * @param {number} options.attempts       — max sampling rounds (default 4)
 * @param {number} options.timeout        — initial per-attempt timeout in ms (default 5000)
 * @param {number} options.maxWaitTime    — total wall-clock budget in ms (default 10000)
 * @param {number} options.desiredAccuracy — early-exit threshold in metres (default 25)
 * @param {boolean} options.skipCache     — skip the 30 s maximumAge shortcut (default false)
 * @returns {Promise<{coords: GeolocationCoordinates|null, error: Error|null}>}
 */
export async function getBestPosition({
  attempts = 4,
  timeout = 5000,
  maxWaitTime = 10000,
  desiredAccuracy = 25,
  skipCache = false,
} = {}) {
  if (!navigator.geolocation) {
    return { coords: null, error: new Error('Geolocation not supported') }
  }

  const samples = []
  const startTime = Date.now()
  let lastError = null

  if (!skipCache) {
    // Try cached position first (< 30 s old)
    try {
      const cached = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 1000,
          maximumAge: 30000,
        })
      })
      if (cached?.coords?.accuracy && cached.coords.accuracy <= desiredAccuracy * 1.5) {
        console.log('✅ Dùng vị trí cache:', cached.coords.accuracy + 'm')
        return { coords: cached.coords, error: null }
      }
    } catch (err) {
      lastError = err
    }
  }

  for (let i = 0; i < attempts; i++) {
    const elapsed = Date.now() - startTime
    if (elapsed > maxWaitTime) {
      console.log('⏱️ Đã hết thời gian chờ tối đa:', elapsed + 'ms')
      break
    }

    try {
      const dynamicTimeout = Math.max(2000, timeout - i * 1000)
      const remainingTime = maxWaitTime - elapsed
      const actualTimeout = Math.min(dynamicTimeout, remainingTime)
      if (actualTimeout < 1000) break

      const pos = await new Promise((resolve, reject) => {
        const tid = setTimeout(() => reject(new Error('Timeout')), actualTimeout)
        navigator.geolocation.getCurrentPosition(
          (result) => { clearTimeout(tid); resolve(result) },
          (err) => { clearTimeout(tid); reject(err) },
          { enableHighAccuracy: true, timeout: actualTimeout, maximumAge: 0 },
        )
      })

      if (pos?.coords) {
        samples.push(pos.coords)
        console.log(
          `📍 Sample ${i + 1}: ${pos.coords.accuracy?.toFixed(1) || '?'}m, heading: ${pos.coords.heading || 'N/A'} (${Date.now() - startTime}ms)`,
        )
        if (pos.coords.accuracy && pos.coords.accuracy <= desiredAccuracy) {
          console.log('✅ Đạt độ chính xác mong muốn')
          return { coords: pos.coords, error: null }
        }
      }
    } catch (err) {
      console.warn(`⚠️ Attempt ${i + 1} failed:`, err.message)
      lastError = err
    }
  }

  if (samples.length === 0) {
    const e = new Error('Không lấy được vị trí sau nhiều lần thử')
    e.cause = lastError || undefined
    return { coords: null, error: e }
  }

  samples.sort((a, b) => (a.accuracy || Infinity) - (b.accuracy || Infinity))
  console.log(`📊 Chọn sample tốt nhất: ${samples[0].accuracy?.toFixed(1) || '?'}m`)
  return { coords: samples[0], error: null }
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
 * @returns {Promise<{heading: number|null, error: string}>}
 */
export async function requestCompassHeading() {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    return { heading: null, error: '' }
  }

  // iOS 13+ requires explicit permission
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
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
