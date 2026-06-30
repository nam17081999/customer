import { describe, expect, it } from 'vitest'
import {
  addRecentRoute,
  buildDashboardHealthSummary,
  getOperatorShortcutHref,
  getRecentProductsFromOrderDrafts,
  mergeSalesOrderLine,
  OPERATOR_QUICK_ACTIONS,
} from '@/helper/operatorWorkflow'

describe('operator workflow helpers', () => {
  it('maps admin shortcut keys to high-frequency routes', () => {
    expect(OPERATOR_QUICK_ACTIONS.map((action) => action.href)).toContain('/orders/new')
    expect(getOperatorShortcutHref({ altKey: true, key: '1' })).toBe('/orders/new')
    expect(getOperatorShortcutHref({ altKey: true, ctrlKey: true, key: '1' })).toBe('')
  })

  it('persists recent routes without duplicates and caps list size', () => {
    const routes = Array.from({ length: 8 }, (_, index) => ({ href: `/p${index}`, label: `P${index}` }))
    const result = routes.reduce((items, route) => addRecentRoute(items, route), [])
    expect(result).toHaveLength(6)
    expect(addRecentRoute(result, { href: '/p4', label: 'P4 new' })[0]).toMatchObject({ href: '/p4', label: 'P4 new' })
  })

  it('merges duplicate order lines by product and unit for fast order entry', () => {
    const result = mergeSalesOrderLine([
      { productId: 'p1', productUnitId: 'u1', quantity: '2' },
      { productId: 'p2', productUnitId: 'u1', quantity: '1' },
    ], { productId: 'p1', productUnitId: 'u1', quantity: '3' })

    expect(result).toMatchObject({ merged: true, index: 0 })
    expect(result.items[0].quantity).toBe('5')
  })

  it('extracts recent products from saved drafts in first-seen order', () => {
    const productsById = new Map([
      ['p1', { id: 'p1', name: 'A' }],
      ['p2', { id: 'p2', name: 'B' }],
    ])
    expect(getRecentProductsFromOrderDrafts([
      { items: [{ productId: 'p1' }, { productId: 'p2' }, { productId: 'p1' }] },
    ], productsById)).toEqual([
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
    ])
  })

  it('builds dashboard health summary without double-counting cancelled documents', () => {
    expect(buildDashboardHealthSummary({
      products: [
        { onHandBaseQty: 1, min_stock_base_qty: 5 },
        { onHandBaseQty: 10, min_stock_base_qty: 5 },
      ],
      reconciliationRows: [{ issue_codes: ['quantity_mismatch'] }, { issue_codes: [] }],
      orders: [
        { status: 'active', total_amount: 1000, gross_profit_amount: 200 },
        { status: 'cancelled', total_amount: 500, gross_profit_amount: 100 },
      ],
      purchases: [
        { cancelled_at: null, total_amount: 700 },
        { cancelled_at: '2026-01-01', total_amount: 300 },
      ],
    })).toMatchObject({
      lowStockCount: 1,
      reconciliationIssueCount: 1,
      activeOrderCount: 1,
      activePurchaseCount: 1,
      revenue: 1000,
      profit: 200,
      purchaseAmount: 700,
      needsAttention: true,
    })
  })
})
