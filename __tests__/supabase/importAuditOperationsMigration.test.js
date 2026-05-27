import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260526020000_import_audit_operations.sql', 'utf8')

describe('import audit operations migration', () => {
  it('creates audit event store with admin RLS and request id idempotency', () => {
    expect(migration).toContain('public.operation_audit_events')
    expect(migration).toContain('idx_operation_audit_events_request_once')
    expect(migration).toContain('operation_audit_events_admin_select')
    expect(migration).toContain('operation_audit_events_admin_insert')
    expect(migration.match(/public\.is_admin_user\(\)/g).length).toBeGreaterThanOrEqual(3)
  })

  it('creates transaction-safe product import RPC with validation and audit log', () => {
    expect(migration).toContain('public.import_products_from_preview')
    expect(migration).toContain('p_request_id')
    expect(migration).toContain('for update')
    expect(migration).toContain('insert into public.product_stock')
    expect(migration).toContain('public.log_operation_audit_event')
    expect(migration).toContain("'product_import'")
  })
})
