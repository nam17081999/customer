import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260526000000_reporting_aggregate_rpcs.sql', 'utf8')

describe('reporting aggregate RPC migration', () => {
  it('adds indexes for scalable reporting queries', () => {
    expect(migration).toContain('idx_sales_orders_status_created_at')
    expect(migration).toContain('idx_sales_order_items_product_order')
    expect(migration).toContain('idx_purchase_orders_cancelled_created_at')
    expect(migration).toContain('idx_stock_movements_product_created_at')
  })

  it('creates dashboard-grade aggregate RPCs', () => {
    expect(migration).toContain('public.get_sales_summary')
    expect(migration).toContain('public.get_purchase_summary')
    expect(migration).toContain('public.get_inventory_valuation_summary')
    expect(migration).toContain('public.get_top_products_report')
    expect(migration).toContain('public.get_low_stock_report')
    expect(migration).toContain('public.get_customer_revenue_report')
  })

  it('uses historical active sales snapshots for deterministic revenue/profit', () => {
    expect(migration).toContain("and status = 'active'")
    expect(migration).toContain('sum(gross_profit_amount)')
    expect(migration).toContain('sum(total_cost_amount)')
    expect(migration).toContain('sum(soi.line_profit)')
  })

  it('keeps aggregate RPCs admin-gated by RLS helper and bounded limits', () => {
    expect(migration.match(/public\.is_admin_user\(\)/g).length).toBeGreaterThanOrEqual(6)
    expect(migration).toContain('least(coalesce(p_limit, 10), 100)')
    expect(migration).toContain('least(coalesce(p_limit, 50), 500)')
  })
})
