import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc,
    from,
  },
}))

import {
  cancelPurchaseOrder,
  cancelSalesOrder,
  createProductUnit,
  createPurchaseOrder,
  createSalesOrder,
  getPurchaseOrderDetail,
  getInventoryReconciliationReport,
  importProductsFromPreview,
  getDashboardAggregateReport,
  globalOperatorSearch,
  getSalesOrderDetail,
  listPurchaseOrders,
  listOperationAuditEvents,
  listSalesOrders,
  listStockMovements,
  repairProductStockFromLedger,
  runInventoryReconciliationCheck,
  updateProduct,
  updateProductUnit,
} from '@/api/inventory/inventory-client'

describe('inventory client atomic RPC writes', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('createPurchaseOrder dùng RPC atomic thay vì insert header rồi insert items', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'purchase-1' }, error: null })

    await expect(createPurchaseOrder({
      code: 'PN001',
      supplierName: 'NCC A',
      createdBy: 'user-1',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '2', conversionToBaseQty: '12', unitCost: '120000' }],
    })).resolves.toEqual({ id: 'purchase-1' })

    expect(rpc).toHaveBeenCalledWith('create_purchase_order_with_items', {
      p_order: {
        code: 'PN001',
        supplier_name: 'NCC A',
        note: null,
        created_by: 'user-1',
      },
      p_items: [{
        product_id: 'p1',
        product_unit_id: 'u1',
        quantity: 2,
        conversion_to_base_qty: 12,
        unit_cost: 120000,
        note: null,
      }],
      p_request_id: null,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('createSalesOrder dùng RPC atomic và chặn payload sai trước khi gọi DB', async () => {
    rpc.mockResolvedValueOnce({ data: { id: 'order-1' }, error: null })

    await expect(createSalesOrder({
      code: 'DH001',
      customerStoreId: 'store-1',
      discountAmount: '0',
      createdBy: 'user-1',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', conversionToBaseQty: '24', unitPrice: '240000' }],
    })).resolves.toEqual({ id: 'order-1' })

    expect(rpc).toHaveBeenCalledWith('create_sales_order_with_items', {
      p_order: {
        code: 'DH001',
        customer_store_id: 'store-1',
        note: null,
        discount_amount: 0,
        created_by: 'user-1',
      },
      p_items: [{
        product_id: 'p1',
        product_unit_id: 'u1',
        quantity: 1,
        conversion_to_base_qty: 24,
        unit_price: 240000,
        note: null,
      }],
      p_request_id: null,
    })
    expect(from).not.toHaveBeenCalled()

    await expect(createSalesOrder({
      customerStoreId: '',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', unitPrice: '1000' }],
    })).rejects.toThrow('Vui lòng chọn khách hàng.')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('create order RPC gửi idempotency key để retry không tạo trùng', async () => {
    rpc
      .mockResolvedValueOnce({ data: { id: 'purchase-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'order-1' }, error: null })

    await createPurchaseOrder({
      code: 'PN002',
      requestId: 'purchase_req_1',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', conversionToBaseQty: '1', unitCost: '1000' }],
    })

    await createSalesOrder({
      code: 'DH002',
      customerStoreId: 'store-1',
      requestId: 'sales_req_1',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', conversionToBaseQty: '1', unitPrice: '1500' }],
    })

    expect(rpc).toHaveBeenNthCalledWith(1, 'create_purchase_order_with_items', expect.objectContaining({
      p_request_id: 'purchase_req_1',
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'create_sales_order_with_items', expect.objectContaining({
      p_request_id: 'sales_req_1',
    }))
  })

  it('cancel helpers gọi RPC đảo tồn, không hard-delete', async () => {
    rpc
      .mockResolvedValueOnce({ data: { id: 'order-1', status: 'cancelled' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'purchase-1', cancelled_at: '2026-05-16T00:00:00Z' }, error: null })

    await expect(cancelSalesOrder('order-1', 'user-1')).resolves.toEqual({ id: 'order-1', status: 'cancelled' })
    await expect(cancelPurchaseOrder('purchase-1', null)).resolves.toEqual({ id: 'purchase-1', cancelled_at: '2026-05-16T00:00:00Z' })

    expect(rpc).toHaveBeenNthCalledWith(1, 'cancel_sales_order_and_restore_stock', {
      p_order_id: 'order-1',
      p_cancelled_by: 'user-1',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'cancel_purchase_order_and_remove_stock', {
      p_purchase_order_id: 'purchase-1',
      p_cancelled_by: null,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('reconciliation helpers gọi RPC audit/repair và trả dữ liệu typed', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ product_id: 'p1', issue_codes: ['quantity_mismatch'] }], error: null })
      .mockResolvedValueOnce({ data: { id: 'run-1', status: 'succeeded' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'run-2', repaired_count: 1 }, error: null })

    await expect(getInventoryReconciliationReport()).resolves.toEqual([{ product_id: 'p1', issue_codes: ['quantity_mismatch'] }])
    await expect(runInventoryReconciliationCheck('user-1')).resolves.toEqual({ id: 'run-1', status: 'succeeded' })
    await expect(repairProductStockFromLedger('user-1')).resolves.toEqual({ id: 'run-2', repaired_count: 1 })

    expect(rpc).toHaveBeenNthCalledWith(1, 'get_inventory_reconciliation_report')
    expect(rpc).toHaveBeenNthCalledWith(2, 'run_inventory_reconciliation_check', { p_started_by: 'user-1' })
    expect(rpc).toHaveBeenNthCalledWith(3, 'repair_product_stock_from_ledger', { p_started_by: 'user-1' })
  })

  it('dashboard aggregate report gọi các RPC tổng hợp server-side', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ revenue: 1000, profit: 200 }], error: null })
      .mockResolvedValueOnce({ data: [{ purchase_amount: 500 }], error: null })
      .mockResolvedValueOnce({ data: [{ low_stock_count: 2 }], error: null })
      .mockResolvedValueOnce({ data: [{ product_id: 'p1' }], error: null })
      .mockResolvedValueOnce({ data: [{ product_id: 'p2' }], error: null })
      .mockResolvedValueOnce({ data: [{ customer_store_id: 's1' }], error: null })

    await expect(getDashboardAggregateReport({ from: '2026-05-01', to: '2026-06-01' })).resolves.toMatchObject({
      sales: { revenue: 1000, profit: 200 },
      purchases: { purchase_amount: 500 },
      inventory: { low_stock_count: 2 },
      topProducts: [{ product_id: 'p1' }],
    })

    expect(rpc).toHaveBeenNthCalledWith(1, 'get_sales_summary', { p_from: '2026-05-01', p_to: '2026-06-01' })
    expect(rpc).toHaveBeenNthCalledWith(4, 'get_top_products_report', { p_from: '2026-05-01', p_to: '2026-06-01', p_limit: 8 })
  })

  it('globalOperatorSearch gọi RPC search server-side có limit', async () => {
    rpc.mockResolvedValueOnce({ data: [{ entity_type: 'product', title: 'Lavie' }], error: null })
    await expect(globalOperatorSearch(' lavie ', 12)).resolves.toEqual([{ entity_type: 'product', title: 'Lavie' }])
    expect(rpc).toHaveBeenCalledWith('global_operator_search', { p_query: 'lavie', p_limit: 12 })
  })

  it('importProductsFromPreview gọi RPC idempotent và bắt request id thiếu', async () => {
    rpc.mockResolvedValueOnce({ data: { summary: { insertedCount: 1 } }, error: null })

    await expect(importProductsFromPreview([{ rowNumber: 2, data: { name: 'A' } }], { requestId: 'product-import-123', actorId: 'user-1' })).resolves.toEqual({ summary: { insertedCount: 1 } })
    await expect(importProductsFromPreview([], { requestId: 'short' })).rejects.toThrow('Thiếu mã request import.')

    expect(rpc).toHaveBeenCalledWith('import_products_from_preview', {
      p_rows: [{ rowNumber: 2, data: { name: 'A' } }],
      p_request_id: 'product-import-123',
      p_actor_id: 'user-1',
    })
  })
})

describe('inventory client detail/list/update reads', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('getSalesOrderDetail tải đầu đơn và dòng hàng', async () => {
    const orderEq = vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'order-1' }, error: null }) }))
    const itemOrder = vi.fn().mockResolvedValue({ data: [{ id: 'item-1' }], error: null })
    const itemEq = vi.fn(() => ({ order: itemOrder }))
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: orderEq })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: itemEq })) })

    await expect(getSalesOrderDetail('order-1')).resolves.toEqual({
      order: { id: 'order-1' },
      items: [{ id: 'item-1' }],
    })
    expect(from).toHaveBeenNthCalledWith(1, 'sales_orders')
    expect(from).toHaveBeenNthCalledWith(2, 'sales_order_items')
  })

  it('listSalesOrders chỉ lấy đúng trang hiện tại và đẩy bộ lọc xuống query', async () => {
    const countQuery = {
      in: vi.fn(() => countQuery),
      eq: vi.fn(() => countQuery),
      gte: vi.fn(() => countQuery),
      lt: vi.fn(() => countQuery),
      or: vi.fn(() => countQuery),
      limit: vi.fn(() => countQuery),
      then: vi.fn((resolve) => resolve({ count: 1, error: null })),
    }
    const listQuery = {
      in: vi.fn(() => listQuery),
      eq: vi.fn(() => listQuery),
      gte: vi.fn(() => listQuery),
      lt: vi.fn(() => listQuery),
      or: vi.fn(() => listQuery),
      order: vi.fn(() => listQuery),
      range: vi.fn(() => listQuery),
      then: vi.fn((resolve) => resolve({ data: [{ id: 'order-1' }], error: null })),
    }
    const countSelect = vi.fn(() => countQuery)
    const orderSelect = vi.fn(() => listQuery)
    const itemIn = vi.fn().mockResolvedValue({
      data: [{ id: 'item-1', sales_order_id: 'order-1' }],
      error: null,
    })

    from
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ select: orderSelect })
      .mockReturnValueOnce({ select: vi.fn(() => ({ in: itemIn })) })

    await expect(listSalesOrders({
      page: 2,
      pageSize: 10,
      query: 'HD079596',
      statuses: ['active'],
      creatorId: 'user-1',
      datePreset: 'all',
      matchingCustomerStoreIds: ['store-1'],
    })).resolves.toEqual({
      orders: [{ id: 'order-1', itemCount: 1 }],
      totalCount: 1,
    })

    expect(from).toHaveBeenNthCalledWith(1, 'sales_orders')
    expect(countSelect).toHaveBeenCalledWith('id', { count: 'exact' })
    expect(orderSelect).toHaveBeenCalledWith('*')
    expect(listQuery.range).toHaveBeenCalledWith(10, 19)
    expect(listQuery.in).toHaveBeenCalledWith('status', ['active'])
    expect(listQuery.eq).toHaveBeenCalledWith('created_by', 'user-1')
    expect(listQuery.or).toHaveBeenCalledWith('code.ilike.%hd079596%,customer_store_id.in.(store-1)')
    expect(from).toHaveBeenNthCalledWith(3, 'sales_order_items')
    expect(itemIn).toHaveBeenCalledWith('sales_order_id', ['order-1'])
  })

  it('listPurchaseOrders trả itemCount theo dòng phiếu', async () => {
    const countSelect = vi.fn().mockResolvedValue({ count: 1, error: null })
    const range = vi.fn().mockResolvedValue({ data: [{ id: 'purchase-1' }], error: null })
    const order = vi.fn(() => ({ range }))
    const inFilter = vi.fn().mockResolvedValue({
      data: [{ id: 'line-1', purchase_order_id: 'purchase-1' }],
      error: null,
    })
    from
      .mockReturnValueOnce({ select: countSelect })
      .mockReturnValueOnce({ select: vi.fn(() => ({ order })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ in: inFilter })) })

    await expect(listPurchaseOrders(20)).resolves.toEqual({
      orders: [{ id: 'purchase-1', itemCount: 1 }],
      totalCount: 1,
    })
  })

  it('getPurchaseOrderDetail tải đầu phiếu và dòng nhập', async () => {
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'purchase-1' }, error: null }) })) })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [{ id: 'line-1' }], error: null }) })) })) })

    await expect(getPurchaseOrderDetail('purchase-1')).resolves.toEqual({
      order: { id: 'purchase-1' },
      items: [{ id: 'line-1' }],
    })
  })

  it('updateProduct chuẩn hóa payload rồi update products, không hard-delete', async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'p1', name: 'Nước Lavie' }, error: null }),
        })),
      })),
    }))
    from.mockReturnValueOnce({ update })

    await expect(updateProduct('p1', { name: ' nước lavie ', defaultSalePrice: '5000' })).resolves.toEqual({ id: 'p1', name: 'Nước Lavie' })
    expect(update.mock.calls[0][0]).toMatchObject({
      name: 'Nước Lavie',
      default_sale_price: 5000,
    })
  })

  it('listStockMovements đọc sổ cái kho theo created_at desc', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'm1' }], error: null })
    const order = vi.fn(() => ({ limit }))
    from.mockReturnValueOnce({ select: vi.fn(() => ({ order })) })

    await expect(listStockMovements(50)).resolves.toEqual([{ id: 'm1' }])
    expect(from).toHaveBeenCalledWith('stock_movements')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(50)
  })

  it('listOperationAuditEvents đọc audit event có filter và limit chặn lớn', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'audit-1' }], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ order }))
    from.mockReturnValueOnce({ select: vi.fn(() => ({ eq, order })) })

    await expect(listOperationAuditEvents({ eventType: 'product_import', limit: 999 })).resolves.toEqual([{ id: 'audit-1' }])
    expect(from).toHaveBeenCalledWith('operation_audit_events')
    expect(eq).toHaveBeenCalledWith('event_type', 'product_import')
    expect(limit).toHaveBeenCalledWith(200)
  })
})

