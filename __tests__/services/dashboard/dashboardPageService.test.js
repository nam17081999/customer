import { describe, expect, it, vi } from 'vitest'

describe('loadDashboardData', () => {
  it('gọi đúng 6 API functions và trả về shape chuẩn', async () => {
    const { loadDashboardData } = await import('@/services/dashboard/dashboard-page-service')

    const mockStores = [{ id: 1, name: 'Store A', active: true, district: 'A', ward: 'X', created_at: '2026-07-01T00:00:00Z' }]
    const mockProducts = [{ id: 1, name: 'Product A', onHandBaseQty: 10, min_stock_base_qty: 5 }]
    const mockOrders = [{ id: 1, code: 'DH001', status: 'active', total_amount: 1000, gross_profit_amount: 200, created_at: '2026-07-01T00:00:00Z' }]
    const mockPurchases = [{ id: 1, total_amount: 500, cancelled_at: null }]
    const mockReconciliation = [{ issue_codes: [] }]
    const mockAggregate = {
      sales: { order_count: 5, revenue: 5000000, profit: 500000 },
      purchases: { purchase_count: 2, purchase_amount: 2000000 },
      inventory: { low_stock_count: 3 },
    }

    const deps = {
      getStores: vi.fn().mockResolvedValue(mockStores),
      listProducts: vi.fn().mockResolvedValue(mockProducts),
      listOrders: vi.fn().mockResolvedValue(mockOrders),
      listPurchases: vi.fn().mockResolvedValue({ orders: mockPurchases }),
      getReconciliation: vi.fn().mockResolvedValue(mockReconciliation),
      getAggregate: vi.fn().mockResolvedValue(mockAggregate),
    }

    const result = await loadDashboardData(deps)

    expect(result).toHaveProperty('stores')
    expect(result).toHaveProperty('products')
    expect(result).toHaveProperty('orders')
    expect(result).toHaveProperty('purchases')
    expect(result).toHaveProperty('reconciliationRows')
    expect(result).toHaveProperty('aggregateReport')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('health')

    expect(deps.getStores).toHaveBeenCalledTimes(1)
    expect(deps.listProducts).toHaveBeenCalledTimes(1)
    expect(deps.listOrders).toHaveBeenCalledTimes(1)
    expect(deps.listPurchases).toHaveBeenCalledTimes(1)
    expect(deps.getReconciliation).toHaveBeenCalledTimes(1)
    expect(deps.getAggregate).toHaveBeenCalledTimes(1)
  })

  it('tính summary đúng từ stores', async () => {
    const { loadDashboardData } = await import('@/services/dashboard/dashboard-page-service')

    const stores = [
      { id: 1, active: true, district: 'A', ward: 'X', created_at: '2026-07-01T00:00:00Z' },
      { id: 2, active: false, district: 'A', ward: 'Y', created_at: '2026-07-02T00:00:00Z' },
      { id: 3, active: true, district: 'B', ward: 'Z', created_at: '2026-07-03T00:00:00Z' },
    ]

    const result = await loadDashboardData({
      getStores: vi.fn().mockResolvedValue(stores),
      listProducts: vi.fn().mockResolvedValue([]),
      listOrders: vi.fn().mockResolvedValue([]),
      listPurchases: vi.fn().mockResolvedValue({ orders: [] }),
      getReconciliation: vi.fn().mockResolvedValue([]),
      getAggregate: vi.fn().mockRejectedValue(new Error('no aggregate')),
    })

    expect(result.summary.totalStores).toBe(3)
    expect(result.summary.verifiedStores).toBe(2)
    expect(result.summary.unverifiedStores).toBe(1)
    expect(result.summary.districtRows).toHaveLength(2)
    expect(result.summary.districtRows[0].district).toBe('A')
    expect(result.summary.districtRows[0].count).toBe(2)
    expect(result.summary.districtCount).toBe(2)
    expect(result.summary.wardCount).toBe(3)
  })

  it('xử lý error gracefully — fallback health khi aggregate fail', async () => {
    const { loadDashboardData } = await import('@/services/dashboard/dashboard-page-service')

    const result = await loadDashboardData({
      getStores: vi.fn().mockResolvedValue([]),
      listProducts: vi.fn().mockResolvedValue([]),
      listOrders: vi.fn().mockResolvedValue([]),
      listPurchases: vi.fn().mockResolvedValue({ orders: [] }),
      getReconciliation: vi.fn().mockResolvedValue([]),
      getAggregate: vi.fn().mockRejectedValue(new Error('network error')),
    })

    expect(result.aggregateReport).toBeNull()
    expect(result.health).toBeDefined()
    expect(result.health.revenue).toBe(0)
  })

  it('xử lý error tổng thể — trả về error message', async () => {
    const { loadDashboardData } = await import('@/services/dashboard/dashboard-page-service')

    const result = await loadDashboardData({
      getStores: vi.fn().mockRejectedValue(new Error('supabase down')),
    })

    expect(result.error).toBe('Không tải được dữ liệu tổng quan. Vui lòng thử lại.')
    expect(result.loading).toBe(false)
  })
})
