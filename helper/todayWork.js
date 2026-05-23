function hasText(value) {
  return String(value || '').trim().length > 0
}

function getTime(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function isOlderThanDays(value, days, now = Date.now()) {
  if (!value) return true
  const time = getTime(value)
  if (!time) return true
  return now - time >= days * 24 * 60 * 60 * 1000
}

function getResultGapMinutes(store) {
  const calledAt = getTime(store?.last_called_at)
  if (!calledAt) return null
  const resultAt = getTime(store?.last_call_result_at)
  if (!resultAt) return null
  return Math.abs(resultAt - calledAt) / (60 * 1000)
}

function isResultStale(store) {
  const gapMinutes = getResultGapMinutes(store)
  if (gapMinutes == null) return Boolean(store?.last_called_at && !store?.last_call_result_at)
  return gapMinutes > 30
}

function getTelesalePriorityGroup(store) {
  if (!store?.last_called_at && !store?.last_call_result) return 0
  if (isResultStale(store)) return 1
  const result = store?.last_call_result
  if (result === 'goi_lai_sau') return 2
  if (result === 'khong_nghe' || result === 'khong_nghe_may') return 3
  if (result === 'con_hang' || result === 'quan_tam') return 4
  if (result === 'da_len_don' || result === 'da_bao_don') return 5
  return 6
}

function getTelesalePriorityTime(store) {
  const group = getTelesalePriorityGroup(store)
  if (group === 0) return getTime(store?.created_at || store?.updated_at)
  if (group === 1) return getTime(store?.last_called_at || store?.updated_at || store?.created_at)
  if (group === 5) return getTime(store?.last_order_reported_at || store?.last_call_result_at || store?.last_called_at)
  return getTime(store?.last_call_result_at || store?.last_called_at)
}

function compareTelesaleQueueStores(left, right) {
  const groupDelta = getTelesalePriorityGroup(left) - getTelesalePriorityGroup(right)
  if (groupDelta !== 0) return groupDelta
  return getTelesalePriorityTime(left) - getTelesalePriorityTime(right)
}

export function hasValidStoreCoordinates(store) {
  if (!hasText(store?.latitude) || !hasText(store?.longitude)) return false
  const lat = Number(store?.latitude)
  const lng = Number(store?.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function isTelesaleQueueCandidate(store, now = Date.now()) {
  if (!store?.is_potential || !hasText(store?.phone)) return false

  const result = store.last_call_result
  if (result === 'da_len_don' || result === 'da_bao_don') {
    return isOlderThanDays(store.last_order_reported_at || store.last_called_at, 3, now)
  }
  if (result === 'con_hang' || result === 'quan_tam') {
    return isOlderThanDays(store.last_call_result_at || store.last_called_at, 2, now)
  }
  return true
}

export function buildTodayWorkSummary({
  stores = [],
  pendingReports = 0,
  products = [],
  now = Date.now(),
  limit = 8,
} = {}) {
  const safeStores = Array.isArray(stores) ? stores : []
  const safeProducts = Array.isArray(products) ? products : []

  const pendingStores = safeStores.filter((store) => store?.active !== true)
  const missingLocationStores = safeStores.filter((store) => !hasValidStoreCoordinates(store))
  const missingPhoneStores = safeStores.filter((store) => !hasText(store?.phone))
  const telesaleQueueStores = safeStores
    .filter((store) => isTelesaleQueueCandidate(store, now))
    .sort(compareTelesaleQueueStores)
  const lowStockProducts = safeProducts.filter((product) => (
    Number(product?.onHandBaseQty || 0) <= Number(product?.min_stock_base_qty || 0)
  ))
  const outOfStockProducts = safeProducts.filter((product) => Number(product?.onHandBaseQty || 0) <= 0)

  const counts = {
    pendingStores: pendingStores.length,
    pendingReports: typeof pendingReports === 'number' ? pendingReports : 0,
    missingLocation: missingLocationStores.length,
    missingPhone: missingPhoneStores.length,
    telesaleQueue: telesaleQueueStores.length,
    lowStock: lowStockProducts.length,
    outOfStock: outOfStockProducts.length,
  }

  return {
    counts,
    adminCards: [
      { key: 'pending-stores', label: 'Chờ duyệt', count: counts.pendingStores, href: '/store/verify' },
      { key: 'pending-reports', label: 'Báo cáo chờ xử lý', count: counts.pendingReports, href: '/store/reports' },
      { key: 'missing-location', label: 'Thiếu vị trí', count: counts.missingLocation, href: '/?flags=has_no_location' },
      { key: 'missing-phone', label: 'Thiếu SĐT', count: counts.missingPhone, href: '/today#missing-phone' },
      { key: 'low-stock', label: 'Hàng sắp hết', count: counts.lowStock, href: '/inventory/stock' },
    ],
    telesaleCards: [
      { key: 'telesale-queue', label: 'Cần gọi hôm nay', count: counts.telesaleQueue, href: '/telesale/overview' },
      { key: 'missing-phone', label: 'Thiếu SĐT', count: counts.missingPhone, href: '/today#missing-phone' },
      { key: 'missing-location', label: 'Thiếu vị trí', count: counts.missingLocation, href: '/?flags=has_no_location' },
    ],
    lists: {
      pendingStores: pendingStores.slice(0, limit),
      missingLocationStores: missingLocationStores.slice(0, limit),
      missingPhoneStores: missingPhoneStores.slice(0, limit),
      telesaleQueueStores: telesaleQueueStores.slice(0, limit),
      lowStockProducts: lowStockProducts.slice(0, limit),
      outOfStockProducts: outOfStockProducts.slice(0, limit),
    },
  }
}
