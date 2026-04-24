import { describe, expect, it } from 'vitest'

import {
  buildRenderedRouteStops,
  getRouteAutoScrollDelta,
  getRouteDragTargetIndex,
} from '@/helper/mapRouteDrag'

function makeStore(id) {
  return { id: `store-${id}`, name: `Store ${id}` }
}

describe('mapRouteDrag helpers', () => {
  it('buildRenderedRouteStops giữ nguyên thứ tự khi chưa kéo và đổi đúng khi đang kéo', () => {
    const routeStops = [makeStore(1), makeStore(2), makeStore(3)]

    expect(buildRenderedRouteStops(routeStops, -1, -1)).toEqual([
      { store: routeStops[0], originalIndex: 0, displayIndex: 0 },
      { store: routeStops[1], originalIndex: 1, displayIndex: 1 },
      { store: routeStops[2], originalIndex: 2, displayIndex: 2 },
    ])

    expect(buildRenderedRouteStops(routeStops, 0, 2)).toEqual([
      { store: routeStops[1], originalIndex: 1, displayIndex: 0 },
      { store: routeStops[2], originalIndex: 2, displayIndex: 1 },
      { store: routeStops[0], originalIndex: 0, displayIndex: 2 },
    ])
  })

  it('getRouteDragTargetIndex chọn mục tiêu theo nửa trên/nửa dưới của item', () => {
    const entries = [
      [0, { top: 100, height: 40 }],
      [1, { top: 140, height: 40 }],
      [2, { top: 180, height: 40 }],
    ]

    expect(getRouteDragTargetIndex(entries, 105)).toBe(0)
    expect(getRouteDragTargetIndex(entries, 159)).toBe(1)
    expect(getRouteDragTargetIndex(entries, 260)).toBe(2)
  })

  it('getRouteAutoScrollDelta trả delta âm/dương đúng theo vị trí con trỏ', () => {
    const rect = { top: 100, bottom: 400 }

    expect(getRouteAutoScrollDelta(rect, 120)).toBeLessThan(0)
    expect(getRouteAutoScrollDelta(rect, 380)).toBeGreaterThan(0)
    expect(getRouteAutoScrollDelta(rect, 250)).toBe(0)
  })
})
