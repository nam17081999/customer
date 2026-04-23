const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-23T14:00:00.000Z'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'seed-store-1',
    name: overrides.name || 'Kho Nền Test',
    store_type: overrides.store_type || 'Kho',
    address_detail: overrides.address_detail || 'Xóm Chợ',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    phone: overrides.phone || null,
    phone_secondary: overrides.phone_secondary || null,
    note: overrides.note || null,
    latitude: overrides.latitude ?? 21.02861,
    longitude: overrides.longitude ?? 105.80492,
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
    auth: { role: 'guest' },
    geolocation: {
      coords: {
        latitude: 21.02851,
        longitude: 105.80482,
        accuracy: 5,
      },
      heading: 42,
    },
    stores: [
      buildStore(),
    ],
    ...overrides,
  }
}

async function setupCreateFlow(page, overrides = {}) {
  const state = createE2EState(overrides)

  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value
  }, state)

  let insertCounter = 0
  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const payloads = JSON.parse(request.postData() || '[]')
    const payload = Array.isArray(payloads) ? payloads[0] : payloads
    insertCounter += 1

    const row = {
      id: `e2e-created-${insertCounter}`,
      name: payload.name,
      store_type: payload.store_type,
      address_detail: payload.address_detail,
      ward: payload.ward,
      district: payload.district,
      phone: payload.phone,
      phone_secondary: payload.phone_secondary,
      note: payload.note,
      latitude: payload.latitude,
      longitude: payload.longitude,
      active: payload.active,
      is_potential: payload.is_potential,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
      last_called_at: null,
      last_call_result: null,
      last_call_result_at: null,
      last_order_reported_at: null,
      sales_note: null,
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([row]),
    })
  })

  await page.goto('/store/create')
}

async function completeStep1(page, name) {
  await page.getByLabel('Tên cửa hàng').fill(name)
  await page.getByRole('button', { name: 'Tiếp theo' }).click()
}

async function fillStep2(page, { district = 'Hoài Đức', ward = 'An Khánh', phone = null } = {}) {
  await expect(page.getByText('Quận / Huyện')).toBeVisible()
  await page.getByRole('button', { name: district, exact: true }).click()
  await page.getByRole('button', { name: ward, exact: true }).click()

  if (phone) {
    await page.getByLabel(/Số điện thoại/i).first().fill(phone)
  }
}

test('tạo cửa hàng đầy đủ qua browser flow và redirect về trang chủ', async ({ page }) => {
  await setupCreateFlow(page)

  await completeStep1(page, 'Bách hóa Lan Chi')
  await fillStep2(page)

  await page.getByRole('button', { name: 'Tiếp theo →' }).click()

  await expect(page.getByTestId('e2e-store-location-picker')).toBeVisible()
  await expect(page.getByTestId('e2e-store-location-coords')).not.toHaveText('Chưa có tọa độ')

  await page.getByRole('button', { name: /Lưu cửa hàng/i }).click()
  await expect(page.getByText('Xác nhận tạo cửa hàng')).toBeVisible()
  await page.getByRole('button', { name: 'Tạo cửa hàng' }).click()

  await page.waitForURL('**/')
  await expect(page.getByText('Tạo cửa hàng thành công!')).toBeVisible()
})

test('hiện cảnh báo nghi trùng ở bước 1 và vẫn cho phép tạo tiếp', async ({ page }) => {
  await setupCreateFlow(page, {
    stores: [
      buildStore({
        id: 'duplicate-store-1',
        name: 'Tạp hóa Minh Anh',
        latitude: 21.02852,
        longitude: 105.80483,
      }),
    ],
  })

  await completeStep1(page, 'Minh Anh')

  await expect(page.getByText('Phát hiện cửa hàng có thể đã được tạo')).toBeVisible()
  await expect(page.getByText('Tạp hóa Minh Anh')).toBeVisible()

  await page.getByRole('button', { name: 'Vẫn tạo cửa hàng' }).click()

  await fillStep2(page)
  await page.getByRole('button', { name: 'Tiếp theo →' }).click()
  await expect(page.getByTestId('e2e-store-location-picker')).toBeVisible()

  await page.getByRole('button', { name: /Lưu cửa hàng/i }).click()
  await page.getByRole('button', { name: 'Tạo cửa hàng' }).click()

  await page.waitForURL('**/')
  await expect(page.getByText('Tạo cửa hàng thành công!')).toBeVisible()
})

test('telesale có thể quick-save ở bước 2 mà không cần vào bước vị trí', async ({ page }) => {
  await setupCreateFlow(page, {
    auth: { role: 'telesale' },
    stores: [],
  })

  await completeStep1(page, 'Cửa hàng Telesale Mới')
  await fillStep2(page, { phone: '0901234567' })

  await page.getByRole('button', { name: 'Lưu cửa hàng' }).click()
  await expect(page.getByText('Xác nhận lưu không vị trí')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu luôn' }).click()

  await page.waitForURL('**/')
  await expect(page.getByText('Tạo cửa hàng thành công!')).toBeVisible()
})
