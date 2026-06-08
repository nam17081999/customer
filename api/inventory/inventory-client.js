import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { toTitleCaseVI } from '@/lib/utils'
import { normalizeOperatorError } from '@/helper/operatorErrors'
import {
  buildCancelPurchaseOrderArgs,
  buildCancelSalesOrderArgs,
  buildProductUpdatePayload,
  buildProductUnitPayload,
  buildPurchaseOrderRpcPayload,
  buildSalesOrderRpcPayload,
  toInventoryNumber,
} from '@/helper/orderInventoryFlow'

export function formatMoney(value) {
  const number = Number(value || 0)
  return number.toLocaleString('vi-VN')
}

export function toNumber(value, fallback = 0) {
  return toInventoryNumber(value, fallback)
}

function logInventoryMutationError(action, error, context = {}) {
  if (typeof console === 'undefined') return
  console.error('[inventory_mutation_error]', {
    action,
    message: error?.message || 'Unknown inventory mutation error',
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
    context,
  })
}

function throwLoggedInventoryError(action, error, context = {}) {
  if (!error) return
  logInventoryMutationError(action, error, context)
  throw normalizeOperatorError(error)
}

export function buildDocumentCode(prefix) {
  const date = new Date()
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('')
  return `${prefix}${stamp}`
}

function normalizeProduct(row, unitsByProduct, stockByProduct) {
  const units = unitsByProduct.get(row.id) || []
  const stock = stockByProduct.get(row.id) || null
  const baseUnit = units.find((unit) => unit.is_base_unit) || null
  const saleUnits = units.filter((unit) => unit.active !== false)

  return {
    ...row,
    units,
    saleUnits,
    baseUnit,
    stock,
    onHandBaseQty: Number(stock?.on_hand_base_qty || 0),
    avgCostPerBaseUnit: Number(stock?.avg_cost_per_base_unit || 0),
  }
}

function normalizeSalesOrderSearchText(value) {
  return removeVietnameseTones(String(value || '').trim()).replace(/\s+/g, ' ')
}

function getSalesOrderDateRange(datePreset, now = new Date(), dateFrom = null, dateTo = null) {
  // Custom date range takes precedence when both dates are provided
  if (dateFrom && dateTo) {
    const partsFrom = dateFrom.split('-')
    const partsTo = dateTo.split('-')
    const from = new Date(Number(partsFrom[0]), Number(partsFrom[1]) - 1, Number(partsFrom[2]))
    const to = new Date(Number(partsTo[0]), Number(partsTo[1]) - 1, Number(partsTo[2]))
    to.setDate(to.getDate() + 1) // exclusive end
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      return [from, to]
    }
  }

  const safeNow = now instanceof Date ? now : new Date()

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  function addDays(date, days) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  const today = startOfDay(safeNow)
  const dayOfWeek = today.getDay() || 7
  const weekStart = addDays(today, 1 - dayOfWeek)

  if (datePreset === 'today') return [today, addDays(today, 1)]
  if (datePreset === 'yesterday') return [addDays(today, -1), today]
  if (datePreset === 'week') return [weekStart, addDays(weekStart, 7)]
  if (datePreset === 'lastWeek') return [addDays(weekStart, -7), weekStart]
  if (datePreset === 'last7days') return [addDays(today, -6), addDays(today, 1)]
  if (datePreset === 'month') return [new Date(safeNow.getFullYear(), safeNow.getMonth(), 1), new Date(safeNow.getFullYear(), safeNow.getMonth() + 1, 1)]
  if (datePreset === 'lastMonth') return [new Date(safeNow.getFullYear(), safeNow.getMonth() - 1, 1), new Date(safeNow.getFullYear(), safeNow.getMonth(), 1)]
  if (datePreset === 'last30days') return [addDays(today, -29), addDays(today, 1)]
  if (datePreset === 'quarter') {
    const quarterStartMonth = Math.floor(safeNow.getMonth() / 3) * 3
    return [new Date(safeNow.getFullYear(), quarterStartMonth, 1), new Date(safeNow.getFullYear(), quarterStartMonth + 3, 1)]
  }
  if (datePreset === 'lastQuarter') {
    const quarterStartMonth = Math.floor(safeNow.getMonth() / 3) * 3
    return [new Date(safeNow.getFullYear(), quarterStartMonth - 3, 1), new Date(safeNow.getFullYear(), quarterStartMonth, 1)]
  }
  if (datePreset === 'year') return [new Date(safeNow.getFullYear(), 0, 1), new Date(safeNow.getFullYear() + 1, 0, 1)]
  if (datePreset === 'lastYear') return [new Date(safeNow.getFullYear() - 1, 0, 1), new Date(safeNow.getFullYear(), 0, 1)]
  return null
}

