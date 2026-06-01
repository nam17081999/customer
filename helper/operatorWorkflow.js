const RECENT_ROUTE_LIMIT = 6

export const OPERATOR_QUICK_ACTIONS = [
  { key: 'new-order', label: 'Lên đơn', href: '/orders/new', shortcut: 'Alt+1' },
  { key: 'orders', label: 'Đơn hàng', href: '/orders', shortcut: 'Alt+2' },
  { key: 'products', label: 'Hàng hóa', href: '/inventory/products', shortcut: 'Alt+3' },
  { key: 'stock', label: 'Tồn kho', href: '/inventory/stock', shortcut: 'Alt+4' },
  { key: 'reports', label: 'Thống kê', href: '/inventory/reports', shortcut: 'Alt+5' },
  { key: 'customers', label: 'Khách hàng', href: '/', shortcut: 'Alt+6' },
]

export function getOperatorShortcutHref(event) {
  if (!event?.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return ''
  const key = String(event.key || '').trim()
  const action = OPERATOR_QUICK_ACTIONS.find((item) => item.shortcut.endsWith(key))
  return action?.href || ''
}

export function normalizeRecentRoute(route = {}) {
  const href = String(route.href || '').trim()
  if (!href.startsWith('/')) return null
  return {
    href,
    label: String(route.label || href).trim() || href,
    visitedAt: route.visitedAt || new Date().toISOString(),
  }
}

export function addRecentRoute(routes = [], route = {}) {
  const nextRoute = normalizeRecentRoute(route)
  if (!nextRoute) return Array.isArray(routes) ? routes.slice(0, RECENT_ROUTE_LIMIT) : []
  const deduped = (Array.isArray(routes) ? routes : []).filter((item) => item?.href !== nextRoute.href)
  return [nextRoute, ...deduped].slice(0, RECENT_ROUTE_LIMIT)
}

export function mergeSalesOrderLine(items = [], nextLine = {}) {
  const productId = String(nextLine.productId || '').trim()
  const productUnitId = String(nextLine.productUnitId || '').trim()
  if (!productId || !productUnitId) return { items, merged: false, index: -1 }

  const currentItems = Array.isArray(items) ? items : []
  const existingIndex = currentItems.findIndex((item) => (
    String(item?.productId || '') === productId && String(item?.productUnitId || '') === productUnitId
  ))

  if (existingIndex === -1) {
    return { items: [...currentItems, nextLine], merged: false, index: currentItems.length }
  }

  const mergedItems = currentItems.map((item, index) => {
    if (index !== existingIndex) return item
    const currentQty = Number(String(item.quantity || '0').replaceAll(',', '.')) || 0
    const nextQty = Number(String(nextLine.quantity || '0').replaceAll(',', '.')) || 0
    return { ...item, quantity: String(currentQty + nextQty) }
  })

  return { items: mergedItems, merged: true, index: existingIndex }
}

export function getRecentProductsFromOrderDrafts(drafts = [], productsById = new Map(), limit = 8) {
  const productIds = []
  for (const draft of Array.isArray(drafts) ? drafts : []) {
    for (const item of Array.isArray(draft?.items) ? draft.items : []) {
      const productId = String(item?.productId || '').trim()
      if (productId && !productIds.includes(productId)) productIds.push(productId)
    }
  }

  return productIds
    .map((productId) => productsById.get(productId))
    .filter(Boolean)
    .slice(0, limit)
}

export function buildDashboardHealthSummary({ products = [], reconciliationRows = [], orders = [], purchases = [] } = {}) {
  const lowStockCount = products.filter((product) => Number(product.onHandBaseQty || 0) <= Number(product.min_stock_base_qty || 0)).length
  const reconciliationIssueCount = reconciliationRows.filter((row) => (row.issue_codes || []).length > 0).length
  const activeOrders = orders.filter((order) => order.status !== 'cancelled')
  const activePurchases = purchases.filter((order) => !order.cancelled_at)
  return {
    lowStockCount,
    reconciliationIssueCount,
    activeOrderCount: activeOrders.length,
    activePurchaseCount: activePurchases.length,
    revenue: activeOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    profit: activeOrders.reduce((sum, order) => sum + Number(order.gross_profit_amount || 0), 0),
    purchaseAmount: activePurchases.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    needsAttention: lowStockCount > 0 || reconciliationIssueCount > 0,
  }
}
