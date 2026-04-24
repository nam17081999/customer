function cloneValue(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

export function getE2ETestState() {
  if (typeof window === 'undefined') return null
  const state = window.__STOREVIS_E2E__
  if (!state || typeof state !== 'object') return null
  return state
}

export function isE2ETestModeEnabled() {
  return Boolean(getE2ETestState())
}

export function getE2EAuthOverride() {
  const state = getE2ETestState()
  if (!state || !Object.prototype.hasOwnProperty.call(state, 'auth')) {
    return { hasOverride: false, user: null }
  }

  const auth = state.auth || {}
  if (auth.user && typeof auth.user === 'object') {
    return { hasOverride: true, user: cloneValue(auth.user) }
  }

  const role = String(auth.role || '').trim().toLowerCase()
  if (!role || role === 'guest') {
    return { hasOverride: true, user: null }
  }

  return {
    hasOverride: true,
    user: {
      id: `e2e-${role}`,
      email: `e2e-${role}@example.com`,
      app_metadata: { role },
    },
  }
}

export function getE2EStoresOverride() {
  const state = getE2ETestState()
  if (!state || !Object.prototype.hasOwnProperty.call(state, 'stores')) {
    return { hasOverride: false, stores: [] }
  }

  return {
    hasOverride: true,
    stores: Array.isArray(state.stores) ? state.stores : [],
  }
}

export function appendE2EStoreOverride(newStore) {
  const state = getE2ETestState()
  if (!state || !Array.isArray(state.stores) || !newStore) return false

  const targetId = newStore.id == null ? '' : String(newStore.id)
  const nextStore = cloneValue(newStore)
  const existingIndex = state.stores.findIndex((store) => String(store?.id ?? '') === targetId)

  if (existingIndex >= 0) {
    state.stores[existingIndex] = {
      ...state.stores[existingIndex],
      ...nextStore,
    }
  } else {
    state.stores.push(nextStore)
  }

  return true
}

export function getE2EGeolocationOverride() {
  const state = getE2ETestState()
  if (!state || !Object.prototype.hasOwnProperty.call(state, 'geolocation')) {
    return { hasOverride: false, coords: null, error: null, heading: null }
  }

  const geolocation = state.geolocation || {}
  return {
    hasOverride: true,
    coords: geolocation.coords ? cloneValue(geolocation.coords) : null,
    error: geolocation.error ?? null,
    heading: typeof geolocation.heading === 'number' ? geolocation.heading : null,
  }
}

export function incrementE2EGeolocationCallCount() {
  const state = getE2ETestState()
  if (!state || !state.geolocation || typeof state.geolocation !== 'object') return 0

  const nextCount = Number(state.geolocation.callCount || 0) + 1
  state.geolocation.callCount = nextCount
  return nextCount
}
