const { test, expect } = require('@playwright/test')

const BASE_TIMESTAMP = '2026-04-24T03:00:00.000Z'

function buildStore(overrides = {}) {
  return {
    id: overrides.id || 'report-store-1',
    name: overrides.name || 'Tạp hóa Báo Cáo',
    store_type: overrides.store_type || 'Tạp hóa',
    address_detail: overrides.address_detail || 'Xóm Chợ Cũ',
    ward: overrides.ward || 'An Khánh',
    district: overrides.district || 'Hoài Đức',
    phone: Object.prototype.hasOwnProperty.call(overrides, 'phone') ? overrides.phone : '0901234567',
    phone_secondary: overrides.phone_secondary || null,
    note: overrides.note || 'Gần cổng chợ',
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
    distance: overrides.distance,
  }
}

function createE2EState(overrides = {}) {
  return {
    auth: { role: 'guest' },
    geolocation: {
      coords: {
        latitude: 21.03333,
        longitude: 105.81111,
        accuracy: 5,
      },
      heading: 18,
    },
    stores: [buildStore()],
    ...overrides,
  }
}

async function setupReportFlow(page, overrides = {}) {
  const state = createE2EState(overrides)
  await page.addInitScript((value) => {
    window.__STOREVIS_E2E__ = value
  }, state)
}

test('nút báo cáo trong detail modal luôn chuyển sang route report riêng', async ({ page }) => {
  await setupReportFlow(page, {
    stores: [
      buildStore({
        id: 'report-route-1',
        name: 'Điểm Bán Điều Hướng Report',
        distance: 0.42,
      }),
    ],
  })

  await page.goto('/')
  await page.getByRole('button', { name: /Điểm Bán Điều Hướng Report/i }).click()

  const detailModal = page.getByRole('dialog')
  await expect(detailModal.getByText('Phản hồi')).toBeVisible()
  await detailModal.getByRole('button', { name: 'Báo cáo cửa hàng' }).click()

  await page.waitForURL('**/store/report/report-route-1?from=*')
  await expect(page.getByRole('heading', { name: 'Báo cáo cửa hàng' })).toBeVisible()
})

test('user gửi edit report với payload đã chuẩn hóa và tọa độ mới', async ({ page }) => {
  await setupReportFlow(page, {
    auth: { role: 'guest' },
    stores: [
      buildStore({
        id: 'report-edit-1',
        name: 'Tạp hóa cũ',
        address_detail: 'xóm chợ cũ',
        ward: 'an khánh',
        district: 'hoài đức',
        phone: '',
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
      body: JSON.stringify([{ id: 'report-created-1' }]),
    })
  })

  await page.goto('/store/report/report-edit-1?from=%2F')

  await expect(page.getByRole('heading', { name: 'Báo cáo cửa hàng' })).toBeVisible()
  await page.getByRole('button', { name: 'Sửa thông tin' }).click()

  await page.getByLabel('Tên cửa hàng').fill('tạp hóa minh anh')
  await page.getByLabel('Địa chỉ chi tiết').fill('xóm chợ mới')
  await page.getByLabel('Số điện thoại').fill('+84901234568')
  await page.getByLabel('Ghi chú').fill('mở từ 5 giờ sáng')
  await page.getByRole('button', { name: 'Lấy GPS' }).click()
  await page.getByRole('button', { name: 'Gửi báo cáo' }).click()

  await expect(page.getByText('Đã gửi báo cáo', { exact: true })).toBeVisible()
  expect(reportPayload).toMatchObject({
    store_id: 'report-edit-1',
    report_type: 'edit',
    reason_codes: null,
    reporter_id: null,
  })
  expect(reportPayload.proposed_changes).toMatchObject({
    name: 'Tạp Hóa Minh Anh',
    address_detail: 'Xóm Chợ Mới',
    phone: '0901234568',
    note: 'mở từ 5 giờ sáng',
    latitude: 21.03333,
    longitude: 105.81111,
  })
})

test('user gửi reason-only report không kèm proposed_changes', async ({ page }) => {
  await setupReportFlow(page, {
    stores: [buildStore({ id: 'report-reason-1' })],
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
      body: JSON.stringify([{ id: 'report-created-2' }]),
    })
  })

  await page.goto('/store/report/report-reason-1?from=%2F')
  await page.getByRole('button', { name: 'Chỉ báo cáo vấn đề' }).click()
  await page.getByRole('button', { name: 'Sai vị trí Chọn' }).click()
  await page.getByRole('button', { name: 'Sai số điện thoại Chọn' }).click()
  await page.getByRole('button', { name: 'Gửi báo cáo' }).click()

  await expect(page.getByText('Đã gửi báo cáo', { exact: true })).toBeVisible()
  expect(reportPayload).toMatchObject({
    store_id: 'report-reason-1',
    report_type: 'reason_only',
    proposed_changes: null,
  })
  expect(reportPayload.reason_codes).toEqual(['wrong_location', 'wrong_phone'])
})

