import { describe, expect, it } from 'vitest'

import {
  FIXED_ROUTE_POINT,
  ROUTE_STOP_STATUS,
  applyOptimizedRouteOrder,
  buildCompletedRouteStopIdSet,
  buildNavigationInfo,
  buildPersistedRoutePlan,
  buildRouteBounds,
  buildRouteRequestStops,
  buildRouteStopIdSet,
  buildRouteStopOrderById,
  formatRouteDistance,
  formatRouteDuration,
  formatShortAddress,
  moveItem,
  reconcileRouteStopStatus,
  seedRouteStopStatuses,
} from '@/helper/mapRoute'

function makeStore(overrides = {}) {
  return {
    id: overrides.id || 'store-1',
    name: overrides.name || 'Cửa hàng test',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    coords: overrides.coords || { lat: 21.02851, lng: 105.80482 },
  }
}

describe('mapRoute helpers', () => {
  it('format địa chỉ ngắn và format khoảng cách/thời gian đúng', () => {
    expect(formatShortAddress(makeStore())).toBe('An Khánh, Hoài Đức')
    expect(formatRouteDistance(120)).toBe('120 m')
    expect(formatRouteDistance(1800)).toBe('1.8 km')
    expect(formatRouteDuration(600)).toBe('10 phút')
    expect(formatRouteDuration(3660)).toBe('1 giờ 1 phút')
  })

  it('moveItem đổi vị trí phần tử đúng', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('build route stop ids, order và completed set đúng theo trạng thái', () => {
    const routeStops = [
      makeStore({ id: 's1' }),
      makeStore({ id: 's2' }),
      makeStore({ id: 's3' }),
    ]
    const statuses = {
      s1: ROUTE_STOP_STATUS.COMPLETED,
      s2: ROUTE_STOP_STATUS.PENDING,
      s3: ROUTE_STOP_STATUS.ARRIVED,
    }

    expect(Array.from(buildRouteStopIdSet(routeStops))).toEqual(['s1', 's2', 's3'])
    expect(Array.from(buildCompletedRouteStopIdSet(routeStops, statuses))).toEqual(['s1'])
    expect(Array.from(buildRouteStopOrderById(routeStops, statuses).entries())).toEqual([
      ['s2', '1'],
      ['s3', '2'],
    ])
  })

  it('build payload lưu route và payload request route đúng', () => {
    const routeStops = [
      makeStore({ id: 's1', name: 'Điểm 1' }),
      makeStore({ id: 's2', name: 'Điểm 2', coords: { lat: 21.03, lng: 105.81 } }),
    ]
    const statuses = { s1: ROUTE_STOP_STATUS.COMPLETED }

    expect(buildPersistedRoutePlan(routeStops, true)).toEqual({
      routeStopIds: ['s1', 's2'],
      hideUnselectedStores: true,
    })

    expect(buildRouteRequestStops(routeStops, statuses)).toEqual([
      { id: 's2', name: 'Điểm 2', lat: 21.03, lng: 105.81 },
    ])

    expect(buildRouteRequestStops(routeStops, statuses, { includeCompleted: true })).toEqual([
      { id: 's1', name: 'Điểm 1', lat: 21.02851, lng: 105.80482 },
      { id: 's2', name: 'Điểm 2', lat: 21.03, lng: 105.81 },
    ])
  })

  it('seed trạng thái route giữ trạng thái cũ và mặc định pending cho điểm mới', () => {
    const routeStops = [
      makeStore({ id: 's1' }),
      makeStore({ id: 's2' }),
    ]

    expect(seedRouteStopStatuses(routeStops, { s1: ROUTE_STOP_STATUS.COMPLETED })).toEqual({
      s1: ROUTE_STOP_STATUS.COMPLETED,
      s2: ROUTE_STOP_STATUS.PENDING,
    })
  })

  it('áp thứ tự optimize trả về và lỗi nếu thiếu id', () => {
    const routeStops = [
      makeStore({ id: 's1', name: 'Điểm 1' }),
      makeStore({ id: 's2', name: 'Điểm 2' }),
      makeStore({ id: 's3', name: 'Điểm 3' }),
    ]

    expect(applyOptimizedRouteOrder(routeStops, ['s3', 's1', 's2']).map((store) => store.id)).toEqual(['s3', 's1', 's2'])
    expect(() => applyOptimizedRouteOrder(routeStops, ['s3', 's1'])).toThrow('Không thể sắp xếp lại đầy đủ danh sách cửa hàng.')
  })

  it('buildRouteBounds tính bounds từ geometry hợp lệ', () => {
    expect(buildRouteBounds({
      coordinates: [
        [105.7, 21.01],
        [105.9, 21.05],
        [105.6, 21.02],
      ],
    })).toEqual([
      [105.6, 21.01],
      [105.9, 21.05],
    ])
  })

  it('reconcileRouteStopStatus đánh dấu arrived khi tới gần và completed khi đi xa', () => {
    const routeStops = [
      makeStore({ id: 's1', coords: { lat: 21.02851, lng: 105.80482 } }),
      makeStore({ id: 's2', coords: { lat: 21.04, lng: 105.82 } }),
    ]

    const arrived = reconcileRouteStopStatus({
      followUserHeading: true,
      routeStops,
      routeStopStatusById: {},
      userLocation: { latitude: 21.02852, longitude: 105.80483 },
    })
    expect(arrived).toEqual({
      changed: true,
      nextRouteStopStatusById: {
        s1: ROUTE_STOP_STATUS.ARRIVED,
        s2: ROUTE_STOP_STATUS.PENDING,
      },
    })

    const completed = reconcileRouteStopStatus({
      followUserHeading: true,
      routeStops,
      routeStopStatusById: arrived.nextRouteStopStatusById,
      userLocation: { latitude: 21.0315, longitude: 105.8095 },
    })
    expect(completed).toEqual({
      changed: true,
      nextRouteStopStatusById: {
        s1: ROUTE_STOP_STATUS.COMPLETED,
        s2: ROUTE_STOP_STATUS.PENDING,
      },
    })
  })

  it('buildNavigationInfo trả đúng trạng thái hiện tại, tiếp theo và khoảng cách', () => {
    const routeStops = [
      makeStore({ id: 's1', name: 'Điểm 1', coords: { lat: 21.02851, lng: 105.80482 } }),
      makeStore({ id: 's2', name: 'Điểm 2', coords: { lat: 21.03, lng: 105.806 } }),
    ]

    expect(buildNavigationInfo({
      followUserHeading: true,
      routeStops,
      routeStopStatusById: { s1: ROUTE_STOP_STATUS.ARRIVED, s2: ROUTE_STOP_STATUS.PENDING },
      userLocation: { latitude: 21.02851, longitude: 105.80482 },
    })).toMatchObject({
      currentLabel: 'Hiện tại',
      currentStore: { id: 's1', name: 'Điểm 1' },
      nextStore: { id: 's2', name: 'Điểm 2' },
    })

    expect(buildNavigationInfo({
      followUserHeading: true,
      routeStops,
      routeStopStatusById: { s1: ROUTE_STOP_STATUS.COMPLETED, s2: ROUTE_STOP_STATUS.PENDING },
      userLocation: { latitude: FIXED_ROUTE_POINT.lat, longitude: FIXED_ROUTE_POINT.lng },
    })).toMatchObject({
      currentLabel: 'Hiện tại',
      currentText: 'Kho',
      nextStore: { id: 's2', name: 'Điểm 2' },
    })

    expect(buildNavigationInfo({
      followUserHeading: true,
      routeStops,
      routeStopStatusById: { s1: ROUTE_STOP_STATUS.COMPLETED, s2: ROUTE_STOP_STATUS.COMPLETED },
      userLocation: { latitude: 21.05, longitude: 105.83 },
    })).toMatchObject({
      currentLabel: 'Đã qua',
      currentStore: { id: 's2', name: 'Điểm 2' },
      nextStore: null,
      nextDistanceMeters: 0,
    })
  })
})
