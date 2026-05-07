import {
  buildSearchRouteQuery,
  parseQueryList,
  serializeRouteQuery,
} from '@/helper/homeSearch'

export const SEARCH_ROUTE_SYNC_DEBOUNCE_MS = 250

export function buildPersistedSearchHref(query) {
  const search = new URLSearchParams(query || {}).toString()
  return search ? `/?${search}` : '/'
}

export function buildCurrentSearchRouteQuery(routerQuery = {}) {
  return buildSearchRouteQuery({
    searchTerm: String(routerQuery.q || ''),
    selectedDistrict: parseQueryList(routerQuery.districts || routerQuery.district)[0] || '',
    selectedWard: parseQueryList(routerQuery.wards || routerQuery.ward)[0] || '',
    selectedStoreTypes: parseQueryList(routerQuery.types),
    selectedDetailFlags: parseQueryList(routerQuery.flags),
  })
}

export function buildNextSearchRouteQuery({
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
}) {
  return buildSearchRouteQuery({
    searchTerm,
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
  })
}

export function shouldSyncSearchRoute(nextQuery, currentQuery) {
  return serializeRouteQuery(nextQuery) !== serializeRouteQuery(currentQuery)
}

export function scheduleSearchRouteSync({
  nextQuery,
  pathname,
  replace,
  persist,
  setTimer,
  debounceMs = SEARCH_ROUTE_SYNC_DEBOUNCE_MS,
}) {
  const timerHandle = setTimer(() => {
    replace({ pathname, query: nextQuery }, undefined, { shallow: true })
    persist(nextQuery)
  }, debounceMs)

  return () => {
    if (typeof timerHandle === 'number') {
      clearTimeout(timerHandle)
      return
    }
    if (timerHandle != null) {
      clearTimeout(timerHandle)
    }
  }
}
