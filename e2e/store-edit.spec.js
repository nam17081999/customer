const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-23T14:00:00.000Z'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'seed-store-1',
    name: overrides.name || 'Kho Nền Test',
    store_type: overrides.store_type || 'Tạp hóa',
    address_detail: overrides.address_detail || 'Xóm Chợ',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    phone: overrides.phone || null,
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

async function setupEditFlow(page, overrides = {}) {
  const state = createE2EState(overrides)

  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value
  }, state)
}

test('admin edit dùng layout step và lưu thành công', async ({ page }) => {
  await setupEditFlow(page)

  let updatePayload = null
  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()
    if (request.method() !== 'PATCH') {
      await route.continue()
      return
    }

    updatePayload = JSON.parse(request.postData() || '{}')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })

  await page.goto('/store/edit/seed-store-1')

  await expect(page.getByText('Sửa cửa hàng')).toBeVisible()
  await page.getByLabel('Tên cửa hàng').fill('tạp hóa minh anh')
  await page.getByRole('button', { name: 'Tiếp theo' }).click()

  await expect(page.getByText('Quận / Huyện')).toBeVisible()
  await page.getByLabel('Địa chỉ cụ thể (không bắt buộc)').fill('xóm chợ mới')
  await page.getByRole('button', { name: 'Tiếp theo →' }).click()

  await expect(page.getByTestId('e2e-store-location-picker')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('Xác nhận chỉnh sửa cửa hàng')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()

  await page.waitForURL('**/')
  await expect(page.getByText('Đã lưu thay đổi cửa hàng!')).toBeVisible()
  expect(updatePayload).toMatchObject({
    name: 'Tạp Hóa Minh Anh',
    address_detail: 'Xóm Chợ Mới',
    ward: 'An Khánh',
    district: 'Hoài Đức',
  })
})

test('guest supplement giữ flow step và gửi store report', async ({ page }) => {
  await setupEditFlow(page, {
    auth: { role: 'guest' },
    stores: [
      buildStore({
        id: 'supplement-store-1',
        name: 'Tạp hóa Thiếu Dữ Liệu',
        store_type: 'Tạp hóa',
        address_detail: '',
        phone: '',
        note: '',
        latitude: null,
        longitude: null,
      }),
    ],
  })

  let reportPayload = null
  await page.route('**/rest/v1/store_reports*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const payloads = JSON.parse(request.postData() || '[]')
    reportPayload = Array.isArray(payloads) ? payloads[0] : payloads
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'report-1' }]),
    })
  })

  await page.goto('/store/edit/supplement-store-1?mode=supplement')

  await expect(page.getByText('Bổ sung cửa hàng')).toBeVisible()
  await expect(page.getByText('Bạn chưa đăng nhập.')).toBeVisible()
  await page.getByRole('button', { name: 'Tiếp theo' }).click()

  await expect(page.getByText('Quận / Huyện')).toBeVisible()
  await page.getByLabel('Số điện thoại').fill('0901234567')
  await page.getByRole('button', { name: 'Tiếp theo →' }).click()

  await expect(page.getByTestId('e2e-store-location-picker')).toBeVisible()
  await page.getByRole('button', { name: 'Gửi bổ sung' }).click()
  await expect(page.getByText('Xác nhận bổ sung cửa hàng')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu bổ sung' }).click()

  await page.waitForURL('**/')
  await expect(page.getByText('Đã gửi đề xuất bổ sung để admin duyệt!')).toBeVisible()
  expect(reportPayload).toMatchObject({
    store_id: 'supplement-store-1',
    report_type: 'edit',
  })
  expect(reportPayload.proposed_changes).toMatchObject({
    phone: '0901234567',
    latitude: 21.02851,
    longitude: 105.80482,
  })
})

test('guest supplement store đã có tọa độ chỉ đi 2 bước và không gửi lại location', async ({ page }) => {
  await setupEditFlow(page, {
    auth: { role: 'guest' },
    stores: [
      buildStore({
        id: 'supplement-store-2',
        name: 'Tạp hóa Đã Có Vị Trí',
        store_type: 'Tạp hóa',
        address_detail: '',
        phone: '',
        note: '',
        latitude: 21.03123,
        longitude: 105.79991,
      }),
    ],
  })

  let reportPayload = null
  await page.route('**/rest/v1/store_reports*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    const payloads = JSON.parse(request.postData() || '[]')
    reportPayload = Array.isArray(payloads) ? payloads[0] : payloads
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'report-2' }]),
    })
  })

  await page.goto('/store/edit/supplement-store-2?mode=supplement')

  await expect(page.getByText('Bổ sung cửa hàng')).toBeVisible()

  await page.getByRole('button', { name: 'Tiếp theo' }).click()
  await expect(page.getByText('Quận / Huyện')).toBeVisible()
  await expect(page.getByTestId('e2e-store-location-picker')).toHaveCount(0)
  await page.getByLabel('Số điện thoại').fill('0901234568')
  await expect(page.getByRole('button', { name: 'Gửi bổ sung' })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi bổ sung' }).click()
  await expect(page.getByText('Xác nhận bổ sung cửa hàng')).toBeVisible()
  await page.getByRole('button', { name: 'Lưu bổ sung' }).click()

  await page.waitForURL('**/')
  await expect(page.getByText('Đã gửi đề xuất bổ sung để admin duyệt!')).toBeVisible()
  expect(reportPayload.proposed_changes).toMatchObject({
    phone: '0901234568',
  })
  expect(reportPayload.proposed_changes.latitude).toBeUndefined()
  expect(reportPayload.proposed_changes.longitude).toBeUndefined()
})

test('guest mở màn edit thường bị chuyển sang login', async ({ page }) => {
  await setupEditFlow(page, {
    auth: { role: 'guest' },
  })

  await page.goto('/store/edit/seed-store-1')
  await page.waitForURL(/\/login\?from=/)
})
