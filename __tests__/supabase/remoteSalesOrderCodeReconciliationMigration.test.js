import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260518000000_reconcile_remote_sales_order_code.sql', 'utf8')

describe('remote sales order code reconciliation migration', () => {
  it('mirrors remote-only sales order sequence migration safely', () => {
    expect(migration).toContain('create sequence if not exists public.sales_order_code_seq')
    expect(migration).toContain('public.generate_sales_order_code')
    expect(migration).toContain('public.create_sales_order_with_items')
    expect(migration).toContain('public.generate_sales_order_code()')
    expect(migration).toContain('grant execute on function public.create_sales_order_with_items(jsonb, jsonb)')
  })
})
