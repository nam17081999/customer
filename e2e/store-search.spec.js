const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-24T02:00:00.000Z'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'search-store-1',
    name: overrides.name || 'Tạp Hóa Minh Anh',
    store_type: overrides.store_type || 'Tạp hóa',
    address_detail: overrides.address_detail || 'Xóm Chợ Cũ',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    phone: Object.prototype.hasOwnProperty.call(overrides, 'phone') ? overrides.phone : '0901234567',
    phone_secondary: overrides.phone_secondary || null,
    note: overrides.note || null,
    latitude: Object.prototype.hasOwnProperty.call(overrides, 'latitude') ? overrides.latitude : 21.02861,
    longitude: Object.prototype.hasOwnProperty.call(overrides, 'longitude') ? overrides.longitude : 105.80492,
    active: overrides.active ?? true,
    is_potential: overrides.is_potential ?? false,
    image_url: overrides.image_url || null,
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
    },
    stores: [
      buildStore(),
    ],
    ...overrides,
  }
}

async function setupSearchFlow(page, overrides = {}) {
  const state = createE2EState(overrides)

  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value

    const geo = value?.geolocation || {}
    const successCoords = geo?.coords || null
    const geoError = geo?.error || null

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, error) {
          if (geoError) {
            error?.(geoError)
            return
          }
          if (successCoords) {
            success?.({
              coords: successCoords,
              timestamp: Date.now(),
            })
          }
        },
        watchPosition(success, error) {
          if (geoError) {
            error?.(geoError)
            return 1
          }
          if (successCoords) {
            success?.({
              coords: successCoords,
              timestamp: Date.now(),
            })
          }
          return 1
        },
        clearWatch() {},
      },
    })
  }, state)
}

test('trang chủ load store public từ cache override và hiển thị danh sách', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'home-store-1', name: 'Tạp Hóa Minh Anh' }),
      buildStore({ id: 'home-store-2', name: 'Cửa Hàng Giang', district: 'Quốc Oai', ward: 'Yên Sơn' }),
    ],
  })

  await page.goto('/')

  await expect(page.getByText('Tạp Hóa Minh Anh')).toBeVisible()
  await expect(page.getByText('Cửa Hàng Giang')).toBeVisible()
  await expect(page.getByText('Đang hiển thị')).toContainText('2')
})

test('tìm kiếm tiếng Việt không dấu vẫn khớp tên có dấu', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'search-vn-1', name: 'Tạp Hóa Minh Anh' }),
      buildStore({ id: 'search-vn-2', name: 'Quán Ăn Lan Chi' }),
    ],
  })

  await page.goto('/')
  await page.getByPlaceholder('VD: Tạp Hóa Minh Anh').fill('tap hoa minh anh')

  await expect(page.getByText('Tạp Hóa Minh Anh')).toBeVisible()
  await expect(page.getByText('Quán Ăn Lan Chi')).not.toBeVisible()
  await expect(page.getByText('Tìm thấy')).toContainText('1')
})

test('search và filter sync lên URL rồi khôi phục lại state từ route', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'sync-1', name: 'Tạp Hóa Minh Anh', district: 'Hoài Đức', ward: 'An Khánh' }),
      buildStore({ id: 'sync-2', name: 'Quán Ăn Lan Chi', district: 'Quốc Oai', ward: 'Yên Sơn' }),
    ],
  })

  await page.goto('/')
  await page.getByPlaceholder('VD: Tạp Hóa Minh Anh').fill('minh')
  await page.getByRole('button', { name: 'Mở bộ lọc chi tiết' }).click()
  const filterPanel = page.locator('#search-detail-filters')
  await filterPanel.locator('select').nth(0).selectOption('Hoài Đức')
  await filterPanel.locator('select').nth(1).selectOption('An Khánh')

  await page.waitForURL((url) => {
    return url.searchParams.get('q') === 'minh'
      && url.searchParams.get('district') === 'Hoài Đức'
      && url.searchParams.get('ward') === 'An Khánh'
  })

  await page.reload()

  await expect(page.getByPlaceholder('VD: Tạp Hóa Minh Anh')).toHaveValue('minh')
  await expect(page.locator('#search-detail-filters select').nth(0)).toHaveValue('Hoài Đức')
  await expect(page.locator('#search-detail-filters select').nth(1)).toHaveValue('An Khánh')
  await expect(page.getByText('Tạp Hóa Minh Anh')).toBeVisible()
  await expect(page.getByText('Quán Ăn Lan Chi')).not.toBeVisible()
})

test('mở detail modal từ search result vẫn hiển thị đúng thông tin cửa hàng', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({
        id: 'detail-open-1',
        name: 'Tạp Hóa Mở Modal',
        address_detail: 'Đội 3',
        note: 'Gần cổng trường',
      }),
    ],
  })

  await page.goto('/')
  await page.getByRole('button', { name: /Tạp Hóa Mở Modal/i }).click()

  const detailModal = page.getByRole('dialog')
  await expect(detailModal.getByText('Thông tin cửa hàng')).toBeVisible()
  await expect(detailModal.getByText('Đội 3')).toBeVisible()
  await expect(detailModal.getByText('Gần cổng trường')).toBeVisible()
})
