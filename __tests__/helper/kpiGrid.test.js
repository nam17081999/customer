import { beforeEach, describe, expect, it, vi } from 'vitest'

// KpiGrid imports formatMoney from inventory-client which imports supabase
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }))

describe('KpiGrid component', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exports KpiGrid function', async () => {
    const mod = await import('@/components/dashboard/kpi-grid')
    expect(mod.KpiGrid).toBeDefined()
    expect(typeof mod.KpiGrid).toBe('function')
  })

  it('render khác null khi loading=true', async () => {
    const mod = await import('@/components/dashboard/kpi-grid')
    const el = mod.KpiGrid({ loading: true, error: null, summary: null, health: null })
    expect(el).toBeTruthy()
  })

  it('render khác null khi error có giá trị', async () => {
    const mod = await import('@/components/dashboard/kpi-grid')
    const el = mod.KpiGrid({ loading: false, error: 'Có lỗi', summary: null, health: null })
    expect(el).toBeTruthy()
  })

  it('render KPI cards với summary và health data', async () => {
    const mod = await import('@/components/dashboard/kpi-grid')
    const summary = {
      totalStores: 100, verifiedStores: 80, unverifiedStores: 20,
      verificationRate: 80, last7DaysStores: 5,
      districtRows: [{ district: 'A', count: 50 }, { district: 'B', count: 30 }],
      topDistrictCount: 50,
      districtCount: 2, wardCount: 10,
      newestCreatedAt: '2026-07-01T00:00:00Z',
    }
    const health = {
      revenue: 5000000, profit: 500000,
      activeOrderCount: 10, activePurchaseCount: 3,
      lowStockCount: 2, reconciliationIssueCount: 1,
      needsAttention: true,
    }
    const el = mod.KpiGrid({ loading: false, error: null, summary, health })
    expect(el).toBeTruthy()
  })

  it('render với zero health data', async () => {
    const mod = await import('@/components/dashboard/kpi-grid')
    const summary = {
      totalStores: 0, verifiedStores: 0, unverifiedStores: 0,
      verificationRate: 0, last7DaysStores: 0,
      districtRows: [], topDistrictCount: 1,
      districtCount: 0, wardCount: 0,
      newestCreatedAt: null,
    }
    const health = {
      revenue: 0, profit: 0,
      activeOrderCount: 0, activePurchaseCount: 0,
      lowStockCount: 0, reconciliationIssueCount: 0,
      needsAttention: false,
    }
    const el = mod.KpiGrid({ loading: false, error: null, summary, health })
    expect(el).toBeTruthy()
  })
})
