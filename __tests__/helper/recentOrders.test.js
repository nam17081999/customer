import { describe, expect, it, vi } from 'vitest'

// RecentOrders imports formatMoney from inventory-client which imports supabase
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }))

describe('RecentOrders component', () => {
  it('exports RecentOrders function', async () => {
    const mod = await import('@/components/dashboard/recent-orders')
    expect(mod.RecentOrders).toBeDefined()
    expect(typeof mod.RecentOrders).toBe('function')
  })

  it('render khác null khi orders rỗng', async () => {
    const mod = await import('@/components/dashboard/recent-orders')
    const el = mod.RecentOrders({ orders: [], stores: [] })
    expect(el).toBeTruthy()
  })

  it('render khác null khi orders có dữ liệu', async () => {
    const mod = await import('@/components/dashboard/recent-orders')
    const orders = [
      { id: 1, code: 'DH001', status: 'active', total_amount: 100000, customer_store_id: '1', created_at: '2026-07-01T00:00:00Z' },
      { id: 2, code: 'DH002', status: 'delivered', total_amount: 200000, customer_store_id: '2', created_at: '2026-07-02T00:00:00Z' },
    ]
    const stores = [
      { id: 1, name: 'Store A' },
      { id: 2, name: 'Store B' },
    ]
    const el = mod.RecentOrders({ orders, stores })
    expect(el).toBeTruthy()
  })
})

describe('DistrictChart component', () => {
  it('exports DistrictChart function', async () => {
    const mod = await import('@/components/dashboard/district-chart')
    expect(mod.DistrictChart).toBeDefined()
    expect(typeof mod.DistrictChart).toBe('function')
  })

  it('render khác null khi districtRows rỗng', async () => {
    const mod = await import('@/components/dashboard/district-chart')
    const el = mod.DistrictChart({ districtRows: [], topDistrictCount: 1 })
    expect(el).toBeTruthy()
  })

  it('render khác null khi districtRows có dữ liệu', async () => {
    const mod = await import('@/components/dashboard/district-chart')
    const districtRows = [
      { district: 'Hoài Đức', count: 50 },
      { district: 'Đan Phượng', count: 30 },
    ]
    const el = mod.DistrictChart({ districtRows, topDistrictCount: 50 })
    expect(el).toBeTruthy()
  })
})
