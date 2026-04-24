const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-23T14:00:00.000Z'
const MAP_ROUTE_STORAGE_KEY = 'storevis:map-route-plan'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'map-store-1',
    name: overrides.name || 'drag-1',
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

async function setupMapPage(page) {
  await page.addInitScript(({ storageKey, stores }) => {
    window.__STOREVIS_E2E__ = {
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
      stores,
    }

    window.localStorage.setItem(storageKey, JSON.stringify({
      routeStopIds: ['drag-1', 'drag-2', 'drag-3'],
      hideUnselectedStores: false,
    }))
  }, {
    storageKey: MAP_ROUTE_STORAGE_KEY,
    stores: [
      buildStore({ id: 'drag-1', name: 'drag-1' }),
      buildStore({ id: 'drag-2', name: 'drag-2', latitude: 21.03011, longitude: 105.80541 }),
      buildStore({ id: 'drag-3', name: 'drag-3', latitude: 21.03211, longitude: 105.80641 }),
    ],
  })

  await page.goto('/map')
  await expect(page.getByPlaceholder('Tìm cửa hàng...')).toBeVisible()
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

test('kéo thả tuyến đổi đúng thứ tự cửa hàng trong panel', async ({ page }) => {
  await setupMapPage(page)
  await openRoutePanel(page)

  await expect(getRouteItemLabels(page)).resolves.toEqual([
    'Loại bỏ cửa hàng drag-1 khỏi tuyến',
    'Loại bỏ cửa hàng drag-2 khỏi tuyến',
    'Loại bỏ cửa hàng drag-3 khỏi tuyến',
  ])

  await dragRouteItem(page, 'drag-1', 'drag-3')

  await expect.poll(() => getRouteItemLabels(page)).toEqual([
    'Loại bỏ cửa hàng drag-2 khỏi tuyến',
    'Loại bỏ cửa hàng drag-3 khỏi tuyến',
    'Loại bỏ cửa hàng drag-1 khỏi tuyến',
  ])
})
