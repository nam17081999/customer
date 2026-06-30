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

/**
 * Wait for search results to appear.
 * On desktop viewport both mobile and desktop sections render "Đang hiển thị";
 * use `.first()` to avoid strict-mode violation.
 */
async function waitSearchReady(page, expectedCount = '1') {
  await expect(page.getByText('Đang hiển thị').first()).toContainText(expectedCount)
}

/**
 * On desktop viewport both mobile (hidden) and desktop (visible) sections
 * render the same store names. `.first()` is hidden, so `.last()` targets
 * the visible desktop list.
 */
function visibleText(page, text) {
  return page.getByText(text).last()
}

/**
 * Desktop search input placeholder (used on ≥640px viewport).
 * The mobile input with placeholder 'VD: Tạp Hóa Minh Anh' is sm:hidden on desktop.
 */
function desktopInput(page) {
  return page.getByPlaceholder('Tìm theo tên cửa hàng, ví dụ: Tạp Hóa Minh Anh')
}

// ──────────────────────────────── Tests ────────────────────────────────

test('trang chủ load store public từ cache override và hiển thị danh sách', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'home-store-1', name: 'Tạp Hóa Minh Anh' }),
      buildStore({ id: 'home-store-2', name: 'Cửa Hàng Giang', district: 'Quốc Oai', ward: 'Yên Sơn' }),
    ],
  })

  await page.goto('/')

  await expect(visibleText(page, 'Tạp Hóa Minh Anh')).toBeVisible()
  await expect(visibleText(page, 'Cửa Hàng Giang')).toBeVisible()
  await expect(page.getByText('Đang hiển thị').first()).toContainText('2')
})

test('tìm kiếm tiếng Việt không dấu vẫn khớp tên có dấu', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'search-vn-1', name: 'Tạp Hóa Minh Anh' }),
      buildStore({ id: 'search-vn-2', name: 'Quán Ăn Lan Chi' }),
    ],
  })

  await page.goto('/')
  await desktopInput(page).fill('tap hoa minh anh')

  await expect(visibleText(page, 'Tạp Hóa Minh Anh')).toBeVisible()
  await expect(visibleText(page, 'Quán Ăn Lan Chi')).not.toBeVisible()
  await expect(page.getByText('Tìm thấy').first()).toContainText('1')
})

test('CTA tạo cửa hàng hiện khi query có 2 từ và không trùng tên 100%', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'cta-near-1', name: 'Tạp Hóa Minh Anh' }),
    ],
  })

  await page.goto('/')
  await waitSearchReady(page)
  await desktopInput(page).fill('Minh Anh')

  await expect(visibleText(page, 'Tạp Hóa Minh Anh')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tạo cửa hàng/ }).last()).toBeVisible()
})

test('CTA tạo cửa hàng ẩn khi query 1 từ hoặc trùng tên 100%', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'cta-exact-1', name: 'Tạp Hóa Minh Anh' }),
    ],
  })

  await page.goto('/')
  await waitSearchReady(page)
  await desktopInput(page).fill('Minh')
  await expect(page.getByRole('button', { name: /Tạo cửa hàng/ })).toHaveCount(0)

  await desktopInput(page).fill('tap hoa   minh anh')
  await expect(visibleText(page, 'Tạp Hóa Minh Anh')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tạo cửa hàng/ })).toHaveCount(0)
})

test('click CTA tạo cửa hàng sang thẳng bước 2 và browser back-forward giữ đúng màn', async ({ page }) => {
  await setupSearchFlow(page, {
    stores: [
      buildStore({ id: 'cta-click-1', name: 'Tạp Hóa Minh Anh' }),
    ],
  })

  await page.goto('/')
  await waitSearchReady(page)
  await desktopInput(page).fill('Minh Anh')
  await page.getByRole('button', { name: /Tạo cửa hàng/ }).last().click()

  await expect.poll(() => {
    const currentUrl = new URL(page.url())
    return {
      pathname: currentUrl.pathname,
      name: currentUrl.searchParams.get('name'),
      step: currentUrl.searchParams.get('step'),
    }
  }).toEqual({
    pathname: '/store/create',
    name: 'Minh Anh',
    step: '2',
  })
  await expect(page.getByText('Quận / Huyện')).toBeVisible()
  await expect(page.getByLabel('Tên cửa hàng')).not.toBeVisible()

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Bạn có thay đổi chưa lưu')
    await dialog.accept()
  })
  await page.goBack()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  await expect(desktopInput(page)).toHaveValue('Minh Anh')

  await page.goForward()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/store/create')
  await expect(page.getByText('Quận / Huyện')).toBeVisible()
})

test('search và filter sync lên URL rồi khôi phục lại state từ route', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
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

  await expect.poll(() => {
    const currentUrl = new URL(page.url())
    return {
      q: currentUrl.searchParams.get('q'),
      district: currentUrl.searchParams.get('district'),
      ward: currentUrl.searchParams.get('ward'),
    }
  }).toEqual({
    q: 'minh',
    district: 'Hoài Đức',
    ward: 'An Khánh',
  })

  await page.reload()

  await expect(page.getByPlaceholder('VD: Tạp Hóa Minh Anh')).toHaveValue('minh')
  await expect(page.locator('#search-detail-filters select').nth(0)).toHaveValue('Hoài Đức')
  await expect(page.locator('#search-detail-filters select').nth(1)).toHaveValue('An Khánh')
  await expect(page.getByText('Tạp Hóa Minh Anh').first()).toBeVisible()
  await expect(page.getByText('Quán Ăn Lan Chi').first()).not.toBeVisible()
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
  await page.getByRole('button', { name: /Tạp Hóa Mở Modal/i }).first().click()

  const detailModal = page.getByRole('dialog')
  await expect(detailModal.getByText('Tạp Hóa Mở Modal').last()).toBeVisible()
  await expect(detailModal.getByText('Đội 3')).toBeVisible()
  await expect(detailModal.getByText('Gần cổng trường')).toBeVisible()
})
