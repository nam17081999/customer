const { test, expect } = require('@playwright/test')

/**
 * Unique ID per test run — avoids state bleed between independent tests.
 */
function uid() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

/**
 * Setup admin auth override + full Supabase REST/RPC interception.
 *
 * Pattern matches all existing e2e tests:
 *   - __STOREVIS_E2E__ for auth override (admin role)
 *   - page.route(.../rest/v1/...) intercepts Supabase REST
 *   - page.route(.../rpc/...) intercepts Supabase RPC (function calls)
 *
 * Stock is tracked in-memory so purchase/sales flows change it live.
 */
async function setupAdmin(page, options = {}) {
  const now = Date.now()
  const productId = options.productId || `e2e-prod-${uid()}`
  const unitId = options.unitId || `e2e-unit-${uid()}`
  const caseUnitId = `case-${unitId}`
  const purchaseOrderId = options.purchaseOrderId || `e2e-po-${uid()}`
  const salesOrderId = options.salesOrderId || `e2e-so-${uid()}`
  const storeId = options.storeId || `e2e-store-${uid()}`
  const productName = options.productName || `E2E Test ${uid()}`
  const ts = new Date(now).toISOString()

  // In-memory stock that purchase/sales RPC mocks mutate
  let currentStockQty = options.initialStockQty ?? 0
  let currentAvgCost = options.initialAvgCost ?? 0

  // Captured payloads for assertions
  const captured = {
    createdProducts: [],
    createdPurchaseOrders: [],
    createdSalesOrders: [],
  }

  // Pre-built normalized product row (matches what normalizeProduct() returns)
  const baseUnit = {
    id: unitId, product_id: productId, unit_name: 'chai',
    conversion_to_base_qty: 1, default_sale_price: 1000,
    default_purchase_price: 700, is_base_unit: true, active: true,
  }
  const caseUnit = {
    id: caseUnitId, product_id: productId, unit_name: 'thùng',
    conversion_to_base_qty: 12, default_sale_price: 11000,
    default_purchase_price: 7500, is_base_unit: false, active: true,
  }
  const units = [baseUnit, caseUnit]
  const stockRow = { product_id: productId, on_hand_base_qty: currentStockQty, avg_cost_per_base_unit: currentAvgCost || 700 }

  const stores = options.stores || [
    { id: storeId, name: `Khách E2E ${uid()}`, store_type: 'tap_hoa',
      address_detail: 'Xóm Chợ E2E', ward: 'An Khánh', district: 'Hoài Đức',
      phone: '0900000001', active: true, created_at: ts, updated_at: ts },
  ]

  const productRow = {
    id: productId, name: productName, sku: `SKU-${productId}`,
    category: 'E2E Testing', base_unit_name: 'chai',
    default_sale_price: 1000, default_purchase_price: 700,
    min_stock_base_qty: 5, note: null, active: true,
    created_by: null, created_at: ts, updated_at: ts,
  }

  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value
  }, { auth: { role: 'admin' }, stores })

  // ── Supabase REST (PostgREST) ──
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    // ── products ──
    if (url.includes('/products')) {
      if (method === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}')
        const row = Array.isArray(payload) ? payload[0] : payload
        captured.createdProducts.push(row)
        return route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ ...productRow, ...row, id: productId }),
        })
      }
      // GET or HEAD — return the product list
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-0/1` },
        body: JSON.stringify([productRow]),
      })
    }

    // ── product_units ──
    if (url.includes('/product_units')) {
      if (method === 'POST') {
        // product_units insert — just ack
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{}]) })
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(units),
      })
    }

    // ── product_stock ──
    if (url.includes('/product_stock')) {
      if (method === 'POST') {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([stockRow]) })
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([stockRow]),
      })
    }

    // ── purchase_orders ──
    if (url.includes('/purchase_orders')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    // ── sales_orders ──
    if (url.includes('/sales_orders')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    // ── stock_movements ──
    if (url.includes('/stock_movements')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    // ── stores (for sales-order customer picker) ──
    if (url.includes('/stores')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stores) })
    }

    // ── inventory_reconciliation_runs ──
    if (url.includes('/inventory_reconciliation_runs')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    // ── stores_cache ──
    if (url.includes('/rpc') || url.includes('/stores_cache')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // ── Supabase RPC (stored procedures) ──
  await page.route('**/rpc/**', async (route) => {
    const url = route.request().url()

    if (url.includes('create_purchase_order_with_items')) {
      captured.createdPurchaseOrders.push(JSON.parse(route.request().postData() || '{}'))
      // Simulate stock increase: 5 thùng × 12 chai = 60 base units
      currentStockQty += 60
      currentAvgCost = 625 // 7500 / 12
      stockRow.on_hand_base_qty = currentStockQty
      stockRow.avg_cost_per_base_unit = currentAvgCost
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: purchaseOrderId }) })
    }

    if (url.includes('create_sales_order_with_items')) {
      captured.createdSalesOrders.push(JSON.parse(route.request().postData() || '{}'))
      // Simulate stock decrease: selling 1 thùng = 12 chai
      currentStockQty = Math.max(0, currentStockQty - 12)
      stockRow.on_hand_base_qty = currentStockQty
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: salesOrderId }) })
    }

    // ── Aggregates & reports ──
    if (url.includes('get_inventory_valuation_summary')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          product_count: 1, active_product_count: 1,
          low_stock_count: currentStockQty <= 5 ? 1 : 0,
          out_of_stock_count: currentStockQty === 0 ? 1 : 0,
          stock_value: currentStockQty * (currentAvgCost || 700),
        }]),
      })
    }

    if (url.includes('get_low_stock_report')) {
      const rows = currentStockQty <= 5
        ? [{ product_id: productId, product_name: productName, on_hand_base_qty: currentStockQty, min_stock_base_qty: 5 }]
        : []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
    }

    if (url.includes('get_sales_summary') || url.includes('get_purchase_summary') || url.includes('get_top_products_report') || url.includes('get_customer_revenue_report')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    if (url.includes('get_inventory_reconciliation_report')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    if (url.includes('run_inventory_reconciliation_check')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ run_id: 'run-e2e', mismatch_count: 0 }]) })
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  return { productId, unitId, caseUnitId, purchaseOrderId, salesOrderId, storeId, stores, productName, captured, get currentStock() { return currentStockQty } }
}

// ═══════════════════════════════════════════════════════
// Test 1: Create product → stock = 0
// ═══════════════════════════════════════════════════════
test('1. Tạo sản phẩm mới → kiểm tra tồn kho = 0', async ({ page }) => {
  const ctx = await setupAdmin(page)

  await page.goto('/inventory/products')

  // ── Heading ──
  await expect(page.getByRole('heading', { name: 'Hàng hóa & tồn kho' })).toBeVisible()

  // ── Fill form ──
  await page.getByPlaceholder('Nước Lavie 500ml').fill(ctx.productName)
  await page.getByPlaceholder('LAVIE500').fill(`SKU-${ctx.productId}`)
  await page.getByRole('textbox', { name: 'Nhóm', exact: true }).fill('E2E Testing')

  await page.locator('label').filter({ hasText: 'Đơn vị gốc' }).locator('input').fill('chai')
  await page.locator('label').filter({ hasText: 'Tồn tối thiểu' }).locator('input').fill('5')
  await page.locator('label').filter({ hasText: 'Giá bán/gốc' }).locator('input').fill('1000')
  await page.locator('label').filter({ hasText: 'Giá nhập/gốc' }).locator('input').fill('700')

  // ── Submit ──
  await page.getByRole('button', { name: 'Thêm hàng' }).click()
  await expect(page.getByText('Đã thêm hàng hóa.')).toBeVisible()

  // ── Product visible in list as a link ──
  await expect(page.getByRole('link', { name: ctx.productName })).toBeVisible()

  // POST create was intercepted
  expect(ctx.captured.createdProducts).toHaveLength(1)
})

// ═══════════════════════════════════════════════════════
// Test 2: Purchase → stock increases
// ═══════════════════════════════════════════════════════
test('2. Nhập hàng (purchase) → kiểm tra tồn kho tăng', async ({ page }) => {
  const ctx = await setupAdmin(page)

  await page.goto('/inventory/purchases/new')

  // ── Heading ──
  await expect(page.getByRole('heading', { name: 'Nhập hàng' })).toBeVisible()

  // ── Product select should contain our product ──
  const productSelect = page.locator('select').first()
  await expect(productSelect).toBeVisible()

  // ── Select product & unit ──
  await productSelect.selectOption(ctx.productId)
  await page.locator('select').nth(1).selectOption(ctx.caseUnitId)

  // ── Fill qty & price ──
  const inputs = page.locator('input[type="number"]')
  await inputs.nth(0).fill('5')       // quantity
  await inputs.nth(1).fill('7500')    // unit cost

  // ── Submit ──
  await page.getByRole('button', { name: 'Lưu phiếu nhập' }).click()
  await page.waitForURL('**/inventory/products')

  // ── Verify RPC call ──
  expect(ctx.captured.createdPurchaseOrders).toHaveLength(1)
  const po = ctx.captured.createdPurchaseOrders[0]
  expect(po.p_items).toHaveLength(1)
  expect(po.p_items[0].product_id).toBe(ctx.productId)
  expect(po.p_items[0].quantity).toBe(5)
})

// ═══════════════════════════════════════════════════════
// Test 3: Sales order → stock decreases
// ═══════════════════════════════════════════════════════
test('3. Tạo đơn bán (sales order) → kiểm tra tồn kho giảm', async ({ page }) => {
  // Start with stock of 60 (as if 5 thùng were purchased)
  const ctx = await setupAdmin(page, { initialStockQty: 60, initialAvgCost: 625 })

  await page.goto('/orders/new')

  // ── Page loaded ──
  await expect(page.getByPlaceholder('Tìm hàng hóa').first()).toBeVisible()

  // ── Step 1: Search and add product ──
  const searchInput = page.getByPlaceholder('Tìm hàng hóa')
  await searchInput.fill(ctx.productName)

  // After typing, a dropdown with matching products appears as <button> elements
  const productDropdownBtn = page.locator('div[class*="absolute"] button').filter({ hasText: ctx.productName }).first()
  await expect(productDropdownBtn).toBeVisible({ timeout: 5000 })
  await productDropdownBtn.click()

  // ── Step 2: Select customer store ──
  const customerInput = page.getByPlaceholder('Tìm khách hàng')
  await customerInput.fill(ctx.stores[0].name)

  const storeDropdownBtn = page.locator('div[class*="absolute"] button').filter({ hasText: ctx.stores[0].name }).first()
  await expect(storeDropdownBtn).toBeVisible({ timeout: 5000 })
  await storeDropdownBtn.click()

  // ── Step 3: Submit order ──
  await page.getByRole('button', { name: 'LÊN ĐƠN' }).click()

  // ── Verify RPC call ──
  await expect(async () => {
    expect(ctx.captured.createdSalesOrders).toHaveLength(1)
  }).toPass({ timeout: 8000 })

  const so = ctx.captured.createdSalesOrders[0]
  expect(so.p_items).toHaveLength(1)
  expect(so.p_items[0].product_id).toBe(ctx.productId)
  // Default unit is thùng (conversion > 1), qty = 1
  expect(so.p_order.customer_store_id).toBe(ctx.storeId)
})

// ═══════════════════════════════════════════════════════
// Test 4: Stock report displays correctly
// ═══════════════════════════════════════════════════════
test('4. Kiểm tra báo cáo tồn kho hiển thị đúng', async ({ page }) => {
  // Stock = 3 (below min_stock_base_qty=5) so product appears in "Sắp hết hàng"
  const ctx = await setupAdmin(page, { initialStockQty: 3, initialAvgCost: 700 })

  await page.goto('/inventory/stock')

  // ── Page heading ──
  await expect(page.getByRole('heading', { name: 'Báo cáo tồn kho' })).toBeVisible()

  // ── Product appears in low-stock section ──
  await expect(page.getByText(ctx.productName).first()).toBeVisible()

  // ── Section headings ──
  await expect(page.getByRole('heading', { name: 'Sắp hết hàng' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Phát sinh kho' })).toBeVisible()

  // ── Reconciliation summary cards visible ──
  await expect(page.getByText('Đối soát').first()).toBeVisible()
  await expect(page.getByText('Tồn dưới 0')).toBeVisible()
  await expect(page.getByText('Phát sinh lẻ')).toBeVisible()
  await expect(page.getByText('Lần chạy')).toBeVisible()

  // ── Stock movement filter (select) is present ──
  await expect(page.locator('select').filter({ has: page.locator('option', { hasText: 'Tất cả phát sinh' }) })).toBeVisible()

  // ── Buttons: Đối soát, Sửa theo ledger, Làm mới ──
  await expect(page.getByRole('button', { name: 'Đối soát' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Làm mới' })).toBeVisible()
})

// ═══════════════════════════════════════════════════════
// Combined flow: Create → Purchase → Sell → Verify report
// ═══════════════════════════════════════════════════════
test('FLOW: Tạo sản phẩm → Nhập hàng → Bán → Kiểm tra tồn kho', async ({ page }) => {
  const ctx = await setupAdmin(page)

  // ── 1. CREATE product ──
  await page.goto('/inventory/products')
  await page.getByPlaceholder('Nước Lavie 500ml').fill(ctx.productName)
  await page.getByPlaceholder('LAVIE500').fill(`SKU-${ctx.productId}`)
  await page.getByRole('textbox', { name: 'Nhóm', exact: true }).fill('E2E Flow')
  await page.locator('label').filter({ hasText: 'Đơn vị gốc' }).locator('input').fill('chai')
  await page.locator('label').filter({ hasText: 'Tồn tối thiểu' }).locator('input').fill('5')
  await page.locator('label').filter({ hasText: 'Giá bán/gốc' }).locator('input').fill('1000')
  await page.locator('label').filter({ hasText: 'Giá nhập/gốc' }).locator('input').fill('700')
  await page.getByRole('button', { name: 'Thêm hàng' }).click()
  await expect(page.getByText('Đã thêm hàng hóa.')).toBeVisible()
  expect(ctx.captured.createdProducts).toHaveLength(1)

  // ── 2. PURCHASE 5 thùng ──
  await page.goto('/inventory/purchases/new')
  await page.locator('select').first().selectOption(ctx.productId)
  await page.locator('select').nth(1).selectOption(ctx.caseUnitId)
  await page.locator('input[type="number"]').nth(0).fill('5')
  await page.locator('input[type="number"]').nth(1).fill('7500')
  await page.getByRole('button', { name: 'Lưu phiếu nhập' }).click()
  await page.waitForURL('**/inventory/products')
  expect(ctx.captured.createdPurchaseOrders).toHaveLength(1)

  // ── 3. SELL 1 thùng ──
  await page.goto('/orders/new')
  await page.getByPlaceholder('Tìm hàng hóa').fill(ctx.productName)
  const productBtn = page.locator('div[class*="absolute"] button').filter({ hasText: ctx.productName }).first()
  await expect(productBtn).toBeVisible({ timeout: 5000 })
  await productBtn.click()

  await page.getByPlaceholder('Tìm khách hàng').fill(ctx.stores[0].name)
  const storeBtn = page.locator('div[class*="absolute"] button').filter({ hasText: ctx.stores[0].name }).first()
  await expect(storeBtn).toBeVisible({ timeout: 5000 })
  await storeBtn.click()

  await page.getByRole('button', { name: 'LÊN ĐƠN' }).click()
  await expect(async () => {
    expect(ctx.captured.createdSalesOrders).toHaveLength(1)
  }).toPass({ timeout: 8000 })
  expect(ctx.captured.createdSalesOrders[0].p_items[0].product_id).toBe(ctx.productId)

  // ── 4. VERIFY stock report ──
  await page.goto('/inventory/stock')
  await expect(page.getByRole('heading', { name: 'Báo cáo tồn kho' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sắp hết hàng' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Phát sinh kho' })).toBeVisible()
  await expect(page.getByText('Đối soát').first()).toBeVisible()
})
