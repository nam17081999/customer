import { describe, expect, it } from 'vitest'
import { filterMapStoresByAreaSelection } from '@/helper/mapFilter'

function makeStore(district, ward) {
  return { id: 1, name: 'Test Store', district, ward }
}

describe('filterMapStoresByAreaSelection', () => {
  it('trả về toàn bộ stores khi không chọn district nào', () => {
    const stores = [makeStore('Hoài Đức', 'An Khánh')]
    expect(filterMapStoresByAreaSelection(stores, [], [])).toEqual(stores)
  })

  it('chỉ giữ stores thuộc district đã chọn', () => {
    const stores = [
      makeStore('Hoài Đức', 'An Khánh'),
      makeStore('Cầu Giấy', 'Nghĩa Tân'),
    ]
    const result = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], [])
    expect(result).toHaveLength(1)
    expect(result[0].district).toBe('Hoài Đức')
  })

  it('lọc theo ward khi có ward được chọn trong district', () => {
    const stores = [
      makeStore('Hoài Đức', 'An Khánh'),
      makeStore('Hoài Đức', 'Di Trạch'),
    ]
    const result = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], ['An Khánh'])
    expect(result).toHaveLength(1)
    expect(result[0].ward).toBe('An Khánh')
  })

  it('bỏ qua ward filter nếu ward không tồn tại trong district', () => {
    const stores = [
      makeStore('Hoài Đức', 'Some Ward'),
      makeStore('Hoài Đức', 'Another Ward'),
    ]
    const result = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], ['NonExistent Ward'])
    expect(result).toHaveLength(2)
  })

  it('trả về mảng rỗng khi không có store nào khớp', () => {
    const stores = [
      makeStore('Cầu Giấy', 'Nghĩa Tân'),
    ]
    const result = filterMapStoresByAreaSelection(stores, ['Hoài Đức'], [])
    expect(result).toEqual([])
  })
})
