function hasText(value) {
  return String(value || '').trim().length > 0
}

function storeLabel(store) {
  return [store?.name, store?.ward, store?.district].filter(Boolean).join(' - ')
}

export function hasDetailCoordinates(store) {
  if (!hasText(store?.latitude) || !hasText(store?.longitude)) return false
  const lat = Number(store.latitude)
  const lng = Number(store.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function buildStoreDetailBadges(store = {}) {
  const badges = []

  if (store.active !== true) {
    badges.push({ key: 'unverified', label: 'Chưa xác thực', tone: 'warning' })
  }
  if (!hasText(store.phone) && !hasText(store.phone_secondary)) {
    badges.push({ key: 'missing-phone', label: 'Thiếu SĐT', tone: 'warning' })
  }
  if (!hasDetailCoordinates(store)) {
    badges.push({ key: 'missing-location', label: 'Thiếu vị trí', tone: 'warning' })
  }

  return badges
}

export function buildStoreDetailActionModel({
  store = {},
  isAdmin = false,
  isMapPage = false,
  hasRouteAction = false,
  isInRoute = false,
  from = '/',
} = {}) {
  const storeId = store?.id
  const hasCoords = hasDetailCoordinates(store)
  const encodedFrom = encodeURIComponent(from || '/')
  const actions = []

  if (hasCoords && !isMapPage) {
    actions.push({ key: 'open-map', label: 'Bản đồ', href: `/map?storeId=${storeId}&lat=${store.latitude}&lng=${store.longitude}` })
  }
  if (hasRouteAction) {
    actions.push({ key: isInRoute ? 'remove-route' : 'add-route', label: isInRoute ? 'Bỏ tuyến' : 'Thêm tuyến' })
  }

  if (isAdmin) {
    actions.push({ key: 'quick-order', label: 'Lên đơn', href: `/orders/new?storeId=${storeId}&from=${encodedFrom}` })
    actions.push({ key: 'edit', label: 'Sửa', href: `/store/edit/${storeId}` })
    actions.push({ key: 'history', label: 'Lịch sử', href: `/store/history/${storeId}?from=${encodedFrom}` })
    actions.push({ key: 'report', label: 'Báo cáo', href: `/store/report/${storeId}?from=${encodedFrom}` })
    actions.push({ key: 'delete', label: 'Xóa' })
  } else {
    actions.push({ key: 'supplement', label: 'Bổ sung', href: `/store/edit/${storeId}?mode=supplement` })
    actions.push({ key: 'report', label: 'Báo cáo', href: `/store/report/${storeId}?from=${encodedFrom}` })
  }

  return { hasCoords, actions }
}

export function resolveQuickOrderCustomerSelection({
  stores = [],
  queryStoreId,
  currentCustomerStoreId,
} = {}) {
  if (currentCustomerStoreId || !queryStoreId || !Array.isArray(stores) || stores.length === 0) return null
  const store = stores.find((item) => String(item?.id) === String(queryStoreId))
  if (!store) return null
  return {
    customerStoreId: String(store.id),
    customerQuery: storeLabel(store),
  }
}
