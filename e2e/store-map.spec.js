const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-23T14:00:00.000Z'
const MAP_ROUTE_STORAGE_KEY = 'storevis:map-route-plan'
const FIXED_ROUTE_POINT = {
  lat: 21.0774332,
  lng: 105.6951599,
}

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'map-store-1',
    name: overrides.name || 'Cửa hàng Bản đồ',
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
    auth: { role: 'guest' },
    geolocation: {
      coords: {
        latitude: 21.02851,
        longitude: 105.80482,
        accuracy: 5,
      },
      heading: 42,
      delayMs: 0,
    },
    stores: [
      buildStore(),
    ],
    ...overrides,
  }
}

async function setupMapPage(page, overrides = {}) {
  const state = createE2EState(overrides)
  const routePlan = overrides.routePlan || { routeStopIds: [], hideUnselectedStores: false }
  const routeApi = overrides.routeApi || {}

  if (overrides.forceCanvas2dFailure) {
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
        if (type === '2d') return null
        return originalGetContext.call(this, type, ...args)
      }
    })
  }

  await page.addInitScript(({ value, storageKey, savedRoutePlan }) => {
    window.__STOREVIS_E2E__ = value
    window.localStorage.setItem(storageKey, JSON.stringify(savedRoutePlan))
  }, {
    value: state,
    storageKey: MAP_ROUTE_STORAGE_KEY,
    savedRoutePlan: routePlan,
  })

  await page.route('**/api/route', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}')
    const stops = Array.isArray(payload?.stops) ? payload.stops : []
    if (payload?.mode === 'optimize') {
      if (routeApi.optimizeError) {
        await route.fulfill({
          status: routeApi.optimizeStatus || 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: routeApi.optimizeError }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderedStopIds: routeApi.orderedStopIds || stops.map((stop) => String(stop.id)),
        }),
      })
      return
    }

    if (routeApi.buildError) {
      await route.fulfill({
        status: routeApi.buildStatus || 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: routeApi.buildError }),
      })
      return
    }

    const coordinates = [
      [FIXED_ROUTE_POINT.lng, FIXED_ROUTE_POINT.lat],
      ...stops.map((stop) => [stop.lng, stop.lat]),
      [FIXED_ROUTE_POINT.lng, FIXED_ROUTE_POINT.lat],
    ]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: {
          type: 'LineString',
          coordinates,
        },
        distance: routeApi.distance || 1800,
        duration: routeApi.duration || 420,
        orderedStopIds: stops.map((stop) => String(stop.id)),
      }),
    })
  })

  await page.goto('/map')
  await expect(page.getByPlaceholder('Tìm cửa hàng...')).toBeVisible()
  await expect(page.getByText('Đang tải bản đồ…')).toBeHidden()
}

async function expectGeoCallCount(page, expectedCount) {
  await expect.poll(async () => {
    return page.evaluate(() => window.__STOREVIS_E2E__?.geolocation?.callCount || 0)
  }).toBe(expectedCount)
}

async function resetMapCameraEvents(page) {
  await page.evaluate(() => {
    if (!window.__STOREVIS_E2E__) return
    if (!window.__STOREVIS_E2E__.map || typeof window.__STOREVIS_E2E__.map !== 'object') {
      window.__STOREVIS_E2E__.map = {}
    }
    window.__STOREVIS_E2E__.map.cameraEvents = []
  })
}

async function getMapCameraEvents(page) {
  return page.evaluate(() => window.__STOREVIS_E2E__?.map?.cameraEvents || [])
}

async function dragRouteItem(page, itemName, targetName) {
  const sourceButton = page.locator(`button[aria-label*="${itemName}"]`).first()
  const targetButton = page.locator(`button[aria-label*="${targetName}"]`).first()
  const sourceCard = sourceButton.locator('xpath=ancestor::div[contains(@class,"rounded-lg border bg-slate-900/75")]').first()
  const targetCard = targetButton.locator('xpath=ancestor::div[contains(@class,"rounded-lg border bg-slate-900/75")]').first()

  const sourceBox = await sourceCard.boundingBox()
  const targetBox = await targetCard.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('Không lấy được vị trí phần tử drag route trong test.')
  }

  await page.mouse.move(sourceBox.x + (sourceBox.width / 2), sourceBox.y + (sourceBox.height / 2))
  await page.mouse.down()
  await page.waitForTimeout(260)
  await page.mouse.move(targetBox.x + (targetBox.width / 2), targetBox.y + (targetBox.height * 0.8), { steps: 8 })
  await page.mouse.up()
}

async function openRoutePanel(page) {
  await page.getByRole('button', { name: 'Tuyến đường' }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: /Ẩn bảng tuyến đường/i })).toBeVisible()
}

async function getRouteItemLabels(page) {
  return page.locator('button[aria-label^="Loại bỏ cửa hàng"]').evaluateAll((buttons) => {
    return buttons.map((button) => button.getAttribute('aria-label'))
  })
}

