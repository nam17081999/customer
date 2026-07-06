import { buildDashboardHealthSummary } from '@/helper/operatorWorkflow'

function buildStoreSummary(stores) {
  const totalStores = stores.length
  const verifiedStores = stores.filter(s => s.active === true).length
  const unverifiedStores = totalStores - verifiedStores
  const districtSet = new Set()
  const wardSet = new Set()
  const districtCountMap = {}
  let newestCreatedAt = null
  let last7DaysStores = 0
  const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000

  stores.forEach(s => {
    const d = (s.district || '').trim()
    if (d) { districtSet.add(d); districtCountMap[d] = (districtCountMap[d] || 0) + 1 }
    const w = (s.ward || '').trim()
    if (w) wardSet.add(w)
    const t = new Date(s.created_at || '').getTime()
    if (!Number.isNaN(t)) {
      if (!newestCreatedAt || t > newestCreatedAt) newestCreatedAt = t
      if (t >= threshold) last7DaysStores += 1
    }
  })

  const districtRows = Object.entries(districtCountMap)
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0], 'vi')))
    .map(([district, count]) => ({ district, count }))
  const topDistrictCount = districtRows[0]?.count || 1
  const verificationRate = totalStores === 0 ? 0 : Math.round((verifiedStores / totalStores) * 100)

  return {
    totalStores, verifiedStores, unverifiedStores,
    districtRows, topDistrictCount,
    districtCount: districtSet.size, wardCount: wardSet.size,
    last7DaysStores, newestCreatedAt: newestCreatedAt ? new Date(newestCreatedAt).toISOString() : null,
    verificationRate,
  }
}

function buildHealthMetrics(aggregateReport, fallbackHealth, reconciliationRows) {
  if (!aggregateReport) return fallbackHealth
  const sales = aggregateReport.sales || {}
  const purchasesSummary = aggregateReport.purchases || {}
  const inventory = aggregateReport.inventory || {}
  const reconciliationIssueCount = reconciliationRows.filter(r => (r.issue_codes || []).length > 0).length
  return {
    ...fallbackHealth,
    lowStockCount: Number(inventory.low_stock_count ?? fallbackHealth.lowStockCount),
    reconciliationIssueCount,
    activeOrderCount: Number(sales.order_count ?? fallbackHealth.activeOrderCount),
    activePurchaseCount: Number(purchasesSummary.purchase_count ?? fallbackHealth.activePurchaseCount),
    revenue: Number(sales.revenue ?? fallbackHealth.revenue),
    profit: Number(sales.profit ?? fallbackHealth.profit),
    purchaseAmount: Number(purchasesSummary.purchase_amount ?? fallbackHealth.purchaseAmount),
    needsAttention: (Number(inventory.low_stock_count ?? fallbackHealth.lowStockCount) > 0) || reconciliationIssueCount > 0,
  }
}

export async function loadDashboardData(deps) {
  const { getStores, listProducts, listOrders, listPurchases, getReconciliation, getAggregate } = deps

  try {
    const [storeRows, productRows, orderRows, purchaseRows, reconciliationReport, dashboardAggregate] = await Promise.all([
      getStores(),
      listProducts(),
      listOrders(),
      listPurchases().then(r => r.orders || []),
      getReconciliation().catch(() => []),
      getAggregate().catch(() => null),
    ])

    const stores = storeRows || []
    const products = productRows || []
    const orders = orderRows || []
    const purchases = purchaseRows || []
    const reconciliationRows = reconciliationReport || []

    const summary = buildStoreSummary(stores)
    const fallbackHealth = buildDashboardHealthSummary({ products, reconciliationRows, orders, purchases })
    const health = buildHealthMetrics(dashboardAggregate, fallbackHealth, reconciliationRows)

    return {
      stores,
      products,
      orders,
      purchases,
      reconciliationRows,
      aggregateReport: dashboardAggregate,
      summary,
      health,
      loading: false,
      error: null,
    }
  } catch {
    return {
      stores: [], products: [], orders: [], purchases: [], reconciliationRows: [],
      aggregateReport: null, summary: null, health: null,
      loading: false,
      error: 'Không tải được dữ liệu tổng quan. Vui lòng thử lại.',
    }
  }
}
