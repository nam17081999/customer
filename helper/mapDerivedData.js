import { getBaseMarkerImageId, getHighlightedMarkerImageId } from '@/helper/mapMarkerImages'
import { formatAddressParts } from '@/lib/utils'

const IGNORED_NAME_TERMS = [
  'cửa hàng',
  'tạp hoá',
  'quán nước',
  'giải khát',
  'nhà nghỉ',
  'nhà hàng',
  'cyber cà phê',
  'cafe',
  'lẩu',
  'siêu thị',
  'quán',
  'gym',
  'đại lý',
  'cơm',
  'phở',
  'bún',
  'shop',
  'kok',
  'karaoke',
  'bi-a',
  'bia',
  'net',
  'game',
  'internet',
  'beer',
  'coffee',
]

export function getFirstMeaningfulWord(name = '') {
  let remaining = String(name).trim().toLowerCase()
  const sorted = [...IGNORED_NAME_TERMS].sort((a, b) => b.length - a.length)
  let stripped = true
  while (stripped) {
    stripped = false
    for (const term of sorted) {
      if (remaining.startsWith(term)) {
        remaining = remaining.slice(term.length).trimStart()
        stripped = true
        break
      }
    }
  }
  const offset = String(name).trim().length - remaining.length
  const meaningful = String(name).trim().slice(offset).trimStart()
  const first = meaningful.split(/\s+/)[0] || String(name).trim().split(/\s+/)[0] || '?'
  return first.slice(0, 12)
}

export function createMapFeatureBaseCache() {
  return new Map()
}

function buildMapFeatureBaseSignature(store) {
  return JSON.stringify({
    name: store?.name || '',
    address: formatAddressParts(store),
    lat: store?.coords?.lat ?? null,
    lng: store?.coords?.lng ?? null,
  })
}

function buildBaseMapFeature(store) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [store.coords.lng, store.coords.lat] },
    properties: {
      storeId: String(store.id),
      name: store.name || 'Cửa hàng',
      shortName: getFirstMeaningfulWord(store.name),
      address: formatAddressParts(store),
    },
  }
}

function getOrCreateBaseMapFeature(featureBaseCache, store) {
  if (!featureBaseCache) return buildBaseMapFeature(store)

  const storeId = String(store.id)
  const signature = buildMapFeatureBaseSignature(store)
  const cached = featureBaseCache.get(storeId)
  if (cached && cached.signature === signature) return cached.feature

  const feature = buildBaseMapFeature(store)
  featureBaseCache.set(storeId, { signature, feature })
  return feature
}

export function buildVisibleMapStores({
  filteredStores,
  hideUnselectedStores,
  routeStopIds,
}) {
  if (!hideUnselectedStores || routeStopIds.size === 0) return filteredStores
  return filteredStores.filter((store) => routeStopIds.has(String(store.id)))
}

export function buildMapStoreFeatures({
  visibleMapStores,
  highlightedStoreId,
  completedRouteStopIdSet,
  routeStopOrderById,
  featureBaseCache,
}) {
  const highlightedId = highlightedStoreId ? String(highlightedStoreId) : ''
  const features = visibleMapStores.map((store) => {
    const baseFeature = getOrCreateBaseMapFeature(featureBaseCache, store)
    return {
      ...baseFeature,
      geometry: baseFeature.geometry,
      properties: {
        ...baseFeature.properties,
        routeOrder: routeStopOrderById.get(String(store.id)) || '',
        passed: completedRouteStopIdSet.has(String(store.id)) ? 'yes' : 'no',
        highlighted: String(store.id) === highlightedId ? 'yes' : 'no',
      },
    }
  })

  if (!highlightedId) return features

  const highlightedIndex = features.findIndex((feature) => feature.properties.storeId === highlightedId)
  if (highlightedIndex < 0) return features

  const nextFeatures = features.slice()
  const [highlightedFeature] = nextFeatures.splice(highlightedIndex, 1)
  nextFeatures.push(highlightedFeature)
  return nextFeatures
}

export function buildFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features,
  }
}

export function buildStoreLookupMap(visibleMapStores) {
  const lookup = new Map()
  visibleMapStores.forEach((store) => {
    lookup.set(String(store.id), store)
  })
  return lookup
}

export function buildMarkerSourceCollections(storeFeatures) {
  const baseFeatures = storeFeatures.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      highlighted: 'no',
    },
  }))
  const highlightedFeatures = storeFeatures
    .filter((feature) => feature.properties.highlighted === 'yes')

  return {
    baseFeatures,
    highlightedFeatures,
    baseCollection: buildFeatureCollection(baseFeatures),
    highlightedCollection: buildFeatureCollection(highlightedFeatures),
  }
}

export function buildMapMarkerImagePlan({
  storeFeatures,
  hasImage,
}) {
  const desiredImageIds = new Set()
  const pendingImages = []

  for (const feature of storeFeatures) {
    const storeId = feature.properties.storeId
    const routeOrder = feature.properties.routeOrder || ''
    const name = feature.properties.name || 'Cửa hàng'
    const highlighted = feature.properties.highlighted === 'yes'
    const baseImageId = getBaseMarkerImageId(storeId, routeOrder)

    desiredImageIds.add(baseImageId)
    if (!hasImage(baseImageId)) {
      pendingImages.push({ storeId, text: name, routeOrder, highlighted: false })
    }

    if (highlighted) {
      const highlightedImageId = getHighlightedMarkerImageId(storeId, routeOrder)
      desiredImageIds.add(highlightedImageId)
      if (!hasImage(highlightedImageId)) {
        pendingImages.push({ storeId, text: name, routeOrder, highlighted: true })
      }
    }
  }

  return {
    desiredImageIds,
    pendingImages,
  }
}