test('desktop /map ẩn loading overlay sau khi bản đồ đã sẵn sàng', async ({ page }) => {
  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'desktop-map-store-1', name: 'Tạp hóa Desktop 1' }),
      buildStore({ id: 'desktop-map-store-2', name: 'Tạp hóa Desktop 2', latitude: 21.02911, longitude: 105.80511 }),
    ],
  })

  await expect(page.getByText('Bộ lọc khu vực')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tuyến đường' })).toBeVisible()
})

test('desktop /map vẫn tắt loading overlay khi canvas asset marker bị lỗi', async ({ page }) => {
  await setupMapPage(page, {
    forceCanvas2dFailure: true,
    stores: [
      buildStore({ id: 'desktop-map-store-1', name: 'Tạp hóa Desktop 1' }),
      buildStore({ id: 'desktop-map-store-2', name: 'Tạp hóa Desktop 2', latitude: 21.02911, longitude: 105.80511 }),
    ],
  })

  await expect(page.getByText('Bộ lọc khu vực')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tuyến đường' })).toBeVisible()
})

test('lọc quận xã trên map giữ đúng rule: quận không có xã chọn thì hiện cả quận, có xã chọn thì chỉ hiện xã đó', async ({ page }) => {
  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'store-1', name: 'Tạp hóa An Khánh', district: 'Hoài Đức', ward: 'An Khánh' }),
      buildStore({ id: 'store-2', name: 'Tạp hóa An Thượng', district: 'Hoài Đức', ward: 'An Thượng', latitude: 21.02911, longitude: 105.80511 }),
      buildStore({ id: 'store-3', name: 'Tạp hóa Yên Sơn', district: 'Quốc Oai', ward: 'Yên Sơn', latitude: 21.03851, longitude: 105.78582 }),
      buildStore({ id: 'store-4', name: 'Tạp hóa Sài Sơn', district: 'Quốc Oai', ward: 'Sài Sơn', latitude: 21.04211, longitude: 105.78241 }),
    ],
  })

  await expect(page.getByText('Hiển thị 4 / 4 cửa hàng')).toBeVisible()

  await page.getByRole('button', { name: /Hoài Đức/ }).click()
  await expect(page.getByText('Hiển thị 2 / 4 cửa hàng')).toBeVisible()

  await page.getByRole('button', { name: /An Khánh/ }).click()
  await expect(page.getByText('Hiển thị 1 / 4 cửa hàng')).toBeVisible()

  await page.getByRole('button', { name: /Quốc Oai/ }).click()
  await expect(page.getByText('Hiển thị 3 / 4 cửa hàng')).toBeVisible()
})

test('bật dẫn đường vẫn vào chế độ bám vị trí khi lần lấy GPS đầu trang còn đang chạy', async ({ page }) => {
  await setupMapPage(page, {
    geolocation: {
      coords: {
        latitude: 21.02851,
        longitude: 105.80482,
        accuracy: 5,
      },
      heading: 42,
      delayMs: 1200,
    },
    stores: [
      buildStore({ id: 'route-store-1', name: 'Cửa hàng Tuyến 1' }),
    ],
    routePlan: {
      routeStopIds: ['route-store-1'],
      hideUnselectedStores: false,
    },
  })

  await expectGeoCallCount(page, 1)
  await expect(page.getByRole('button', { name: 'Bật dẫn đường' })).toBeVisible()

  await page.getByRole('button', { name: 'Bật dẫn đường' }).click()

  await expect(page.getByText('Dẫn đường')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thoát' })).toBeVisible()
  await expect(page.getByText('Không lấy được hướng hiện tại của thiết bị.')).toHaveCount(0)
  await expectGeoCallCount(page, 1)
})

test('bật dẫn đường khi chưa có tuyến vẽ sẵn vẫn giữ camera bám vị trí người dùng, không fit toàn tuyến', async ({ page }) => {
  await setupMapPage(page, {
    geolocation: {
      coords: {
        latitude: 21.02851,
        longitude: 105.80482,
        accuracy: 5,
      },
      heading: 42,
      delayMs: 0,
    },
    stores: [
      buildStore({ id: 'route-store-1', name: 'Cửa hàng Tuyến 1' }),
    ],
    routePlan: {
      routeStopIds: ['route-store-1'],
      hideUnselectedStores: false,
    },
  })

  await resetMapCameraEvents(page)
  await page.getByRole('button', { name: 'Bật dẫn đường' }).click()

  await expect(page.getByText('Dẫn đường')).toBeVisible()

  await expect.poll(() => getMapCameraEvents(page)).toEqual([
    {
      source: 'follow-user-heading',
      type: 'easeTo',
      center: [105.80482, 21.02851],
      bearing: 42,
    },
  ])

  await page.getByRole('button', { name: 'Thoát' }).click()
  await openRoutePanel(page)
  await expect(page.getByText('Đã vẽ tuyến theo đường thật')).toBeVisible()
  await expect(page.getByText('1.8 km • 7 phút')).toBeVisible()
})

test('search suggestion trên map chỉ hiện store có tọa độ hợp lệ và có thể thêm vào tuyến', async ({ page }) => {
  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'valid-store', name: 'Tạp hóa Hợp Lệ' }),
      buildStore({ id: 'invalid-store', name: 'Tạp hóa Không Vị Trí', latitude: null, longitude: null }),
    ],
  })

  await page.getByPlaceholder('Tìm cửa hàng...').fill('Tạp hóa')
  await expect(page.getByText('Tạp hóa Hợp Lệ')).toBeVisible()
  await expect(page.getByText('Tạp hóa Không Vị Trí')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Thêm' })).toHaveCount(1)

  await page.getByRole('button', { name: 'Thêm' }).click()
  await openRoutePanel(page)
  await expect(page.getByRole('button', { name: 'Loại bỏ cửa hàng Tạp hóa Hợp Lệ khỏi tuyến' })).toBeVisible()
})

