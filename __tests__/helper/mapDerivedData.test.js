import { describe, expect, it } from 'vitest'

import {
  buildFeatureCollection,
  buildMapMarkerImagePlan,
  buildMapStoreFeatures,
  buildMarkerSourceCollections,
  buildStoreLookupMap,
  buildVisibleMapStores,
  createMapFeatureBaseCache,
} from '@/helper/mapDerivedData'

function makeStore(overrides = {}) {
  return {
    id: 1,
    name: 'Cửa Hàng Minh Anh',
    district: 'Hoài Đức',
    ward: 'An Khánh',
    address_detail: 'Số 1',
    coords: { lat: 21.02861, lng: 105.80492 },
    ...overrides,
  }
}

describe('buildVisibleMapStores', () => {
  it('trả về toàn bộ filtered stores khi không ẩn store ngoài route', () => {
    const filteredStores = [makeStore({ id: 1 }), makeStore({ id: 2 })]
    const results = buildVisibleMapStores({
      filteredStores,
      hideUnselectedStores: false,
      routeStopIds: new Set(['2']),
    })

    expect(results.map((store) => store.id)).toEqual([1, 2])
  })

  it('trả về toàn bộ filtered stores khi route stop rỗng', () => {
    const filteredStores = [makeStore({ id: 1 }), makeStore({ id: 2 })]
    const results = buildVisibleMapStores({
      filteredStores,
      hideUnselectedStores: true,
      routeStopIds: new Set(),
    })

    expect(results.map((store) => store.id)).toEqual([1, 2])
  })

  it('chỉ giữ các store có trong route stop khi bật hideUnselectedStores', () => {
    const filteredStores = [makeStore({ id: 1 }), makeStore({ id: 2 }), makeStore({ id: 3 })]
    const results = buildVisibleMapStores({
      filteredStores,
      hideUnselectedStores: true,
      routeStopIds: new Set(['2', '3']),
    })

    expect(results.map((store) => store.id)).toEqual([2, 3])
  })
})

describe('buildMapStoreFeatures', () => {
  it('tạo GeoJSON features đúng properties hiện tại', () => {
    const features = buildMapStoreFeatures({
      visibleMapStores: [makeStore({ id: 2, name: 'Cửa Hàng Minh Anh' })],
      highlightedStoreId: '',
      completedRouteStopIdSet: new Set(['2']),
      routeStopOrderById: new Map([['2', '1']]),
    })

    expect(features).toHaveLength(1)
    expect(features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [105.80492, 21.02861] },
      properties: {
        storeId: '2',
        name: 'Cửa Hàng Minh Anh',
        shortName: 'Minh',
        address: 'Số 1, An Khánh, Hoài Đức',
        routeOrder: '1',
        passed: 'yes',
        highlighted: 'no',
      },
    })
  })

  it('giữ nguyên output khi dùng base feature cache', () => {
    const featureBaseCache = createMapFeatureBaseCache()
    const visibleMapStores = [
      makeStore({ id: 1, name: 'Cửa Hàng Minh Anh' }),
      makeStore({ id: 2, name: 'Tạp Hóa Hoa Lan' }),
    ]

    const features = buildMapStoreFeatures({
      visibleMapStores,
      highlightedStoreId: '2',
      completedRouteStopIdSet: new Set(['1']),
      routeStopOrderById: new Map([['1', '1'], ['2', '2']]),
      featureBaseCache,
    })

    expect(features.map((feature) => feature.properties.storeId)).toEqual(['1', '2'])
    expect(features[0].properties).toMatchObject({ routeOrder: '1', passed: 'yes', highlighted: 'no' })
    expect(features[1].properties).toMatchObject({ routeOrder: '2', passed: 'no', highlighted: 'yes' })
  })

  it('tái sử dụng base feature cho cùng store khi dữ liệu tĩnh không đổi', () => {
    const featureBaseCache = createMapFeatureBaseCache()
    const store = makeStore({ id: 7, name: 'Cửa Hàng Minh Anh' })

    buildMapStoreFeatures({
      visibleMapStores: [store],
      highlightedStoreId: '',
      completedRouteStopIdSet: new Set(),
      routeStopOrderById: new Map(),
      featureBaseCache,
    })

    const cachedBase = featureBaseCache.get('7')

    buildMapStoreFeatures({
      visibleMapStores: [store],
      highlightedStoreId: '7',
      completedRouteStopIdSet: new Set(['7']),
      routeStopOrderById: new Map([['7', '1']]),
      featureBaseCache,
    })

    expect(featureBaseCache.get('7')).toBe(cachedBase)
  })

  it('đẩy feature của highlighted store xuống cuối danh sách như hiện tại', () => {
    const features = buildMapStoreFeatures({
      visibleMapStores: [
        makeStore({ id: 1, name: 'Cửa Hàng Minh Anh' }),
        makeStore({ id: 2, name: 'Tạp Hóa Hoa Lan' }),
        makeStore({ id: 3, name: 'Quán Ăn Gia Đình' }),
      ],
      highlightedStoreId: '2',
      completedRouteStopIdSet: new Set(),
      routeStopOrderById: new Map(),
    })

    expect(features.map((feature) => feature.properties.storeId)).toEqual(['1', '3', '2'])
    expect(features[2].properties.highlighted).toBe('yes')
  })
})

