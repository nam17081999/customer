import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260527000000_restore_cancel_order_rpcs.sql', 'utf8')

describe('cancel rpc repair migration', () => {
  it('restores sales and purchase cancel RPCs with stock safety', () => {
    expect(migration).toContain('public.cancel_sales_order_and_restore_stock')
    expect(migration).toContain('public.cancel_purchase_order_and_remove_stock')
    expect(migration).toContain('for update')
    expect(migration).toContain('on_hand_base_qty >= item_row.quantity_base')
    expect(migration).toContain('on conflict (movement_type, source_table, source_id) do nothing')
  })
})
