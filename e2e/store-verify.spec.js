const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-24T03:00:00.000Z'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'verify-store-1',
    name: overrides.name || 'Tạp hóa chờ duyệt',
    store_type: overrides.store_type || 'tap_hoa',
    address_detail: overrides.address_detail || 'Xóm Chợ',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    phone: Object.prototype.hasOwnProperty.call(overrides, 'phone') ? overrides.phone : '0901234567',
    phone_secondary: overrides.phone_secondary || null,
    note: overrides.note || null,
    latitude: Object.prototype.hasOwnProperty.call(overrides, 'latitude') ? overrides.latitude : 21.02861,
    longitude: Object.prototype.hasOwnProperty.call(overrides, 'longitude') ? overrides.longitude : 105.80492,
    active: overrides.active ?? false,
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
    stores: [
      buildStore({ id: 'verify-store-1' }),
      buildStore({ id: 'verify-store-2', name: 'Quán ăn chờ duyệt', district: 'Quốc Oai', ward: 'Yên Sơn' }),
    ],
    ...overrides,
  }
}

async function setupVerifyFlow(page, overrides = {}) {
  const state = createE2EState(overrides)

  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value
    window.__VERIFY_EVENTS__ = []
    window.addEventListener('storevis:stores-changed', (event) => {
      window.__VERIFY_EVENTS__.push(event.detail)
    })
  }, state)
}

test('admin bulk verify cập nhật UI và phát event sync đúng nhánh', async ({ page }) => {
  await setupVerifyFlow(page, {
    auth: { role: 'admin' },
    stores: [
      buildStore({ id: 'pending-1', name: 'Tạp hóa chờ 1', active: false, district: 'Hoài Đức', ward: 'An Khánh' }),
      buildStore({ id: 'pending-2', name: 'Tạp hóa chờ 2', active: false, district: 'Quốc Oai', ward: 'Yên Sơn' }),
      buildStore({ id: 'active-1', name: 'Đã xác thực', active: true }),
    ],
  })

  let verifyPayload = null
  let verifyRequestUrl = ''
  let historyPayload = null

  await page.route('**/rest/v1/store_reports*', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-range': '0-0/3',
      },
      body: '',
    })
  })

  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()
    if (request.method() !== 'PATCH') {
      await route.continue()
      return
    }

    verifyRequestUrl = request.url()
    verifyPayload = JSON.parse(request.postData() || '{}')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })

  await page.route('**/rest/v1/store_edit_history*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    historyPayload = JSON.parse(request.postData() || '[]')
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '[]',
    })
  })

  await page.goto('/store/verify')

  await expect(page.getByText('Màn xác thực cửa hàng')).toBeVisible()
  await expect(page.getByText('Tạp hóa chờ 1')).toBeVisible()
  await expect(page.getByText('Tạp hóa chờ 2')).toBeVisible()
  await expect(page.getByText('Đã xác thực')).toHaveCount(0)

  await page.getByLabel('Chọn tất cả đang hiển thị').check()
  await expect(page.getByRole('button', { name: 'Xác thực đã chọn (2)' })).toBeEnabled()

  await page.getByRole('button', { name: 'Xác thực đã chọn (2)' }).click()
  await expect(page.getByText('Xác nhận xác thực')).toBeVisible()
  await page.getByRole('button', { name: 'Xác thực' }).click()

  await expect(page.getByText('Đã xác thực 2 cửa hàng.')).toBeVisible()
  await expect(page.getByText('Tạp hóa chờ 1')).toHaveCount(0)
  await expect(page.getByText('Tạp hóa chờ 2')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xác thực đã chọn (0)' })).toBeDisabled()

  expect(verifyPayload).toMatchObject({
    active: true,
  })
  expect(verifyPayload.updated_at).toBeTruthy()
  expect(verifyRequestUrl).toContain('id=in.')
  expect(historyPayload).toHaveLength(2)
  expect(historyPayload.every((row) => row.action_type === 'verify')).toBe(true)

  await expect.poll(() => page.evaluate(() => window.__VERIFY_EVENTS__)).toEqual([
    {
      type: 'verify-many',
      ids: ['pending-1', 'pending-2'],
    },
  ])
})

test('user đã đăng nhập nhưng không phải admin bị chuyển khỏi màn verify', async ({ page }) => {
  await setupVerifyFlow(page, {
    auth: { role: 'telesale' },
    stores: [buildStore({ id: 'pending-1', active: false })],
  })

  await page.goto('/store/verify')
  await page.waitForURL('**/account')
})