describe('buildFeatureCollection', () => {
  it('bọc features thành GeoJSON FeatureCollection chuẩn', () => {
    const features = [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { storeId: '1' } }]
    expect(buildFeatureCollection(features)).toEqual({
      type: 'FeatureCollection',
      features,
    })
  })
})

describe('buildStoreLookupMap', () => {
  it('tạo lookup map từ visible stores theo storeId', () => {
    const visibleMapStores = [makeStore({ id: 1 }), makeStore({ id: 2 })]
    const lookup = buildStoreLookupMap(visibleMapStores)
    expect(Array.from(lookup.keys())).toEqual(['1', '2'])
    expect(lookup.get('2')?.id).toBe(2)
  })
})

describe('buildMarkerSourceCollections', () => {
  it('giữ toàn bộ features ở base source và tách highlighted feature ra source overlay riêng', () => {
    const storeFeatures = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [105.8, 21.0] },
        properties: { storeId: '1', name: 'A', routeOrder: '', highlighted: 'no', passed: 'no' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [105.9, 21.1] },
        properties: { storeId: '2', name: 'B', routeOrder: '3', highlighted: 'yes', passed: 'yes' },
      },
    ]

    const collections = buildMarkerSourceCollections(storeFeatures)

    expect(collections.baseFeatures.map((feature) => feature.properties.storeId)).toEqual(['1', '2'])
    expect(collections.baseFeatures[1].properties.highlighted).toBe('no')
    expect(collections.highlightedFeatures.map((feature) => feature.properties.storeId)).toEqual(['2'])
    expect(collections.highlightedFeatures[0].properties.highlighted).toBe('yes')
    expect(collections.baseCollection.type).toBe('FeatureCollection')
    expect(collections.highlightedCollection.type).toBe('FeatureCollection')
  })
})

describe('buildMapMarkerImagePlan', () => {
  it('tạo đúng desired image ids và pending images từ features', () => {
    const storeFeatures = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [105.8, 21.0] },
        properties: { storeId: '1', name: 'A', routeOrder: '', highlighted: 'no' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [105.9, 21.1] },
        properties: { storeId: '2', name: 'B', routeOrder: '3', highlighted: 'yes' },
      },
    ]

    const plan = buildMapMarkerImagePlan({
      storeFeatures,
      hasImage: (imageId) => imageId === 'sm-1',
    })

    expect(Array.from(plan.desiredImageIds)).toEqual(['sm-1', 'smr-2-3', 'smrh-2-3'])
    expect(plan.pendingImages).toEqual([
      { storeId: '2', text: 'B', routeOrder: '3', highlighted: false },
      { storeId: '2', text: 'B', routeOrder: '3', highlighted: true },
    ])
  })
})
