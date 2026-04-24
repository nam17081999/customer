import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        range: vi.fn(),
        gt: vi.fn(),
      })),
    })),
  },
}))

import {
  appendStoreToCache,
  appendStoresToCache,
  getCachedStores,
  invalidateStoreCache,
  removeStoreFromCache,
  setCachedStores,
  updateStoreInCache,
  updateStoresInCache,
} from '@/lib/storeCache'

describe('storeCache mutation helpers', () => {
  beforeEach(async () => {
    await invalidateStoreCache()
  })

  it('appendStoreToCache thêm store mới và tăng cacheVersion', async () => {
    await setCachedStores(
      [{ id: 1, name: 'Tạp hóa A', updated_at: '2026-04-01T00:00:00.000Z' }],
      1,
      { cacheVersion: 4 }
    )

    await appendStoreToCache({ id: 2, name: 'Tạp hóa B', updated_at: '2026-04-02T00:00:00.000Z' })

    const cached = await getCachedStores()
    expect(cached.count).toBe(2)
    expect(cached.cacheVersion).toBe(5)
    expect(cached.data.map((store) => store.id)).toEqual([1, 2])
    expect(cached.lastSyncedAt).toBe('2026-04-02T00:00:00.000Z')
  })

  it('appendStoreToCache merge theo id thay vì tạo bản ghi trùng', async () => {
    await setCachedStores(
      [{ id: 1, name: 'Tạp hóa A', note: 'cũ', updated_at: '2026-04-01T00:00:00.000Z' }],
      1,
      { cacheVersion: 7 }
    )

    await appendStoreToCache({ id: 1, note: 'mới', updated_at: '2026-04-03T00:00:00.000Z' })

    const cached = await getCachedStores()
    expect(cached.count).toBe(1)
    expect(cached.cacheVersion).toBe(8)
    expect(cached.data).toEqual([
      {
        id: 1,
        name: 'Tạp hóa A',
        note: 'mới',
        updated_at: '2026-04-03T00:00:00.000Z',
      },
    ])
  })

  it('appendStoresToCache chỉ thêm id mới và bỏ qua batch chỉ toàn store đã có', async () => {
    await setCachedStores(
      [{ id: 1, name: 'Tạp hóa A', updated_at: '2026-04-01T00:00:00.000Z' }],
      1,
      { cacheVersion: 10 }
    )

    await appendStoresToCache([
      { id: 1, name: 'Tạp hóa A cập nhật', updated_at: '2026-04-02T00:00:00.000Z' },
      { id: 2, name: 'Tạp hóa B', updated_at: '2026-04-03T00:00:00.000Z' },
    ])

    let cached = await getCachedStores()
    expect(cached.count).toBe(2)
    expect(cached.cacheVersion).toBe(11)
    expect(cached.data.find((store) => store.id === 1)?.name).toBe('Tạp hóa A cập nhật')

    await appendStoresToCache([
      { id: 1, name: 'Tạp hóa A mới hơn', updated_at: '2026-04-04T00:00:00.000Z' },
      { id: 2, name: 'Tạp hóa B mới hơn', updated_at: '2026-04-04T00:00:00.000Z' },
    ])

    cached = await getCachedStores()
    expect(cached.count).toBe(2)
    expect(cached.cacheVersion).toBe(11)
  })

  it('removeStoreFromCache xóa store khỏi cache và trả về removed=true', async () => {
    await setCachedStores(
      [
        { id: 1, name: 'Tạp hóa A', updated_at: '2026-04-01T00:00:00.000Z' },
        { id: 2, name: 'Tạp hóa B', updated_at: '2026-04-02T00:00:00.000Z' },
      ],
      2,
      { cacheVersion: 2 }
    )

    const result = await removeStoreFromCache(1)
    const cached = await getCachedStores()

    expect(result).toEqual({ removed: true, cacheLength: 1 })
    expect(cached.count).toBe(1)
    expect(cached.cacheVersion).toBe(3)
    expect(cached.data.map((store) => store.id)).toEqual([2])
  })

  it('updateStoreInCache merge patch theo id và giữ nguyên count', async () => {
    await setCachedStores(
      [{ id: 1, name: 'Tạp hóa A', note: 'cũ', updated_at: '2026-04-01T00:00:00.000Z' }],
      1,
      { cacheVersion: 5 }
    )

    const result = await updateStoreInCache(1, {
      note: 'mới',
      phone: '0901234567',
      updated_at: '2026-04-05T00:00:00.000Z',
    })

    const cached = await getCachedStores()
    expect(result).toEqual({ updated: true })
    expect(cached.count).toBe(1)
    expect(cached.cacheVersion).toBe(6)
    expect(cached.data[0]).toMatchObject({
      id: 1,
      name: 'Tạp hóa A',
      note: 'mới',
      phone: '0901234567',
    })
  })

  it('updateStoresInCache gộp patch trùng id và cập nhật nhiều store cùng lúc', async () => {
    await setCachedStores(
      [
        { id: 1, name: 'Tạp hóa A', note: 'cũ' },
        { id: 2, name: 'Tạp hóa B', note: 'cũ' },
      ],
      2,
      { cacheVersion: 8 }
    )

    const result = await updateStoresInCache([
      { id: 1, note: 'mới' },
      { id: 1, phone: '0901111111' },
      { id: 2, active: true },
      { id: 99, name: 'không có trong cache' },
    ])

    const cached = await getCachedStores()
    expect(result).toEqual({ updatedCount: 2 })
    expect(cached.count).toBe(2)
    expect(cached.cacheVersion).toBe(9)
    expect(cached.data.find((store) => store.id === 1)).toMatchObject({
      id: 1,
      note: 'mới',
      phone: '0901111111',
    })
    expect(cached.data.find((store) => store.id === 2)).toMatchObject({
      id: 2,
      active: true,
    })
  })
})
