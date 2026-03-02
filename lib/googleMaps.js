/**
 * Shared Google Maps loader — single source of truth for loading the Maps JS API.
 * Prevents duplicate script tags and callback conflicts.
 */

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

let _promise = null
let _resolved = false

export function isGoogleMapsLoaded() {
  return !!(window.google?.maps?.Map)
}

/**
 * Load Google Maps JS API. Safe to call multiple times — only loads once.
 * @returns {Promise<void>}
 */
export function loadGoogleMaps() {
  if (isGoogleMapsLoaded()) {
    _resolved = true
    return Promise.resolve()
  }
  if (_promise) return _promise

  _promise = new Promise((resolve, reject) => {
    // If another script already injected (e.g. from @react-google-maps/api), just poll
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existing) {
      const poll = setInterval(() => {
        if (isGoogleMapsLoaded()) {
          clearInterval(poll)
          _resolved = true
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(poll)
        if (!_resolved) reject(new Error('Google Maps load timeout (existing script)'))
      }, 20000)
      return
    }

    // Create a unique callback name
    const callbackName = '__initGoogleMaps_' + Date.now()
    window[callbackName] = () => {
      delete window[callbackName]
      _resolved = true
      resolve()
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      delete window[callbackName]
      _promise = null
      reject(new Error('Failed to load Google Maps script'))
    }
    document.head.appendChild(script)

    // Safety timeout
    setTimeout(() => {
      if (!_resolved) {
        delete window[callbackName]
        _promise = null
        reject(new Error('Google Maps load timeout'))
      }
    }, 20000)
  })

  return _promise
}
