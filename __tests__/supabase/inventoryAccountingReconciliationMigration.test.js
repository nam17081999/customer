import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260525010000_inventory_accounting_reconciliation.sql', 'utf8')

describe('inventory accounting reconciliation migration', () => {
  it('creates admin-visible reconciliation run audit table', () => {
    expect(migration).toContain('create table if not exists public.inventory_reconciliation_runs')
    expect(migration).toContain('run_type in (\'check\', \'repair\')')
    expect(migration).toContain('inventory_reconciliation_runs_admin_all')
  })

  it('builds deterministic movement replay report with mismatch detectors', () => {
    expect(migration).toContain('create or replace function public.get_inventory_reconciliation_report()')
    expect(migration).toContain('sum(sm.quantity_base)')
    expect(migration).toContain('quantity_mismatch')
    expect(migration).toContain('negative_replay_stock')
    expect(migration).toContain('orphan_movement')
    expect(migration).toContain('avg_cost_mismatch')
  })

  it('does not rewrite historical sales cost or profit snapshots', () => {
    expect(migration).not.toContain('update public.sales_order_items')
    expect(migration).not.toContain('update public.sales_orders')
    expect(migration).toContain('Do not rewrite historical sales cost/profit snapshots')
  })

  it('repairs only current product_stock from safe replay rows', () => {
    expect(migration).toContain('create or replace function public.repair_product_stock_from_ledger')
    expect(migration).toContain('where not has_orphan_movement')
    expect(migration).toContain('and replay_on_hand_base_qty >= 0')
    expect(migration).toContain('on conflict (product_id) do update')
  })
})
