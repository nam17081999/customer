const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-24T03:00:00.000Z'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'import-store-1',
    name: overrides.name || 'Tạp hóa nền',
    store_type: overrides.store_type || 'tap_hoa',
    address_detail: overrides.address_detail || 'Xóm Chợ',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    phone: Object.prototype.hasOwnProperty.call(overrides, 'phone') ? overrides.phone : '0901234567',
    phone_secondary: overrides.phone_secondary || null,
    note: overrides.note || null,
    latitude: Object.prototype.hasOwnProperty.call(overrides, 'latitude') ? overrides.latitude : 21.02861,
    longitude: Object.prototype.hasOwnProperty.call(overrides, 'longitude') ? overrides.longitude : 105.80492,
    active: overrides.active ?? true,
    is_potential: overrides.is_potential ?? false,
    created_at: overrides.created_at || BASE_TIMESTAMP,
    updated_at: overrides.updated_at || BASE_TIMESTAMP,
    last_called_at: overrides.last_called_at || null,
    last_call_result: overrides.last_call_result || null,
    last_call_result_at: overrides.last_call_result_at || null,
    last_order_reported_at: overrides.last_order_reported_at || null,
    sales_note: overrides.sales_note || null,
  }
}

function createE2EState(overrides = {}) {
  return {
    auth: { role: 'admin' },
    stores: [buildStore()],
    ...overrides,
  }
}

async function setupImportFlow(page, overrides = {}) {
  const state = createE2EState(overrides)

  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value
    window.__IMPORT_EVENTS__ = []
    window.addEventListener('storevis:stores-changed', (event) => {
      window.__IMPORT_EVENTS__.push(event.detail)
    })
  }, state)
}

async function uploadCsv(page, content, filename = 'store-import.csv') {
  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  })
}

test('admin import dòng tạo mới thành công và phát event append-many', async ({ page }) => {
  await setupImportFlow(page, {
    stores: [
      buildStore({
        id: 'existing-1',
        name: 'Cửa hàng đã có',
        district: 'Hoài Đức',
        ward: 'An Khánh',
      }),
    ],
  })

  const insertPayloads = []
  const patchPayloads = []

  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      const payloads = JSON.parse(request.postData() || '[]')
      const rows = Array.isArray(payloads) ? payloads : [payloads]
      insertPayloads.push(...rows)

      const createdRows = rows.map((row, index) => ({
        id: `created-import-${index + 1}`,
        ...row,
        created_at: BASE_TIMESTAMP,
        updated_at: BASE_TIMESTAMP,
        phone_secondary: row.phone_secondary ?? null,
        image_url: null,
        is_potential: false,
        last_called_at: null,
        last_call_result: null,
        last_call_result_at: null,
        last_order_reported_at: null,
        sales_note: null,
      }))

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdRows),
      })
      return
    }

    if (request.method() === 'PATCH') {
      patchPayloads.push(JSON.parse(request.postData() || '{}'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    await route.continue()
  })

  await page.goto('/store/import')

  await expect(page.getByRole('heading', { name: 'Nhập nhiều cửa hàng từ file CSV' })).toBeVisible()

  await uploadCsv(
    page,
    [
      'Tên cửa hàng,Loại cửa hàng,Địa chỉ chi tiết,Xã / Phường,Quận / Huyện,Số điện thoại,Ghi chú,Vĩ độ,Kinh độ',
      'Bách hóa Lan Chi,Tạp hóa,Xóm Chợ Mới,An Khánh,Hoài Đức,0908888888,Gần cổng trường,21.03123,105.80234',
    ].join('\n')
  )

  await expect(page.getByText('File đã chọn:')).toBeVisible()
  await expect(page.getByText('Tổng dòng')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nhập 1 dòng hợp lệ' })).toBeEnabled()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Nhập 1 dòng hợp lệ' }).click()

  await expect(page.getByText(/Đã xử lý thành công 1 dòng/i)).toBeVisible()
  expect(insertPayloads).toHaveLength(1)
  expect(insertPayloads[0]).toMatchObject({
    name: 'Bách Hóa Lan Chi',
    store_type: 'tap_hoa',
    address_detail: 'Xóm Chợ Mới',
    ward: 'An Khánh',
    district: 'Hoài Đức',
    phone: '0908888888',
    note: 'Gần cổng trường',
    latitude: 21.03123,
    longitude: 105.80234,
    active: true,
  })
  expect(patchPayloads).toHaveLength(0)

  await expect.poll(async () => (
    page.evaluate(() => (window.__IMPORT_EVENTS__ || []).map((event) => event.type))
  )).toEqual(['append-many'])
})

