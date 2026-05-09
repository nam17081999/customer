import { describe, expect, it } from 'vitest'

import {
  NEARBY_STORES_LIMIT,
  buildNearbyStoresSignature,
  selectNearestStores,
} from '@/helper/nearbyStores'

function store(id, lat, lng) {
  return {
    id,
    name: `Store ${id}`,
    coords: { lat, lng },
  }
}

describe('selectNearestStores', () => {
  it('chọn đúng cửa hàng gần nhất theo thứ tự gần đến xa', () => {
    const result = selectNearestStores([
      store('far', 21.02, 105.82),
      store('near', 21.0001, 105.8001),
      store('middle', 21.005, 105.805),
    ], 21, 105.8, 2)

    expect(result.map((item) => item.id)).toEqual(['near', 'middle'])
    expect(result[0].distance).toBeLessThan(result[1].distance)
  })

  it('giới hạn mặc định tối đa 50 cửa hàng gần nhất theo rule docs', () => {
    const stores = Array.from({ length: NEARBY_STORES_LIMIT + 10 }, (_, index) => (
      store(`store-${index}`, 21 + index * 0.0001, 105.8)
    ))

    const result = selectNearestStores(stores, 21, 105.8)

    expect(result).toHaveLength(50)
    expect(result.at(-1).id).toBe('store-49')
  })

  it('bỏ qua store thiếu tọa độ hợp lệ', () => {
    const result = selectNearestStores([
      store('valid', 21.001, 105.801),
      { id: 'missing', coords: null },
      { id: 'invalid', coords: { lat: Number.NaN, lng: 105.8 } },
    ], 21, 105.8)

    expect(result.map((item) => item.id)).toEqual(['valid'])
  })

  it('trả về rỗng khi tâm hoặc limit không hợp lệ', () => {
    expect(selectNearestStores([store('a', 21, 105.8)], null, 105.8)).toEqual([])
    expect(selectNearestStores([store('a', 21, 105.8)], 21, 105.8, 0)).toEqual([])
  })
})

describe('buildNearbyStoresSignature', () => {
  it('tạo chữ ký ổn định theo thứ tự store đang render', () => {
    expect(buildNearbyStoresSignature([{ id: 1 }, { id: '2' }])).toBe('1|2')
  })
})