function applySalesOrderListFilters(queryBuilder, { statuses, creatorId, dateRange, query, matchingCustomerStoreIds }) {
  let nextQuery = queryBuilder

  if (statuses.length > 0) {
    nextQuery = nextQuery.in('status', statuses)
  }

  if (creatorId) {
    nextQuery = nextQuery.eq('created_by', creatorId)
  }

  if (dateRange) {
    nextQuery = nextQuery
      .gte('created_at', dateRange[0].toISOString())
      .lt('created_at', dateRange[1].toISOString())
  }

  if (query || matchingCustomerStoreIds.length > 0) {
    const searchParts = []
    if (query) searchParts.push(`code.ilike.%${query}%`)
    if (matchingCustomerStoreIds.length > 0) searchParts.push(`customer_store_id.in.(${matchingCustomerStoreIds.join(',')})`)
    if (searchParts.length > 0) {
      nextQuery = nextQuery.or(searchParts.join(','))
    }
  }

  return nextQuery
}

export async function listProductsWithStock(options) {
  const legacyArrayResult = options === undefined || options === null || typeof options === 'number'
  const params = legacyArrayResult ? {} : (options || {})
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.max(1, Number(params.pageSize) || 200)

  // Build query
  let countQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  let productQuery = supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)

  if (!legacyArrayResult) {
    productQuery = productQuery.order('name', { ascending: true }).range((page - 1) * pageSize, (page * pageSize) - 1)
  } else {
    productQuery = productQuery.order('name', { ascending: true })
  }

  const [{ count: totalCount, error: countError }, { data: products, error: productError }] = await Promise.all([
    countQuery,
    productQuery,
  ])

  if (countError) throw countError
  if (productError) throw productError

  const productIds = (products || []).map((item) => item.id)
  if (productIds.length === 0) return legacyArrayResult ? [] : { products: [], totalCount: Number(totalCount || 0), page, pageSize }

  const [{ data: units, error: unitError }, { data: stockRows, error: stockError }] = await Promise.all([
    supabase
      .from('product_units')
      .select('*')
      .in('product_id', productIds)
      .order('is_base_unit', { ascending: false })
      .order('conversion_to_base_qty', { ascending: true }),
    supabase
      .from('product_stock')
      .select('*')
      .in('product_id', productIds),
  ])

  if (unitError) throw unitError
  if (stockError) throw stockError

  const unitsByProduct = new Map()
  for (const unit of units || []) {
    const current = unitsByProduct.get(unit.product_id) || []
    current.push(unit)
    unitsByProduct.set(unit.product_id, current)
  }

  const stockByProduct = new Map((stockRows || []).map((row) => [row.product_id, row]))

  const normalized = (products || []).map((row) => normalizeProduct(row, unitsByProduct, stockByProduct))

  return legacyArrayResult
    ? normalized
    : { products: normalized, totalCount: Number(totalCount || 0), page, pageSize }
}

export async function createProductWithUnits(payload) {
  const name = toTitleCaseVI(String(payload.name || '').trim())
  const baseUnitName = String(payload.baseUnitName || '').trim().toLowerCase()
  const caseUnitName = String(payload.caseUnitName || '').trim().toLowerCase()
  const caseConversion = toNumber(payload.caseConversion, 0)

  if (!name) throw new Error('Vui lòng nhập tên hàng hóa.')
  if (!baseUnitName) throw new Error('Vui lòng nhập đơn vị gốc.')

  const defaultSalePrice = toNumber(payload.defaultSalePrice, 0)
  const defaultPurchasePrice = payload.defaultPurchasePrice === ''
    ? null
    : toNumber(payload.defaultPurchasePrice, 0)

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert([{
      name,
      sku: String(payload.sku || '').trim() || null,
      category: String(payload.category || '').trim() || null,
      base_unit_name: baseUnitName,
      default_sale_price: defaultSalePrice,
      default_purchase_price: defaultPurchasePrice,
      min_stock_base_qty: toNumber(payload.minStockBaseQty, 0),
      note: String(payload.note || '').trim() || null,
      created_by: payload.createdBy || null,
    }])
    .select('*')
    .single()

  if (productError) throw productError

  const units = [{
    product_id: product.id,
    unit_name: baseUnitName,
    conversion_to_base_qty: 1,
    default_sale_price: defaultSalePrice,
    default_purchase_price: defaultPurchasePrice,
    is_base_unit: true,
  }]

  if (caseUnitName && caseConversion > 1) {
    units.push({
      product_id: product.id,
      unit_name: caseUnitName,
      conversion_to_base_qty: caseConversion,
      default_sale_price: toNumber(payload.caseSalePrice, defaultSalePrice * caseConversion),
      default_purchase_price: payload.casePurchasePrice === ''
        ? null
        : toNumber(payload.casePurchasePrice, (defaultPurchasePrice || 0) * caseConversion),
      is_base_unit: false,
    })
  }

  const { error: unitError } = await supabase
    .from('product_units')
    .insert(units)

  if (unitError) throw unitError

  await supabase
    .from('product_stock')
    .insert([{ product_id: product.id }])
    .throwOnError()

  return product
}