test('admin import dòng nghi trùng có thể chọn store cũ và cập nhật theo prefer-import', async ({ page }) => {
  await setupImportFlow(page, {
    stores: [
      buildStore({
        id: 'duplicate-target-1',
        name: 'Tạp hóa Minh Anh',
        store_type: 'tap_hoa',
        address_detail: 'Xóm Chợ Cũ',
        ward: 'An Khánh',
        district: 'Hoài Đức',
        phone: '0901111111',
        note: 'Gần cổng chợ',
        latitude: null,
        longitude: null,
      }),
    ],
  })

  const insertPayloads = []
  const patchPayloads = []

  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      const payloads = JSON.parse(request.postData() || '[]')
      const rows = Array.isArray(payloads) ? payloads : [payloads]
      insertPayloads.push(...rows)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    if (request.method() === 'PATCH') {
      const payload = JSON.parse(request.postData() || '{}')
      patchPayloads.push(payload)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'duplicate-target-1',
          name: 'Tạp hóa Minh Anh',
          store_type: payload.store_type,
          address_detail: payload.address_detail,
          ward: payload.ward || 'An Khánh',
          district: payload.district || 'Hoài Đức',
          phone: payload.phone,
          note: payload.note,
          latitude: payload.latitude,
          longitude: payload.longitude,
          active: true,
          created_at: BASE_TIMESTAMP,
          updated_at: payload.updated_at || BASE_TIMESTAMP,
          phone_secondary: null,
          image_url: null,
          is_potential: false,
          last_called_at: null,
          last_call_result: null,
          last_call_result_at: null,
          last_order_reported_at: null,
          sales_note: null,
        }),
      })
      return
    }

    await route.continue()
  })

  await page.goto('/store/import')

  await uploadCsv(
    page,
    [
      'Tên cửa hàng,Loại cửa hàng,Địa chỉ chi tiết,Xã / Phường,Quận / Huyện,Số điện thoại,Ghi chú,Vĩ độ,Kinh độ',
      'Tạp hóa Minh Anh,Quán ăn/uống,Xóm Chợ Mới,An Khánh,Hoài Đức,0902222222,Gần cổng trường,21.03211,105.80345',
    ].join('\n')
  )

  await expect(page.getByText('Cần xử lý', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Chọn trong 1 cửa hàng/i }).click()
  await page.getByRole('button', { name: 'Chọn cửa hàng này' }).click()
  await page.getByRole('button', { name: 'Lấy dữ liệu mới' }).click()

  await expect(page.getByRole('button', { name: 'Nhập 1 dòng hợp lệ' })).toBeEnabled()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Nhập 1 dòng hợp lệ' }).click()

  await expect(page.getByText(/Đã xử lý thành công 1 dòng/i)).toBeVisible()
  expect(insertPayloads).toHaveLength(0)
  expect(patchPayloads).toHaveLength(1)
  expect(patchPayloads[0]).toMatchObject({
    store_type: 'quan_an',
    address_detail: 'Xóm Chợ Mới',
    phone: '0902222222',
    note: 'Gần cổng trường',
    latitude: 21.03211,
    longitude: 105.80345,
  })
  expect(patchPayloads[0].updated_at).toBeTruthy()

  await expect.poll(async () => (
    page.evaluate(() => (window.__IMPORT_EVENTS__ || []).map((event) => event.type))
  )).toEqual(['update'])
})
