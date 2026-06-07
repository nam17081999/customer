import { normalizeOperatorError } from '@/helper/operatorErrors'

function normalizeServiceError(error, fallback) {
  return normalizeOperatorError(error, fallback)
}

async function defaultInventoryClient() {
  return import('@/api/inventory/inventory-client')
}

async function defaultStoreCache() {
  return import('@/lib/storeCache')
}

async function resolveDep(value, loader, key) {
  if (value) return value
  const loadedModule = await loader()
  return loadedModule[key]
}

export async function loadSalesOrderEntryData({ getStores = null, listProducts = null } = {}) {
  try {
    const [storesLoader, productsLoader] = await Promise.all([
      resolveDep(getStores, defaultStoreCache, 'getOrRefreshStores'),
      resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock'),
    ])
    const [stores, products] = await Promise.all([storesLoader(), productsLoader()])
    return { stores: stores || [], products: products || [] }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được dữ liệu lên đơn.')
  }
}

export async function submitSalesOrderFromForm(payload, { createSalesOrder = null } = {}) {
  try {
    const createOrder = await resolveDep(createSalesOrder, defaultInventoryClient, 'createSalesOrder')
    return await createOrder(payload)
  } catch (error) {
    throw normalizeServiceError(error, 'Không tạo được đơn hàng.')
  }
}

export async function loadPurchaseEntryData({ listProducts = null } = {}) {
  try {
    const productsLoader = await resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock')
    return { products: await productsLoader() }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được hàng hóa.')
  }
}

export async function submitPurchaseOrderFromForm(payload, { createPurchaseOrder = null } = {}) {
  try {
    const createOrder = await resolveDep(createPurchaseOrder, defaultInventoryClient, 'createPurchaseOrder')
    return await createOrder(payload)
  } catch (error) {
    throw normalizeServiceError(error, 'Không tạo được phiếu nhập.')
  }
}

export async function loadInventoryStockDashboard({
  listProducts = null,
  listMovements = null,
  getReconciliationReport = null,
} = {}) {
  try {
    const [productsLoader, movementsLoader, reconciliationLoader] = await Promise.all([
      resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock'),
      resolveDep(listMovements, defaultInventoryClient, 'listStockMovements'),
      resolveDep(getReconciliationReport, defaultInventoryClient, 'getInventoryReconciliationReport'),
    ])
    const [products, movements, reconciliation] = await Promise.all([
      productsLoader(),
      movementsLoader(200),
      reconciliationLoader(),
    ])
    return { products: products || [], movements: movements || [], reconciliation: reconciliation || [] }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được báo cáo tồn kho.')
  }
}

export async function runReconciliationCheckAndReload(userId, {
  runCheck = null,
  getReconciliationReport = null,
} = {}) {
  try {
    const [runChecker, reconciliationLoader] = await Promise.all([
      resolveDep(runCheck, defaultInventoryClient, 'runInventoryReconciliationCheck'),
      resolveDep(getReconciliationReport, defaultInventoryClient, 'getInventoryReconciliationReport'),
    ])
    const run = await runChecker(userId || null)
    const reconciliation = await reconciliationLoader()
    return { run, reconciliation: reconciliation || [] }
  } catch (error) {
    throw normalizeServiceError(error, 'Không kiểm tra đối soát tồn kho được.')
  }
}

export async function repairStockFromLedgerAndReload(userId, {
  repairStock = null,
  getReconciliationReport = null,
} = {}) {
  try {
    const [repairRunner, reconciliationLoader] = await Promise.all([
      resolveDep(repairStock, defaultInventoryClient, 'repairProductStockFromLedger'),
      resolveDep(getReconciliationReport, defaultInventoryClient, 'getInventoryReconciliationReport'),
    ])
    const repair = await repairRunner(userId || null)
    const reconciliation = await reconciliationLoader()
    return { repair, reconciliation: reconciliation || [] }
  } catch (error) {
    throw normalizeServiceError(error, 'Không sửa tồn theo ledger được.')
  }
}

export async function loadSalesReportData({ from = null, to = null } = {}, {
  getAggregate = null,
  listSalesRows = null,
  listProducts = null,
  getStores = null,
} = {}) {
  const fromValue = from?.toISOString?.() || from || null
  const toValue = to?.toISOString?.() || to || null
  try {
    const aggregateLoader = await resolveDep(getAggregate, defaultInventoryClient, 'getDashboardAggregateReport')
    const aggregate = await aggregateLoader({ from: fromValue, to: toValue })
    return { mode: 'aggregate', aggregate, fallback: null }
  } catch (error) {
    try {
      const [salesRowsLoader, productsLoader, storesLoader] = await Promise.all([
        resolveDep(listSalesRows, defaultInventoryClient, 'listSalesReportRows'),
        resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock'),
        resolveDep(getStores, defaultStoreCache, 'getOrRefreshStores'),
      ])
      const [salesRows, products, stores] = await Promise.all([
        salesRowsLoader({ from: fromValue, to: toValue }),
        productsLoader(),
        storesLoader(),
      ])
      return { mode: 'fallback', aggregate: null, fallback: { salesRows, products, stores } }
    } catch (fallbackError) {
      throw normalizeServiceError(fallbackError || error, 'Không tải được thống kê.')
    }
  }
}