export async function createPurchaseOrder(payload) {
  const rpcPayload = buildPurchaseOrderRpcPayload({
    ...payload,
    code: payload.code || buildDocumentCode('PN'),
  })
  const { data, error } = await supabase.rpc('create_purchase_order_with_items', rpcPayload)
  throwLoggedInventoryError('create_purchase_order', error, { requestId: rpcPayload.p_request_id, code: rpcPayload.p_order.code })
  return data
}

export async function createSalesOrder(payload) {
  const rpcPayload = buildSalesOrderRpcPayload({
    ...payload,
    code: payload.code || buildDocumentCode('DH'),
  })
  const { data, error } = await supabase.rpc('create_sales_order_with_items', rpcPayload)
  throwLoggedInventoryError('create_sales_order', error, { requestId: rpcPayload.p_request_id, code: rpcPayload.p_order.code })
  return data
}

export async function cancelSalesOrder(orderId, userId = null) {
  const { data, error } = await supabase.rpc('cancel_sales_order_and_restore_stock', buildCancelSalesOrderArgs(orderId, userId))
  throwLoggedInventoryError('cancel_sales_order', error, { orderId })
  return data
}

export async function cancelPurchaseOrder(purchaseOrderId, userId = null) {
  const { data, error } = await supabase.rpc('cancel_purchase_order_and_remove_stock', buildCancelPurchaseOrderArgs(purchaseOrderId, userId))
  throwLoggedInventoryError('cancel_purchase_order', error, { purchaseOrderId })
  return data
}

export async function getProductDetail(productId) {
  // Direct fetch product — much faster than loading everything
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()
  if (productError) {
    if (productError.code === 'PGRST116') return null
    throw productError
  }

  const { data: units } = await supabase
    .from('product_units')
    .select('*')
    .eq('product_id', productId)
    .order('is_base_unit', { ascending: false })
    .order('conversion_to_base_qty', { ascending: true })

  const { data: stockRows } = await supabase
    .from('product_stock')
    .select('*')
    .eq('product_id', productId)

  const unitsByProduct = new Map()
  unitsByProduct.set(product.id, units || [])
  const stockByProduct = new Map()
  const stock = (stockRows || [])[0]
  if (stock) stockByProduct.set(product.id, stock)

  return normalizeProduct(product, unitsByProduct, stockByProduct)
}

