const { test, expect } = require('@playwright/test')

async function setupAdmin(page) {
  await page.addInitScript(() => {
    window.__STOREVIS_E2E__ = {
      auth: { role: 'admin' },
      stores: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Tạp Hóa E2E', phone: '0900000001', ward: 'An Khánh', district: 'Hoài Đức', active: true, created_at: '2026-05-01T00:00:00Z' },
      ],
    }
  })

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/products')) {
      await route.fulfill({ json: [{ id: 'p-e2e', name: 'Nước suối E2E', sku: 'E2E-WATER', base_unit_name: 'chai', default_sale_price: 1000, min_stock_base_qty: 1, active: true }] })
      return
    }
    if (url.includes('/product_units')) {
      await route.fulfill({ json: [{ id: 'u-e2e', product_id: 'p-e2e', unit_name: 'chai', conversion_to_base_qty: 1, is_base_unit: true, active: true, default_sale_price: 1000 }] })
      return
    }
    if (url.includes('/product_stock')) {
      await route.fulfill({ json: [{ product_id: 'p-e2e', on_hand_base_qty: 20, avg_cost_per_base_unit: 700 }] })
      return
    }
    if (url.includes('/sales_orders')) {
      await route.fulfill({ json: [] })
      return
    }
    if (url.includes('/purchase_orders')) {
      await route.fulfill({ json: [] })
      return
    }
    if (url.includes('/stock_movements')) {
      await route.fulfill({ json: [] })
      return
    }
    if (url.includes('/inventory_reconciliation_runs')) {
      await route.fulfill({ json: [{ id: 'run-e2e', run_type: 'check', status: 'completed', started_at: '2026-05-26T00:00:00Z', mismatch_count: 0, repaired_count: 0 }] })
      return
    }
    if (url.includes('/operation_audit_events')) {
      await route.fulfill({ json: [{ id: 'audit-e2e', event_type: 'product_import', entity_type: 'import', severity: 'info', request_id: 'product-import-e2e', created_at: '2026-05-26T00:00:00Z' }] })
      return
    }
    await route.fulfill({ json: [] })
  })

  await page.route('**/rpc/**', async (route) => {
    const url = route.request().url()
    if (url.includes('get_sales_summary')) return route.fulfill({ json: [{ order_count: 0, revenue: 0, cost: 0, profit: 0, discount: 0, avg_order_value: 0 }] })
    if (url.includes('get_purchase_summary')) return route.fulfill({ json: [{ purchase_count: 0, purchase_amount: 0 }] })
    if (url.includes('get_inventory_valuation_summary')) return route.fulfill({ json: [{ product_count: 1, active_product_count: 1, low_stock_count: 0, out_of_stock_count: 0, stock_value: 14000 }] })
    if (url.includes('get_top_products_report')) return route.fulfill({ json: [{ product_id: 'p-e2e', product_name: 'Nước suối E2E', sku: 'E2E-WATER', quantity_base: 2, revenue: 2000, profit: 600, order_count: 1 }] })
    if (url.includes('get_low_stock_report')) return route.fulfill({ json: [] })
    if (url.includes('get_customer_revenue_report')) return route.fulfill({ json: [] })
    if (url.includes('get_inventory_reconciliation_report')) return route.fulfill({ json: [] })
    if (url.includes('run_inventory_reconciliation_check')) return route.fulfill({ json: [{ run_id: 'run-e2e', mismatch_count: 0 }] })
    if (url.includes('import_products_from_preview')) return route.fulfill({ json: { idempotent: false, summary: { insertedCount: 2, updatedCount: 0, skippedCount: 0 }, rows: [] } })
    await route.fulfill({ json: [] })
  })
}

test('reports page loads aggregate data and exposes CSV export', async ({ page }) => {
  await setupAdmin(page)
  await page.goto('/inventory/reports')
  await expect(page.getByText('Aggregate RPC')).toBeVisible()
  await expect(page.getByText('Nước suối E2E').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled()
})

test('mobile order route remains usable with touch-sized entry points', async ({ page }) => {
  await setupAdmin(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/orders/new')
  await expect(page.getByPlaceholder('Tìm hàng hóa')).toBeVisible()
  await expect(page.getByRole('button', { name: /LÊN ĐƠN/ })).toBeVisible()
})

test('operations center shows reconciliation health and can run check', async ({ page }) => {
  await setupAdmin(page)
  await page.goto('/admin/operations')
  await expect(page.getByText('Trung tâm vận hành')).toBeVisible()
  await expect(page.getByText('Không có lỗi đối soát.')).toBeVisible()
  await expect(page.getByText('product_import')).toBeVisible()
  await page.getByRole('button', { name: /Chạy đối soát/ }).click()
  await expect(page.getByText('completed')).toBeVisible()
})

test('product import preview reports valid rows and duplicate SKU', async ({ page }) => {
  await setupAdmin(page)
  await page.goto('/inventory/products/import')
  await page.getByTestId('product-import-raw').fill('name,sku,base_unit_name,default_sale_price\nA,SKU-1,thùng,1000\nB,sku-1,,2000')
  await expect(page.getByText('Preview import sản phẩm')).toBeVisible()
  await expect(page.getByText('Dòng hợp lệ')).toBeVisible()
  await expect(page.getByText('Trùng SKU trong file')).toBeVisible()
  await expect(page.getByTestId('import-preview-row')).toHaveCount(2)
})

test('product import confirmation writes through RPC with operator summary', async ({ page }) => {
  await setupAdmin(page)
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/inventory/products/import')
  await page.getByTestId('product-import-raw').fill('name,sku,base_unit_name,default_sale_price\nA,SKU-A,thùng,1000\nB,SKU-B,chai,2000')
  await page.getByRole('button', { name: 'Xác nhận import' }).click()
  await expect(page.getByTestId('product-import-result')).toContainText('Import xong')
})
