import { describe, expect, it, vi } from 'vitest'
import {
  loadInventoryStockDashboard,
  loadProductManagementData,
  loadProductEditData,
  saveProductUnitFromForm,
  saveProductFromForm,
  createProductFromForm,
  loadPurchaseOrderDetailData,
  loadPurchaseOrdersList,
  loadSalesOrderDetailData,
  loadSalesOrdersIndexData,
  loadPurchaseEntryData,
  loadSalesOrderEntryData,
  loadSalesReportData,
  submitProductImportFromPreview,
  cancelPurchaseOrderById,
  cancelSalesOrderById,
  runReconciliationCheckAndReload,
  submitPurchaseOrderFromForm,
  submitSalesOrderFromForm,
} from '@/services/inventory/inventory-page-service'

describe('inventory page service boundary', () => {
  it('loads sales order entry data without UI dependencies', async () => {
    const stores = [{ id: 'store-1', name: 'Tạp hóa A' }]
    const products = [{ id: 'product-1', name: 'Nước suối' }]

    await expect(loadSalesOrderEntryData({
      getStores: vi.fn().mockResolvedValue(stores),
      listProducts: vi.fn().mockResolvedValue(products),
    })).resolves.toEqual({ stores, products })
  })

  it('normalizes load errors to Vietnamese operator messages', async () => {
    await expect(loadPurchaseEntryData({
      listProducts: vi.fn().mockRejectedValue({ message: 'invalid input syntax for type uuid' }),
    })).rejects.toMatchObject({ message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin nhập.' })
  })

  it('submits sales order through injected API and keeps payload untouched', async () => {
    const createSalesOrder = vi.fn().mockResolvedValue({ id: 'order-1' })
    const payload = { code: 'DH1', items: [{ productId: 'p1', quantity: 1 }] }

    await expect(submitSalesOrderFromForm(payload, { createSalesOrder })).resolves.toEqual({ id: 'order-1' })
    expect(createSalesOrder).toHaveBeenCalledWith(payload)
  })

  it('submits purchase order through injected API and maps duplicate errors', async () => {
    await expect(submitPurchaseOrderFromForm({ code: 'PN1' }, {
      createPurchaseOrder: vi.fn().mockRejectedValue({ message: 'duplicate key value violates unique constraint' }),
    })).rejects.toMatchObject({ message: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra mã/SKU hoặc thử lại.' })
  })

  it('loads stock dashboard from products, movements and reconciliation report', async () => {
    await expect(loadInventoryStockDashboard({
      listProducts: vi.fn().mockResolvedValue([{ id: 'p1' }]),
      listMovements: vi.fn().mockResolvedValue([{ id: 'm1' }]),
      getReconciliationReport: vi.fn().mockResolvedValue([{ product_id: 'p1', issue_codes: [] }]),
    })).resolves.toEqual({ products: [{ id: 'p1' }], movements: [{ id: 'm1' }], reconciliation: [{ product_id: 'p1', issue_codes: [] }] })
  })

  it('runs reconciliation then reloads report', async () => {
    const runCheck = vi.fn().mockResolvedValue({ id: 'run-1' })
    const getReconciliationReport = vi.fn().mockResolvedValue([{ product_id: 'p1' }])

    await expect(runReconciliationCheckAndReload('user-1', { runCheck, getReconciliationReport })).resolves.toEqual({ run: { id: 'run-1' }, reconciliation: [{ product_id: 'p1' }] })
    expect(runCheck).toHaveBeenCalledWith('user-1')
  })

  it('loads report data with aggregate-first fallback contract', async () => {
    const aggregate = { sales: { revenue: 1000 } }
    await expect(loadSalesReportData({ from: new Date('2026-05-01'), to: new Date('2026-05-02') }, {
      getAggregate: vi.fn().mockResolvedValue(aggregate),
      listSalesRows: vi.fn(),
      listProducts: vi.fn(),
      getStores: vi.fn(),
    })).resolves.toMatchObject({ mode: 'aggregate', aggregate })
  })

  it('loads sales order index data with stores and paged orders', async () => {
    await expect(loadSalesOrdersIndexData({ page: 1 }, {
      getStores: vi.fn().mockResolvedValue([{ id: 's1' }]),
      listOrders: vi.fn().mockResolvedValue({ orders: [{ id: 'o1' }], totalCount: 1 }),
    })).resolves.toEqual({ stores: [{ id: 's1' }], orders: [{ id: 'o1' }], totalCount: 1 })
  })

  it('loads sales order detail dependencies', async () => {
    await expect(loadSalesOrderDetailData('order-1', {
      getDetail: vi.fn().mockResolvedValue({ order: { id: 'order-1' }, items: [] }),
      getStores: vi.fn().mockResolvedValue([{ id: 's1' }]),
      listProducts: vi.fn().mockResolvedValue([{ id: 'p1' }]),
    })).resolves.toMatchObject({ detail: { order: { id: 'order-1' }, items: [] }, stores: [{ id: 's1' }], products: [{ id: 'p1' }] })
  })

  it('cancels sales and purchase orders through service boundary', async () => {
    const cancelSales = vi.fn().mockResolvedValue({ id: 'order-1', status: 'cancelled' })
    const cancelPurchase = vi.fn().mockResolvedValue({ id: 'purchase-1', cancelled_at: 'now' })
    await expect(cancelSalesOrderById('order-1', 'user-1', { cancelSales })).resolves.toMatchObject({ status: 'cancelled' })
    await expect(cancelPurchaseOrderById('purchase-1', 'user-1', { cancelPurchase })).resolves.toMatchObject({ id: 'purchase-1' })
  })

  it('loads purchase order list/detail and product management data', async () => {
    await expect(loadPurchaseOrdersList({ listOrders: vi.fn().mockResolvedValue([{ id: 'po1' }]) })).resolves.toEqual({ orders: [{ id: 'po1' }] })
    await expect(loadPurchaseOrderDetailData('po1', {
      getDetail: vi.fn().mockResolvedValue({ order: { id: 'po1' }, items: [] }),
      listProducts: vi.fn().mockResolvedValue([{ id: 'p1' }]),
    })).resolves.toEqual({ detail: { order: { id: 'po1' }, items: [] }, products: [{ id: 'p1' }] })
    await expect(loadProductManagementData({ listProducts: vi.fn().mockResolvedValue([{ id: 'p1' }]) })).resolves.toEqual({ products: [{ id: 'p1' }] })
  })

  it('submits product import through service boundary with safe errors', async () => {
    await expect(submitProductImportFromPreview([{ rowNumber: 2 }], { requestId: 'req-123456789', actorId: 'u1' }, {
      importProducts: vi.fn().mockResolvedValue({ summary: { insertedCount: 1 } }),
    })).resolves.toEqual({ summary: { insertedCount: 1 } })
  })

  it('wraps product create/edit/unit mutations', async () => {
    await expect(createProductFromForm({ name: 'A' }, { createProduct: vi.fn().mockResolvedValue({ id: 'p1' }) })).resolves.toEqual({ id: 'p1' })
    await expect(loadProductEditData('p1', { getDetail: vi.fn().mockResolvedValue({ id: 'p1' }) })).resolves.toEqual({ product: { id: 'p1' } })
    await expect(saveProductFromForm('p1', { name: 'A' }, { updateProduct: vi.fn().mockResolvedValue({ id: 'p1' }) })).resolves.toEqual({ id: 'p1' })
    await expect(saveProductUnitFromForm('u1', { unitName: 'chai' }, { updateUnit: vi.fn().mockResolvedValue({ id: 'u1' }) })).resolves.toEqual({ id: 'u1' })
  })
})
