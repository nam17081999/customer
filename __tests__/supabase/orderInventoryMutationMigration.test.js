import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260525000000_harden_order_inventory_mutations.sql', 'utf8')

describe('order inventory mutation hardening migration', () => {
  it('adds retry-safe idempotency keys for purchase and sales orders', () => {
    expect(migration).toContain('add column if not exists client_request_id text null')
    expect(migration).toContain('idx_purchase_orders_client_request_id_unique')
    expect(migration).toContain('idx_sales_orders_client_request_id_unique')
    expect(migration).toContain('p_request_id text default null')
  })

  it('returns existing order on duplicate client_request_id instead of inserting duplicate stock mutations', () => {
    expect(migration).toContain('where client_request_id = safe_request_id')
    expect(migration).toContain('for update')
    expect(migration).toContain('when unique_violation then')
  })

  it('keeps stock movement ledger one-to-one per movement source', () => {
    expect(migration).toContain('idx_stock_movements_source_once')
    expect(migration).toContain('on public.stock_movements (movement_type, source_table, source_id)')
  })

  it('asserts sales discount after item triggers calculate final subtotal', () => {
    expect(migration).toContain('if order_row.discount_amount > final_subtotal then')
    expect(migration).toContain('Discount amount % exceeds subtotal %')
  })
})
