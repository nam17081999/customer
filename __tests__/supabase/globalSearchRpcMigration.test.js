import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260526010000_global_search_rpc.sql', 'utf8')

describe('global search rpc migration', () => {
  it('creates bounded server-side global search RPC across ERP entities', () => {
    expect(migration).toContain('public.global_operator_search')
    expect(migration).toContain('greatest(1, least(coalesce(p_limit, 20), 50))')
    expect(migration).toContain("'product'::text")
    expect(migration).toContain("'customer'::text")
    expect(migration).toContain("'order'::text")
    expect(migration).toContain("'purchase'::text")
    expect(migration).toContain("'movement'::text")
  })

  it('adds search indexes and admin guard', () => {
    expect(migration).toContain('idx_products_search_active')
    expect(migration).toContain('idx_stores_search_active')
    expect(migration).toContain('idx_sales_orders_code_search')
    expect(migration).toContain('idx_purchase_orders_code_search')
    expect(migration.match(/public\.is_admin_user\(\)/g).length).toBeGreaterThanOrEqual(5)
  })
})