export async function updateProduct(productId, payload) {
  if (!productId) throw new Error('Thiếu hàng hóa cần sửa.')
  const updatePayload = buildProductUpdatePayload(payload)
  const { data, error } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', productId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function createProductUnit(productId, payload) {
  if (!productId) throw new Error('Thiếu hàng hóa cần thêm đơn vị.')
  const unitPayload = {
    product_id: productId,
    ...buildProductUnitPayload({ ...payload, isBaseUnit: false }),
  }

  const { data, error } = await supabase
    .from('product_units')
    .insert([unitPayload])
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateProductUnit(unitId, payload) {
  if (!unitId) throw new Error('Thiếu đơn vị cần sửa.')
  const unitPayload = buildProductUnitPayload(payload)

  const { data, error } = await supabase
    .from('product_units')
    .update(unitPayload)
    .eq('id', unitId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listSalesOrders(options = 100) {
  const legacyArrayResult = typeof options === 'number'
  const params = legacyArrayResult ? { pageSize: options } : (options || {})
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.max(1, Number(params.pageSize) || 100)
  const query = normalizeSalesOrderSearchText(params.query)
  const statuses = Array.isArray(params.statuses)
    ? params.statuses.map((item) => String(item).trim()).filter(Boolean)
    : []
  const creatorId = String(params.creatorId || '').trim()
  const dateRange = getSalesOrderDateRange(params.datePreset || 'all', params.now, params.dateFrom, params.dateTo)
  const matchingCustomerStoreIds = Array.isArray(params.matchingCustomerStoreIds)
    ? params.matchingCustomerStoreIds.map((item) => String(item).trim()).filter(Boolean)
    : []

  if (Array.isArray(params.statuses) && statuses.length === 0) {
    return legacyArrayResult ? [] : { orders: [], totalCount: 0 }
  }

  const countQuery = applySalesOrderListFilters(
    supabase.from('sales_orders').select('id', { count: 'exact' }).limit(1),
    { statuses, creatorId, dateRange, query, matchingCustomerStoreIds },
  )

  const orderQuery = applySalesOrderListFilters(
    supabase
      .from('sales_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, (page * pageSize) - 1),
    { statuses, creatorId, dateRange, query, matchingCustomerStoreIds },
  )

  const [{ count: totalCount, error: countError }, { data: orders, error: orderError }] = await Promise.all([
    countQuery,
    orderQuery,
  ])

  if (countError) throw countError

  if (orderError) throw orderError

  const orderIds = (orders || []).map((order) => order.id)
  if (orderIds.length === 0) {
    const emptyResult = {
      orders: [],
      totalCount: Number(totalCount || 0),
    }
    return legacyArrayResult ? emptyResult.orders : emptyResult
  }

  const { data: items, error: itemError } = await supabase
    .from('sales_order_items')
    .select('sales_order_id,id')
    .in('sales_order_id', orderIds)

  if (itemError) throw itemError

  const itemCountByOrder = new Map()
  for (const item of items || []) {
    itemCountByOrder.set(item.sales_order_id, (itemCountByOrder.get(item.sales_order_id) || 0) + 1)
  }

  const result = {
    orders: (orders || []).map((order) => ({
      ...order,
      itemCount: itemCountByOrder.get(order.id) || 0,
    })),
    totalCount: Number(totalCount || 0),
  }

  return legacyArrayResult ? result.orders : result
}

export async function getSalesOrderDetail(orderId) {
  if (!orderId) throw new Error('Thiếu đơn hàng cần xem.')
  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError

  const { data: items, error: itemError } = await supabase
    .from('sales_order_items')
    .select('*')
    .eq('sales_order_id', orderId)
    .order('created_at', { ascending: true })

  if (itemError) throw itemError
  return { order, items: items || [] }
}

export async function listSalesReportRows({ from, to, limit = 1000 } = {}) {
  let orderQuery = supabase
    .from('sales_orders')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (from) orderQuery = orderQuery.gte('created_at', from)
  if (to) orderQuery = orderQuery.lt('created_at', to)

  const { data: orders, error: orderError } = await orderQuery
  if (orderError) throw orderError

  const orderIds = (orders || []).map((order) => order.id)
  if (orderIds.length === 0) return { orders: [], items: [] }

  const { data: items, error: itemError } = await supabase
    .from('sales_order_items')
    .select('*')
    .in('sales_order_id', orderIds)

  if (itemError) throw itemError
  return { orders: orders || [], items: items || [] }
}

export async function listPurchaseOrders(params = {}) {
  const isLegacy = typeof params === 'number'
  const page = isLegacy ? 1 : Math.max(1, Number(params.page) || 1)
  const pageSize = isLegacy ? params : Math.max(1, Number(params.pageSize) || 30)
  const from = (page - 1) * pageSize
  const to = page * pageSize - 1

  const { count: totalCount, error: countError } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
  if (countError) throw countError

  const { data: orders, error: orderError } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (orderError) throw orderError

  const orderIds = (orders || []).map((order) => order.id)
  if (orderIds.length === 0) return { orders: [], totalCount: Number(totalCount || 0) }

  const { data: items, error: itemError } = await supabase
    .from('purchase_order_items')
    .select('purchase_order_id,id')
    .in('purchase_order_id', orderIds)

  if (itemError) throw itemError

  const itemCountByOrder = new Map()
  for (const item of items || []) {
    itemCountByOrder.set(item.purchase_order_id, (itemCountByOrder.get(item.purchase_order_id) || 0) + 1)
  }

  return {
    orders: (orders || []).map((order) => ({
      ...order,
      itemCount: itemCountByOrder.get(order.id) || 0,
    })),
    totalCount: Number(totalCount || 0),
  }
}

export async function getPurchaseOrderDetail(purchaseOrderId) {
  if (!purchaseOrderId) throw new Error('Thiếu phiếu nhập cần xem.')
  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', purchaseOrderId)
    .single()

  if (orderError) throw orderError

  const { data: items, error: itemError } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', purchaseOrderId)
    .order('created_at', { ascending: true })

  if (itemError) throw itemError
  return { order, items: items || [] }
}

export async function listStockMovements(limit = 100) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getInventoryReconciliationReport() {
  const { data, error } = await supabase.rpc('get_inventory_reconciliation_report')
  if (error) throw error
  return data || []
}

export async function runInventoryReconciliationCheck(userId = null) {
  const { data, error } = await supabase.rpc('run_inventory_reconciliation_check', { p_started_by: userId })
  throwLoggedInventoryError('inventory_reconciliation_check', error, { userId })
  return data
}

export async function repairProductStockFromLedger(userId = null) {
  const { data, error } = await supabase.rpc('repair_product_stock_from_ledger', { p_started_by: userId })
  throwLoggedInventoryError('inventory_reconciliation_repair', error, { userId })
  return data
}

export async function listInventoryReconciliationRuns(limit = 50) {
  const { data, error } = await supabase
    .from('inventory_reconciliation_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
  if (error) throw error
  return data || []
}

export async function listOperationAuditEvents({ limit = 50, eventType = null } = {}) {
  let query = supabase
    .from('operation_audit_events')
    .select('*')

  if (eventType) query = query.eq('event_type', eventType)

  query = query
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function importProductsFromPreview(rows, { requestId, actorId = null } = {}) {
  if (!Array.isArray(rows)) throw new Error('Danh sách import không hợp lệ.')
  if (!requestId || String(requestId).trim().length < 12) throw new Error('Thiếu mã request import.')
  const { data, error } = await supabase.rpc('import_products_from_preview', {
    p_rows: rows,
    p_request_id: String(requestId).trim(),
    p_actor_id: actorId,
  })
  throwLoggedInventoryError('product_import', error, { requestId, rowCount: rows.length })
  return data
}

export async function getLowStockCount() {
  // Lightweight count query — avoids loading all products
  const { data, error } = await supabase
    .rpc('get_low_stock_report', { p_limit: 9999 })
  if (error) throw error
  return (data || []).length
}

export async function getLowStockItems() {
  const { data, error } = await supabase
    .rpc('get_low_stock_report', { p_limit: 10 })
  if (error) throw error
  return (data || []).map((item) => ({
    productId: item.product_id,
    productName: item.product_name,
    sku: item.sku,
    onHandQty: Number(item.on_hand_base_qty || 0),
    minStockQty: Number(item.min_stock_base_qty || 0),
    baseUnitName: item.base_unit_name,
    updatedAt: item.updated_at, // ISO string từ DB — timestamp gốc của sự kiện
  }))
}

export async function getDashboardAggregateReport({ from = null, to = null } = {}) {
  const args = { p_from: from, p_to: to }
  const [sales, purchases, inventory, topProducts, lowStock, customers] = await Promise.all([
    supabase.rpc('get_sales_summary', args),
    supabase.rpc('get_purchase_summary', args),
    supabase.rpc('get_inventory_valuation_summary'),
    supabase.rpc('get_top_products_report', { ...args, p_limit: 8 }),
    supabase.rpc('get_low_stock_report', { p_limit: 8 }),
    supabase.rpc('get_customer_revenue_report', { ...args, p_limit: 8 }),
  ])

  const responses = { sales, purchases, inventory, topProducts, lowStock, customers }
  for (const [key, response] of Object.entries(responses)) {
    if (response.error) throwLoggedInventoryError('dashboard_aggregate_report', response.error, { section: key })
  }

  return {
    sales: sales.data?.[0] || null,
    purchases: purchases.data?.[0] || null,
    inventory: inventory.data?.[0] || null,
    topProducts: topProducts.data || [],
    lowStock: lowStock.data || [],
    customers: customers.data || [],
  }
}

export async function globalOperatorSearch(query, limit = 20) {
  const { data, error } = await supabase.rpc('global_operator_search', {
    p_query: String(query || '').trim(),
    p_limit: limit,
  })
  if (error) throw error
  return data || []
}

export async function markOrdersPrinted(orderIds) {
  if (!orderIds || orderIds.length === 0) return
  const ids = orderIds.map((id) => String(id)).filter(Boolean)
  if (ids.length === 0) return

  const { error } = await supabase
    .from('sales_orders')
    .update({ is_printed: true })
    .in('id', ids)

  if (error) throw error
}
