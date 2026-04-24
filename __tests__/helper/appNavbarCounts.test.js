import { describe, expect, it, vi } from 'vitest'
import { getAdminNavbarCounts, shouldRefreshNavbarCountsForEvent } from '@/helper/appNavbarCounts'

describe('app navbar count sync', () => {
  it('đọc danh sách store mới qua refresh function để badge không phụ thuộc cache cũ', async () => {
    const getStores = vi.fn().mockResolvedValue([
      { id: 1, active: false },
      { id: 2, active: true },
      { id: 3, active: null },
    ])
    const getPendingReports = vi.fn().mockResolvedValue(2)

    const result = await getAdminNavbarCounts({
      isAdmin: true,
      getStores,
      getPendingReports,
    })

    expect(getStores).toHaveBeenCalledTimes(1)
    expect(getPendingReports).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ pendingStores: 2, pendingReports: 2 })
  })

  it('trả count rỗng và không gọi remote khi không phải admin', async () => {
    const getStores = vi.fn()
    const getPendingReports = vi.fn()

    const result = await getAdminNavbarCounts({
      isAdmin: false,
      getStores,
      getPendingReports,
    })

    expect(getStores).not.toHaveBeenCalled()
    expect(getPendingReports).not.toHaveBeenCalled()
    expect(result).toEqual({ pendingStores: 0, pendingReports: 0 })
  })

  it('refresh badge khi store hoặc report thay đổi', () => {
    expect(shouldRefreshNavbarCountsForEvent('storevis:stores-changed')).toBe(true)
    expect(shouldRefreshNavbarCountsForEvent('storevis:reports-changed')).toBe(true)
    expect(shouldRefreshNavbarCountsForEvent('storevis:search-route-changed')).toBe(false)
  })
})
