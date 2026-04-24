import { describe, expect, it } from 'vitest'

import { filterMapStoresByAreaSelection } from '@/helper/mapFilter'

function makeStore(overrides = {}) {
  return {
    id: 1,
    name: 'Cửa hàng test',
    district: 'Hoài Đức',
    ward: 'An Khánh',
    ...overrides,
  }
}

describe('filterMapStoresByAreaSelection', () => {
  const stores = [
    makeStore({ id: 1, district: 'Hoài Đức', ward: 'An Khánh' }),
    makeStore({ id: 2, district: 'Hoài Đức', ward: 'An Thượng' }),
    makeStore({ id: 3, district: 'Quốc Oai', ward: 'Yên Sơn' }),
    makeStore({ id: 4, district: 'Quốc Oai', ward: 'Sài Sơn' }),
  ]

  it('không lọc gì khi chưa chọn quận/huyện', () => {
    expect(filterMapStoresByAreaSelection(stores, [], [])).toEqual(stores)
  })

  it('chọn quận/huyện mà chưa chọn xã nào thì hiện toàn bộ quận/huyện đó', () => {
    const results = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], [])
    expect(results.map((store) => store.id)).toEqual([1, 2])
  })

  it('nếu quận/huyện đã chọn có xã được chọn thì chỉ hiện các xã đã chọn của quận/huyện đó', () => {
    const results = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], ['An Khánh'])
    expect(results.map((store) => store.id)).toEqual([1])
  })

  it('mỗi quận/huyện tự áp dụng rule riêng: quận có xã chọn thì chỉ hiện xã đó, quận không có xã chọn thì hiện toàn quận', () => {
    const results = filterMapStoresByAreaSelection(stores, ['Hoài Đức', 'Quốc Oai'], ['An Khánh'])
    expect(results.map((store) => store.id)).toEqual([1, 3, 4])
  })

  it('bỏ các xã được chọn nhưng không thuộc quận/huyện đang xét', () => {
    const results = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], ['Yên Sơn'])
    expect(results.map((store) => store.id)).toEqual([1, 2])
  })
})
