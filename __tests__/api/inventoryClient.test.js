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
  getSalesOrderDetail,
  listPurchaseOrders,
  listSalesOrders,
  listStockMovements,
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
    })
    expect(from).not.toHaveBeenCalled()

    await expect(createSalesOrder({
      customerStoreId: '',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', unitPrice: '1000' }],
    })).rejects.toThrow('Vui lòng chọn khách hàng.')
    expect(rpc).toHaveBeenCalledTimes(1)
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
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'purchase-1' }], error: null })
    const order = vi.fn(() => ({ limit }))
    const inFilter = vi.fn().mockResolvedValue({
      data: [{ id: 'line-1', purchase_order_id: 'purchase-1' }],
      error: null,
    })
    from
      .mockReturnValueOnce({ select: vi.fn(() => ({ order })) })
      .mockReturnValueOnce({ select: vi.fn(() => ({ in: inFilter })) })

    await expect(listPurchaseOrders(20)).resolves.toEqual([{ id: 'purchase-1', itemCount: 1 }])
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