describe('inventory client product unit writes', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('createProductUnit insert product_units với payload chuẩn hóa', async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: 'unit-1' }, error: null }),
      })),
    }))
    from.mockReturnValueOnce({ insert })

    await expect(createProductUnit('product-1', {
      unitName: ' Thùng 24 ',
      conversionToBaseQty: '24',
      defaultSalePrice: '120000',
    })).resolves.toEqual({ id: 'unit-1' })

    expect(from).toHaveBeenCalledWith('product_units')
    expect(insert.mock.calls[0][0]).toEqual([{
      product_id: 'product-1',
      unit_name: 'thùng 24',
      conversion_to_base_qty: 24,
      default_sale_price: 120000,
      default_purchase_price: null,
      active: true,
      is_base_unit: false,
    }])
  })

  it('updateProductUnit update product_units, không delete', async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'unit-1', active: false }, error: null }),
        })),
      })),
    }))
    from.mockReturnValueOnce({ update })

    await expect(updateProductUnit('unit-1', {
      unitName: 'thùng 24',
      conversionToBaseQty: '24',
      active: false,
    })).resolves.toEqual({ id: 'unit-1', active: false })

    expect(from).toHaveBeenCalledWith('product_units')
    expect(update.mock.calls[0][0]).toMatchObject({
      unit_name: 'thùng 24',
      conversion_to_base_qty: 24,
      active: false,
    })
  })
})
