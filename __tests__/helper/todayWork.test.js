import { describe, expect, it } from 'vitest'
import {
  buildTodayWorkSummary,
  isTelesaleQueueCandidate,
  hasValidStoreCoordinates,
} from '@/helper/todayWork'

const NOW = new Date('2026-05-20T08:00:00.000Z').getTime()

describe('today work aggregation', () => {
  it('summarizes admin work from stores, reports, and inventory gaps', () => {
    const summary = buildTodayWorkSummary({
      stores: [
        { id: 'pending', name: 'A', active: false, phone: '0912345678', latitude: 21, longitude: 105 },
        { id: 'missing-location', name: 'B', active: true, phone: '0912345679', latitude: null, longitude: null },
        { id: 'missing-phone', name: 'C', active: true, phone: '', latitude: 21, longitude: 105 },
      ],
      pendingReports: 3,
      products: [
        { id: 'low', name: 'Nước', onHandBaseQty: 5, min_stock_base_qty: 5 },
        { id: 'ok', name: 'Bia', onHandBaseQty: 12, min_stock_base_qty: 5 },
        { id: 'out', name: 'Sữa', onHandBaseQty: 0, min_stock_base_qty: 2 },
      ],
      now: NOW,
    })

    expect(summary.counts).toMatchObject({
      pendingStores: 1,
      pendingReports: 3,
      missingLocation: 1,
      missingPhone: 1,
      lowStock: 2,
      outOfStock: 1,
    })
    expect(summary.adminCards.map((card) => [card.key, card.count])).toEqual([
      ['pending-stores', 1],
      ['pending-reports', 3],
      ['missing-location', 1],
      ['missing-phone', 1],
      ['low-stock', 2],
    ])
    expect(summary.lists.missingLocationStores.map((store) => store.id)).toEqual(['missing-location'])
    expect(summary.lists.lowStockProducts.map((product) => product.id)).toEqual(['low', 'out'])
  })

  it('builds telesale queue using existing freshness rules', () => {
    const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString()
    const recent = new Date(NOW - 60 * 1000).toISOString()
    const oldConHang = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString()
    const recentOrder = new Date(NOW - 12 * 60 * 60 * 1000).toISOString()

    const stores = [
      { id: 'never', is_potential: true, phone: '0912345678', created_at: '2026-05-19T00:00:00.000Z' },
      { id: 'stale', is_potential: true, phone: '0912345679', last_called_at: oneHourAgo },
      { id: 'retry', is_potential: true, phone: '0912345680', last_call_result: 'goi_lai_sau', last_call_result_at: recent },
      { id: 'old-interested', is_potential: true, phone: '0912345681', last_call_result: 'con_hang', last_call_result_at: oldConHang },
      { id: 'fresh-interested', is_potential: true, phone: '0912345682', last_call_result: 'con_hang', last_call_result_at: recent },
      { id: 'fresh-order', is_potential: true, phone: '0912345683', last_call_result: 'da_len_don', last_order_reported_at: recentOrder },
      { id: 'no-phone', is_potential: true, phone: '', last_call_result: 'goi_lai_sau' },
      { id: 'not-potential', is_potential: false, phone: '0912345684' },
    ]

    const summary = buildTodayWorkSummary({ stores, pendingReports: 0, products: [], now: NOW })

    expect(summary.counts.telesaleQueue).toBe(4)
    expect(summary.lists.telesaleQueueStores.map((store) => store.id)).toEqual([
      'never',
      'stale',
      'retry',
      'old-interested',
    ])
    expect(isTelesaleQueueCandidate(stores[4], NOW)).toBe(false)
    expect(isTelesaleQueueCandidate(stores[5], NOW)).toBe(false)
  })

  it('validates coordinates strictly for store gap counts', () => {
    expect(hasValidStoreCoordinates({ latitude: 21, longitude: 105 })).toBe(true)
    expect(hasValidStoreCoordinates({ latitude: 105, longitude: 21 })).toBe(false)
    expect(hasValidStoreCoordinates({ latitude: 21, longitude: 181 })).toBe(false)
    expect(hasValidStoreCoordinates({ latitude: '', longitude: '' })).toBe(false)
  })
})