export async function loadSalesOrdersIndexData(filters = {}, { getStores = null, listOrders = null, matchCustomerStoreIds = null } = {}) {
  try {
    const [storesLoader, ordersLoader] = await Promise.all([
      resolveDep(getStores, defaultStoreCache, 'getOrRefreshStores'),
      resolveDep(listOrders, defaultInventoryClient, 'listSalesOrders'),
    ])
    const stores = await storesLoader()
    const matchingCustomerStoreIds = typeof matchCustomerStoreIds === 'function'
      ? matchCustomerStoreIds(stores || [], filters.query || '')
      : filters.matchingCustomerStoreIds
    const result = await ordersLoader({ ...filters, matchingCustomerStoreIds })
    return { stores: stores || [], orders: result?.orders || [], totalCount: result?.totalCount || 0 }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được danh sách đơn hàng.')
  }
}

export async function loadSalesOrderDetailData(orderId, { getDetail = null, getStores = null, listProducts = null } = {}) {
  try {
    const [detailLoader, storesLoader, productsLoader] = await Promise.all([
      resolveDep(getDetail, defaultInventoryClient, 'getSalesOrderDetail'),
      resolveDep(getStores, defaultStoreCache, 'getOrRefreshStores'),
      resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock'),
    ])
    const [detail, stores, products] = await Promise.all([detailLoader(orderId), storesLoader(), productsLoader()])
    return { detail, stores: stores || [], products: products || [] }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được chi tiết đơn hàng.')
  }
}

export async function cancelSalesOrderById(orderId, userId = null, { cancelSales = null } = {}) {
  try {
    const cancelRunner = await resolveDep(cancelSales, defaultInventoryClient, 'cancelSalesOrder')
    return await cancelRunner(orderId, userId || null)
  } catch (error) {
    throw normalizeServiceError(error, 'Không hủy được đơn hàng.')
  }
}

export async function loadPurchaseOrdersList({ listOrders = null } = {}) {
  try {
    const listRunner = await resolveDep(listOrders, defaultInventoryClient, 'listPurchaseOrders')
    return { orders: await listRunner(200) }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được phiếu nhập.')
  }
}

export async function loadPurchaseOrderDetailData(purchaseOrderId, { getDetail = null, listProducts = null } = {}) {
  try {
    const [detailLoader, productsLoader] = await Promise.all([
      resolveDep(getDetail, defaultInventoryClient, 'getPurchaseOrderDetail'),
      resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock'),
    ])
    const [detail, products] = await Promise.all([detailLoader(purchaseOrderId), productsLoader()])
    return { detail, products: products || [] }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được chi tiết phiếu nhập.')
  }
}

export async function cancelPurchaseOrderById(purchaseOrderId, userId = null, { cancelPurchase = null } = {}) {
  try {
    const cancelRunner = await resolveDep(cancelPurchase, defaultInventoryClient, 'cancelPurchaseOrder')
    return await cancelRunner(purchaseOrderId, userId || null)
  } catch (error) {
    throw normalizeServiceError(error, 'Không hủy được phiếu nhập.')
  }
}

export async function loadProductManagementData({ listProducts = null, page = 1, pageSize = 50 } = {}) {
  try {
    const listRunner = await resolveDep(listProducts, defaultInventoryClient, 'listProductsWithStock')
    return await listRunner({ page, pageSize })
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được hàng hóa.')
  }
}

export async function submitProductImportFromPreview(rows, options, { importProducts = null } = {}) {
  try {
    const importRunner = await resolveDep(importProducts, defaultInventoryClient, 'importProductsFromPreview')
    return await importRunner(rows, options)
  } catch (error) {
    throw normalizeServiceError(error, 'Import thất bại. Chưa xác nhận được trạng thái ghi dữ liệu.')
  }
}

export async function createProductFromForm(payload, { createProduct = null } = {}) {
  try {
    const createRunner = await resolveDep(createProduct, defaultInventoryClient, 'createProductWithUnits')
    return await createRunner(payload)
  } catch (error) {
    throw normalizeServiceError(error, 'Không thêm được hàng hóa.')
  }
}

export async function loadProductEditData(productId, { getDetail = null } = {}) {
  try {
    const detailLoader = await resolveDep(getDetail, defaultInventoryClient, 'getProductDetail')
    return { product: await detailLoader(productId) }
  } catch (error) {
    throw normalizeServiceError(error, 'Không tải được hàng hóa.')
  }
}

export async function saveProductFromForm(productId, payload, { updateProduct = null } = {}) {
  try {
    const updateRunner = await resolveDep(updateProduct, defaultInventoryClient, 'updateProduct')
    return await updateRunner(productId, payload)
  } catch (error) {
    throw normalizeServiceError(error, 'Không lưu được hàng hóa.')
  }
}

export async function saveProductUnitFromForm(unitId, payload, { updateUnit = null } = {}) {
  try {
    const updateRunner = await resolveDep(updateUnit, defaultInventoryClient, 'updateProductUnit')
    return await updateRunner(unitId, payload)
  } catch (error) {
    throw normalizeServiceError(error, 'Không lưu được đơn vị.')
  }
}

export async function createProductUnitFromForm(productId, payload, { createUnit = null } = {}) {
  try {
    const createRunner = await resolveDep(createUnit, defaultInventoryClient, 'createProductUnit')
    return await createRunner(productId, payload)
  } catch (error) {
    throw normalizeServiceError(error, 'Không thêm được đơn vị.')
  }
}