test('user không thể gửi edit report với số điện thoại sai hoặc không có thay đổi', async ({ page }) => {
  await setupReportFlow(page, {
    stores: [buildStore({ id: 'report-guard-1', phone: '0901234567' })],
  })

  let submitCount = 0
  await page.route('**/rest/v1/store_reports*', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.continue()
      return
    }

    submitCount += 1
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'report-created-3' }]),
    })
  })

  await page.goto('/store/report/report-guard-1?from=%2F')
  await page.getByRole('button', { name: 'Sửa thông tin' }).click()
  await page.getByLabel('Số điện thoại').fill('123')
  await page.getByRole('button', { name: 'Gửi báo cáo' }).click()
  await expect(page.getByText('Số điện thoại chỉ được chứa chữ số và phải bắt đầu bằng 0, 84 hoặc +84.')).toBeVisible()
  expect(submitCount).toBe(0)

  await page.getByLabel('Số điện thoại').fill('0901234567')
  await page.getByRole('button', { name: 'Gửi báo cáo' }).click()
  await expect(page.getByText('Bạn chưa thay đổi thông tin nào.')).toBeVisible()
  expect(submitCount).toBe(0)
})

test('admin approve edit report cập nhật store rồi mới duyệt report', async ({ page }) => {
  await setupReportFlow(page, {
    auth: { role: 'admin' },
    stores: [
      buildStore({
        id: 'report-admin-store-1',
        name: 'Tạp hóa gốc',
        address_detail: 'Xóm Cũ',
      }),
    ],
  })

  const pendingReports = [
    {
      id: 'pending-edit-1',
      store_id: 'report-admin-store-1',
      report_type: 'edit',
      reason_codes: null,
      reason_note: null,
      proposed_changes: {
        name: 'Tạp hóa mới',
        address_detail: 'Xóm Mới',
        latitude: 21.04444,
        longitude: 105.82222,
      },
      status: 'pending',
      created_at: BASE_TIMESTAMP,
      store: buildStore({
        id: 'report-admin-store-1',
        name: 'Tạp hóa gốc',
        address_detail: 'Xóm Cũ',
      }),
    },
  ]

  const storePatchPayloads = []
  const reportPatchPayloads = []

  await page.route('**/rest/v1/store_reports*', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pendingReports),
      })
      return
    }

    if (request.method() === 'PATCH') {
      reportPatchPayloads.push(JSON.parse(request.postData() || '{}'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    await route.continue()
  })

  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()
    if (request.method() !== 'PATCH') {
      await route.continue()
      return
    }

    storePatchPayloads.push(JSON.parse(request.postData() || '{}'))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/store/reports')

  await expect(page.getByRole('heading', { name: 'Báo cáo cửa hàng' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tạp hóa gốc' })).toBeVisible()
  await page.getByRole('button', { name: 'Cập nhật' }).click()
  const confirmDialog = page.getByRole('dialog')
  await expect(confirmDialog.getByText('Duyệt và cập nhật cửa hàng theo đề xuất?')).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Xác nhận' }).click()

  await expect(page.getByText('Đã duyệt cập nhật cửa hàng.')).toBeVisible()
  expect(storePatchPayloads).toHaveLength(1)
  expect(storePatchPayloads[0]).toMatchObject({
    name: 'Tạp hóa mới',
    address_detail: 'Xóm Mới',
    latitude: 21.04444,
    longitude: 105.82222,
  })
  expect(reportPatchPayloads).toHaveLength(1)
  expect(reportPatchPayloads[0]).toMatchObject({
    status: 'approved',
  })
})

test('admin đánh dấu reason-only report không patch stores', async ({ page }) => {
  await setupReportFlow(page, {
    auth: { role: 'admin' },
    stores: [buildStore({ id: 'report-admin-store-2' })],
  })

  const pendingReports = [
    {
      id: 'pending-reason-1',
      store_id: 'report-admin-store-2',
      report_type: 'reason_only',
      reason_codes: ['wrong_location'],
      reason_note: null,
      proposed_changes: null,
      status: 'pending',
      created_at: BASE_TIMESTAMP,
      store: buildStore({ id: 'report-admin-store-2' }),
    },
  ]

  const storePatchPayloads = []
  const reportPatchPayloads = []

  await page.route('**/rest/v1/store_reports*', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pendingReports),
      })
      return
    }

    if (request.method() === 'PATCH') {
      reportPatchPayloads.push(JSON.parse(request.postData() || '{}'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    await route.continue()
  })

  await page.route('**/rest/v1/stores*', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      storePatchPayloads.push(JSON.parse(request.postData() || '{}'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
      return
    }

    await route.continue()
  })

  await page.goto('/store/reports')
  await page.getByRole('button', { name: 'Đã xử lý' }).click()
  const confirmDialog = page.getByRole('dialog')
  await expect(confirmDialog.getByText('Đánh dấu báo cáo này là đã xử lý?')).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Xác nhận' }).click()

  await expect(page.getByText('Đã đánh dấu báo cáo.')).toBeVisible()
  expect(storePatchPayloads).toHaveLength(0)
  expect(reportPatchPayloads).toHaveLength(1)
  expect(reportPatchPayloads[0]).toMatchObject({
    status: 'approved',
  })
})
