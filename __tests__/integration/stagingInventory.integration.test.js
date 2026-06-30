import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

const url = process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const adminAccessToken = process.env.STAGING_ADMIN_ACCESS_TOKEN
const adminUserId = process.env.STAGING_ADMIN_USER_ID || null
const runLive = Boolean(url && anonKey && adminAccessToken && process.env.RUN_STAGING_INTEGRATION === '1')
const requireCertification = process.env.RUN_STAGING_CERTIFICATION === '1'
const suite = runLive ? describe : describe.skip

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

suite('staging inventory integration', () => {
  const supabase = createClient(url || 'https://example.supabase.co', anonKey || 'anon-key', {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${adminAccessToken}` } },
  })

  it('verifies aggregate/search/reconciliation RPC contracts against real staging', async () => {
    const [sales, inventory, reconciliation, search] = await Promise.all([
      supabase.rpc('get_sales_summary', { p_from: null, p_to: null }),
      supabase.rpc('get_inventory_valuation_summary'),
      supabase.rpc('get_inventory_reconciliation_report'),
      supabase.rpc('global_operator_search', { p_query: 'HC-STG', p_limit: 5 }),
    ])

    expect(sales.error).toBeNull()
    expect(inventory.error).toBeNull()
    expect(reconciliation.error).toBeNull()
    expect(search.error).toBeNull()
    expect(Array.isArray(reconciliation.data)).toBe(true)
    expect(Array.isArray(search.data)).toBe(true)
  })

  it('verifies product import idempotency, audit event, and cleanup against real staging', async () => {
    const requestId = uniqueId('vitest-product-import')
    const sku = uniqueId('HC-STG-QA')
    const row = { rowNumber: 2, data: { name: 'QA Sản phẩm staging', sku, baseUnitName: 'chai', defaultSalePrice: 1234 } }

    const first = await supabase.rpc('import_products_from_preview', { p_rows: [row], p_request_id: requestId, p_actor_id: adminUserId })
    const second = await supabase.rpc('import_products_from_preview', { p_rows: [row], p_request_id: requestId, p_actor_id: adminUserId })

    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    expect(first.data?.summary?.insertedCount).toBe(1)
    expect(second.data?.idempotent).toBe(true)

    const audit = await supabase.from('operation_audit_events').select('id,event_type,request_id').eq('request_id', requestId)
    expect(audit.error).toBeNull()
    expect(audit.data).toHaveLength(1)

    const cleanup = await supabase.from('products').update({ active: false, deleted_at: new Date().toISOString() }).eq('sku', sku)
    expect(cleanup.error).toBeNull()
  })

  it('verifies duplicate SKU/concurrent import does not create duplicate products', async () => {
    const sku = uniqueId('HC-STG-RACE')
    const row = { rowNumber: 2, data: { name: 'QA Race Product', sku, baseUnitName: 'chai', defaultSalePrice: 1000 } }
    const [a, b] = await Promise.all([
      supabase.rpc('import_products_from_preview', { p_rows: [row], p_request_id: uniqueId('race-a'), p_actor_id: adminUserId }),
      supabase.rpc('import_products_from_preview', { p_rows: [row], p_request_id: uniqueId('race-b'), p_actor_id: adminUserId }),
    ])

    expect(a.error || b.error).toBeFalsy()
    const products = await supabase.from('products').select('id').eq('sku', sku).is('deleted_at', null)
    expect(products.error).toBeNull()
    expect(products.data.length).toBe(1)

    await supabase.from('products').update({ active: false, deleted_at: new Date().toISOString() }).eq('sku', sku)
  })
})

describe('staging inventory integration gate', () => {
  it('fails fast for Phase 12 certification when admin credentials are missing', () => {
    if (!requireCertification) return
    expect(url, 'Missing STAGING_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL').toBeTruthy()
    expect(anonKey, 'Missing STAGING_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY').toBeTruthy()
    expect(adminAccessToken, 'Missing STAGING_ADMIN_ACCESS_TOKEN for real staging certification').toBeTruthy()
    expect(process.env.RUN_STAGING_INTEGRATION, 'RUN_STAGING_INTEGRATION must be 1').toBe('1')
  })

  it('documents required env when live integration is disabled', () => {
    if (runLive) return
    expect(runLive).toBe(false)
    expect('RUN_STAGING_INTEGRATION=1 STAGING_SUPABASE_URL STAGING_SUPABASE_ANON_KEY STAGING_ADMIN_ACCESS_TOKEN').toContain('RUN_STAGING_INTEGRATION')
  })
})
