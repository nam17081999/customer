import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/db/client', () => ({
  db: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}))

import { buildStoreDiff, logStoreEditHistory, logStoreEditHistoryBatch } from '@/lib/storeEditHistory'

describe('buildStoreDiff', () => {
  const beforeStore = {
    id: 1,
    name: 'Tạp hóa A',
    address_detail: 'Số 12',
    phone: '0987654321',
    latitude: 21.028511,
    longitude: 105.804817,
    note: 'Cũ',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  }

  it('trả về object rỗng khi không có thay đổi', () => {
    const changes = buildStoreDiff(beforeStore, { name: 'Tạp hóa A' })
    expect(changes).toEqual({})
  })

  it('phát hiện thay đổi tên', () => {
    const changes = buildStoreDiff(beforeStore, { name: 'Tạp hóa B' })
    expect(changes).toHaveProperty('name')
    expect(changes.name).toEqual({ from: 'Tạp hóa A', to: 'Tạp hóa B' })
  })

  it('phát hiện thay đổi phone', () => {
    const changes = buildStoreDiff(beforeStore, { phone: '0912345678' })
    expect(changes).toHaveProperty('phone')
    expect(changes.phone).toEqual({ from: '0987654321', to: '0912345678' })
  })

  it('phát hiện thay đổi tọa độ với normalize 6 số', () => {
    const changes = buildStoreDiff(beforeStore, { latitude: 21.1, longitude: 105.8 })
    expect(changes.latitude).toEqual({ from: 21.028511, to: 21.1 })
    expect(changes.longitude).toEqual({ from: 105.804817, to: 105.8 })
  })

  it('chuẩn hóa coordinate về 6 chữ số thập phân', () => {
    const changes = buildStoreDiff(beforeStore, { latitude: 21.1234567, longitude: 105.1234567 })
    expect(changes.latitude.to).toBe(21.123457)
    expect(changes.longitude.to).toBe(105.123457)
  })

  it('bỏ qua các key bị exclude mặc định (created_at, updated_at, distance)', () => {
    const changes = buildStoreDiff(beforeStore, {
      name: 'Tạp hóa A',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      distance: 999,
    })
    expect(changes).toEqual({})
  })

  it('cho phép tùy chỉnh excludedKeys', () => {
    const changes = buildStoreDiff(beforeStore, { name: 'Mới' }, { excludedKeys: new Set(['name']) })
    expect(changes).toEqual({})
  })

  it('phát hiện nhiều thay đổi cùng lúc', () => {
    const changes = buildStoreDiff(beforeStore, { name: 'Mới', phone: '0999999999', note: 'Mới tinh' })
    expect(Object.keys(changes)).toHaveLength(3)
    expect(changes.name).toBeDefined()
    expect(changes.phone).toBeDefined()
    expect(changes.note).toBeDefined()
  })

  it('coi null và undefined là như nhau (đều là null)', () => {
    const withNull = buildStoreDiff({ ...beforeStore, note: null }, { note: 'mới' })
    expect(withNull.note).toEqual({ from: null, to: 'mới' })
  })

  it('bỏ qua key rỗng', () => {
    const changes = buildStoreDiff(beforeStore, { '': 'value' })
    expect(changes).toEqual({})
  })

  it('xử lý beforeStore là null/undefined an toàn', () => {
    const changes = buildStoreDiff(null, { name: 'ABC' })
    expect(changes.name).toEqual({ from: null, to: 'ABC' })
  })

  it('xử lý afterPartial là null/undefined an toàn', () => {
    const changes = buildStoreDiff(beforeStore, null)
    expect(changes).toEqual({})
  })

  it('chuẩn hóa text: trim và null nếu empty', () => {
    const changes = buildStoreDiff(beforeStore, { name: '  ' })
    expect(changes.name).toEqual({ from: 'Tạp hóa A', to: null })
  })

  it('coi null tọa độ khác 0', () => {
    const before = { ...beforeStore, latitude: null, longitude: null }
    const changes = buildStoreDiff(before, { latitude: 0, longitude: 0 })
    expect(changes.latitude).toEqual({ from: null, to: 0 })
    expect(changes.longitude).toEqual({ from: null, to: 0 })
  })
})

describe('logStoreEditHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trả về error nếu thiếu storeId', async () => {
    const result = await logStoreEditHistory({ actionType: 'edit', changes: { name: { from: 'A', to: 'B' } } })
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('trả về error nếu thiếu actionType', async () => {
    const result = await logStoreEditHistory({ storeId: 1, changes: { name: { from: 'A', to: 'B' } } })
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('skip nếu changes rỗng', async () => {
    const result = await logStoreEditHistory({ storeId: 1, actionType: 'edit', changes: {} })
    expect(result.ok).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('skip nếu changes là null', async () => {
    const result = await logStoreEditHistory({ storeId: 1, actionType: 'edit', changes: null })
    expect(result.ok).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('insert thành công với payload đầy đủ', async () => {
    const { db } = await import('@/api/db/client')
    db.from.mockClear()

    const result = await logStoreEditHistory({
      storeId: 1,
      actionType: 'edit',
      actorUserId: 'user-1',
      actorRole: 'admin',
      changes: { name: { from: 'A', to: 'B' } },
    })

    expect(result.ok).toBe(true)
    expect(db.from).toHaveBeenCalledWith('store_edit_history')
  })
})

describe('logStoreEditHistoryBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skip nếu mảng rỗng', async () => {
    const result = await logStoreEditHistoryBatch([])
    expect(result.ok).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('skip nếu rows không hợp lệ', async () => {
    const result = await logStoreEditHistoryBatch([{ store_id: 1 }])
    expect(result.ok).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('insert batch thành công', async () => {
    const { db } = await import('@/api/db/client')
    db.from.mockClear()

    const result = await logStoreEditHistoryBatch([
      { store_id: 1, action_type: 'edit', changes: { name: { from: 'A', to: 'B' } } },
      { store_id: 2, action_type: 'soft_delete', changes: { deleted_at: { from: null, to: '2026-01-01' } } },
    ])

    expect(result.ok).toBe(true)
    expect(db.from).toHaveBeenCalledWith('store_edit_history')
  })
})
