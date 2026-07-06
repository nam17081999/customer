import { describe, expect, it } from 'vitest'
import {
  ACTION_LABELS,
  FIELD_LABELS,
  formatFieldValue,
  getAvailableActionTypes,
  getAvailableFields,
  filterEditHistoryItems,
} from '@/helper/storeEditHistoryUI'

describe('ACTION_LABELS', () => {
  it('chứa các action type cơ bản', () => {
    expect(ACTION_LABELS.edit).toBe('Chỉnh sửa')
    expect(ACTION_LABELS.supplement).toBe('Bổ sung')
    expect(ACTION_LABELS.verify).toBe('Xác thực')
    expect(ACTION_LABELS.report_apply).toBe('Duyệt báo cáo')
    expect(ACTION_LABELS.delete_soft).toBe('Xóa mềm')
    expect(ACTION_LABELS.telesale_potential_toggle).toBe('Đổi trạng thái tiềm năng')
  })
})

describe('FIELD_LABELS', () => {
  it('chứa các field cơ bản', () => {
    expect(FIELD_LABELS.name).toBe('Tên')
    expect(FIELD_LABELS.phone).toBe('Số điện thoại')
    expect(FIELD_LABELS.latitude).toBe('Vĩ độ')
  })
})

describe('formatFieldValue', () => {
  it('trả về — khi value null/undefined/rỗng', () => {
    expect(formatFieldValue('name', null)).toBe('\u2014')
    expect(formatFieldValue('name', undefined)).toBe('\u2014')
    expect(formatFieldValue('name', '')).toBe('\u2014')
  })

  it('format latitude/longitude với 6 số thập phân', () => {
    expect(formatFieldValue('latitude', 21.028511)).toBe('21.028511')
    expect(formatFieldValue('longitude', 105.804817)).toBe('105.804817')
  })

  it('trả về — khi lat/lng không phải số', () => {
    expect(formatFieldValue('latitude', 'abc')).toBe('\u2014')
  })

  it('trả về "Có"/"Không" cho key active', () => {
    expect(formatFieldValue('active', true)).toBe('Có')
    expect(formatFieldValue('active', false)).toBe('Không')
  })

  it('trả về "Có"/"Không" cho key deleted_at', () => {
    expect(formatFieldValue('deleted_at', '2026-07-01')).toBe('Có')
    expect(formatFieldValue('deleted_at', null)).toBe('\u2014')
  })

  it('trả về String(value) cho các key khác', () => {
    expect(formatFieldValue('name', 'Minh Anh')).toBe('Minh Anh')
    expect(formatFieldValue('store_type', 'tap_hoa')).toBe('tap_hoa')
    expect(formatFieldValue('note', 'Ghi chú')).toBe('Ghi chú')
  })
})

describe('getAvailableActionTypes', () => {
  it('trả về danh sách action type duy nhất, sorted', () => {
    const items = [
      { action_type: 'edit' },
      { action_type: 'verify' },
      { action_type: 'edit' },
    ]
    expect(getAvailableActionTypes(items)).toEqual(['edit', 'verify'])
  })

  it('bỏ qua items không có action_type', () => {
    const items = [{ action_type: 'edit' }, {}]
    expect(getAvailableActionTypes(items)).toEqual(['edit'])
  })

  it('trả về mảng rỗng khi items rỗng', () => {
    expect(getAvailableActionTypes([])).toEqual([])
  })
})

describe('getAvailableFields', () => {
  it('trả về danh sách field duy nhất từ changes', () => {
    const items = [
      { id: '1', changes: { name: { from: 'A', to: 'B' }, phone: { from: '', to: '123' } } },
      { id: '2', changes: { name: { from: 'C', to: 'D' }, address_detail: { from: '', to: 'Số 1' } } },
    ]
    expect(getAvailableFields(items)).toEqual(['address_detail', 'name', 'phone'])
  })

  it('bỏ qua items không có changes hoặc changes không phải object', () => {
    const items = [{ id: '1', changes: { name: { from: 'A', to: 'B' } } }, { id: '2' }]
    expect(getAvailableFields(items)).toEqual(['name'])
  })

  it('trả về mảng rỗng khi items rỗng', () => {
    expect(getAvailableFields([])).toEqual([])
  })
})

describe('filterEditHistoryItems', () => {
  const items = [
    { id: '1', action_type: 'edit', actor_role: 'admin', changes: { name: { from: 'A', to: 'B' } }, created_at: '2026-07-01T00:00:00Z' },
    { id: '2', action_type: 'verify', actor_role: 'admin', changes: { active: { from: false, to: true } }, created_at: '2026-07-02T00:00:00Z' },
    { id: '3', action_type: 'edit', actor_role: 'manager', changes: { phone: { from: '', to: '123' }, note: { from: '', to: 'OK' } }, created_at: '2026-07-03T00:00:00Z' },
  ]

  it('trả về toàn bộ items khi không có filter', () => {
    const result = filterEditHistoryItems({ items })
    expect(result).toHaveLength(3)
  })

  it('lọc theo actionFilter', () => {
    const result = filterEditHistoryItems({ items, actionFilter: 'edit' })
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(['1', '3'])
  })

  it('lọc theo fieldFilter', () => {
    const result = filterEditHistoryItems({ items, fieldFilter: 'name' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('kết hợp actionFilter và fieldFilter', () => {
    const result = filterEditHistoryItems({ items, actionFilter: 'edit', fieldFilter: 'name' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('lọc theo searchTerm tìm trong action label', () => {
    const result = filterEditHistoryItems({ items, searchTerm: 'sửa' })
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual(['1', '3'])
  })

  it('lọc theo searchTerm tìm trong field keys', () => {
    const result = filterEditHistoryItems({ items, searchTerm: 'phone' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('lọc theo searchTerm tìm trong actor_role', () => {
    const result = filterEditHistoryItems({ items, searchTerm: 'manager' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('trả về mảng rỗng khi không có item nào khớp', () => {
    const result = filterEditHistoryItems({ items, searchTerm: 'xyz' })
    expect(result).toHaveLength(0)
  })

  it('default params an toàn', () => {
    const result = filterEditHistoryItems({})
    expect(result).toEqual([])
  })
})