test('search trên map dùng cùng thứ tự ưu tiên với màn tìm kiếm khi bấm Enter', async ({ page }) => {
  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'weak-match', name: 'Tạp hóa Minh', created_at: '2026-04-20T02:00:00.000Z' }),
      buildStore({ id: 'strong-match', name: 'Tạp hóa Minh Anh', created_at: '2026-04-19T02:00:00.000Z', latitude: 21.02911, longitude: 105.80511 }),
      buildStore({ id: 'newest-strong-match', name: 'Minh Anh Số 3', created_at: '2026-04-21T02:00:00.000Z', latitude: 21.02951, longitude: 105.80551 }),
    ],
  })

  const searchInput = page.getByPlaceholder('Tìm cửa hàng...')
  await searchInput.fill('minh anh')

  const suggestionButtons = page.locator('div.max-h-64 button.min-w-0.flex-1.text-left')
  await expect(suggestionButtons).toHaveCount(3)
  await expect(suggestionButtons.nth(0)).toContainText('Minh Anh Số 3')
  await expect(suggestionButtons.nth(1)).toContainText('Tạp hóa Minh Anh')
  await expect(suggestionButtons.nth(2)).toContainText('Tạp hóa Minh')

  await searchInput.press('Enter')
  await expect(searchInput).toHaveValue('Minh Anh Số 3')
})

test('vẽ tuyến trên map hiển thị summary sau khi build thành công', async ({ page }) => {
  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'route-store-1', name: 'Cửa hàng Tuyến 1' }),
    ],
    routePlan: {
      routeStopIds: ['route-store-1'],
      hideUnselectedStores: false,
    },
  })

  await openRoutePanel(page)
  await page.getByRole('button', { name: 'Vẽ' }).click()
  await openRoutePanel(page)

  await expect(page.getByText('Đã vẽ tuyến theo đường thật')).toBeVisible()
  await expect(page.getByText('1.8 km • 7 phút')).toBeVisible()
})

test('sắp xếp tuyến áp đúng thứ tự API trả về', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())

  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'route-store-1', name: 'Điểm 1' }),
      buildStore({ id: 'route-store-2', name: 'Điểm 2', latitude: 21.03011, longitude: 105.80541 }),
      buildStore({ id: 'route-store-3', name: 'Điểm 3', latitude: 21.03211, longitude: 105.80641 }),
    ],
    routePlan: {
      routeStopIds: ['route-store-1', 'route-store-2', 'route-store-3'],
      hideUnselectedStores: false,
    },
    routeApi: {
      orderedStopIds: ['route-store-3', 'route-store-1', 'route-store-2'],
    },
  })

  await openRoutePanel(page)
  await expect(getRouteItemLabels(page)).resolves.toEqual([
    'Loại bỏ cửa hàng Điểm 1 khỏi tuyến',
    'Loại bỏ cửa hàng Điểm 2 khỏi tuyến',
    'Loại bỏ cửa hàng Điểm 3 khỏi tuyến',
  ])

  await page.getByRole('button', { name: 'Sắp xếp' }).click()
  await expect.poll(() => getRouteItemLabels(page)).toEqual([
    'Loại bỏ cửa hàng Điểm 3 khỏi tuyến',
    'Loại bỏ cửa hàng Điểm 1 khỏi tuyến',
    'Loại bỏ cửa hàng Điểm 2 khỏi tuyến',
  ])
})

test('build route lỗi vẫn hiện đúng thông báo lỗi trong panel tuyến đường', async ({ page }) => {
  await setupMapPage(page, {
    stores: [
      buildStore({ id: 'route-store-1', name: 'Điểm lỗi tuyến' }),
    ],
    routePlan: {
      routeStopIds: ['route-store-1'],
      hideUnselectedStores: false,
    },
    routeApi: {
      buildError: 'Không lấy được tuyến thử nghiệm',
    },
  })

  await openRoutePanel(page)
  await page.getByRole('button', { name: 'Vẽ' }).click()
  await openRoutePanel(page)

  await expect(page.getByText('Không lấy được tuyến thử nghiệm')).toBeVisible()
})
