import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatAddressParts, toTitleCaseVI } from '@/lib/utils'

export function createMutationRequestId(prefix = 'mut') {
  const safePrefix = String(prefix || 'mut').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'mut'
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${safePrefix}_${crypto.randomUUID()}`
  }
  return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function toInventoryNumber(value, fallback = 0) {
  if (value == null) return fallback

  const text = String(value).trim()
  if (text === '') return fallback

  const number = Number(text.replaceAll(',', '.'))
  return Number.isFinite(number) ? number : fallback
}

function parseInventoryNumber(value, fieldName, { fallback = null, required = true } = {}) {
  if (value == null || String(value).trim() === '') {
    if (required) throw new Error(`${fieldName} không được để trống.`)
    return fallback
  }

  const number = Number(String(value).trim().replaceAll(',', '.'))
  if (!Number.isFinite(number)) throw new Error(`${fieldName} không hợp lệ.`)
  return number
}

function roundInventoryNumber(value, decimals) {
  const factor = 10 ** decimals
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

export function formatInventoryQuantity(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? String(number) : number.toLocaleString('vi-VN')
}

function cleanText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function cleanId(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizePositiveLineNumber(value, fieldName) {
  const number = parseInventoryNumber(value, fieldName, { fallback: 0, required: false })
  if (number <= 0) return null
  return roundInventoryNumber(number, 3)
}

function normalizeNonNegativeNumber(value, fieldName, fallback = 0) {
  const number = parseInventoryNumber(value, fieldName, { fallback, required: false })
  if (number < 0) throw new Error(`${fieldName} không được âm.`)
  return roundInventoryNumber(number, 6)
}

function normalizePositiveNumber(value, fieldName, fallback = 1) {
  const number = normalizeNonNegativeNumber(value, fieldName, fallback)
  if (number <= 0) throw new Error(`${fieldName} phải lớn hơn 0.`)
  return number
}

function normalizeOptionalMoney(value, fieldName) {
  if (value === '' || value == null) return null
  return normalizeNonNegativeNumber(value, fieldName, 0)
}

export function buildPurchaseOrderRpcPayload(payload = {}) {
  const items = (payload.items || [])
    .map((item) => {
      const productId = cleanId(item.productId)
      const productUnitId = cleanId(item.productUnitId)
      const quantity = normalizePositiveLineNumber(item.quantity, 'Số lượng')
      if (!productId || !productUnitId || !quantity) return null

      return {
        product_id: productId,
        product_unit_id: productUnitId,
        quantity,
        conversion_to_base_qty: normalizePositiveNumber(item.conversionToBaseQty, 'Quy đổi', 1),
        unit_cost: roundInventoryNumber(normalizeNonNegativeNumber(item.unitCost, 'Giá nhập', 0), 2),
        note: cleanText(item.note),
      }
    })
    .filter(Boolean)

  if (items.length === 0) throw new Error('Vui lòng thêm ít nhất một dòng hàng nhập.')

  return {
    p_order: {
      code: cleanText(payload.code),
      supplier_name: cleanText(payload.supplierName),
      note: cleanText(payload.note),
      created_by: cleanId(payload.createdBy),
    },
    p_items: items,
    p_request_id: cleanText(payload.requestId),
  }
}

export function buildSalesOrderRpcPayload(payload = {}) {
  const customerStoreId = cleanId(payload.customerStoreId)
  if (!customerStoreId) throw new Error('Vui lòng chọn khách hàng.')

  const items = (payload.items || [])
    .map((item) => {
      const productId = cleanId(item.productId)
      const productUnitId = cleanId(item.productUnitId)
      const quantity = normalizePositiveLineNumber(item.quantity, 'Số lượng')
      if (!productId || !productUnitId || !quantity) return null

      return {
        product_id: productId,
        product_unit_id: productUnitId,
        quantity,
        conversion_to_base_qty: normalizePositiveNumber(item.conversionToBaseQty, 'Quy đổi', 1),
        unit_price: roundInventoryNumber(normalizeNonNegativeNumber(item.unitPrice, 'Giá bán', 0), 2),
        note: cleanText(item.note),
      }
    })
    .filter(Boolean)

  if (items.length === 0) throw new Error('Vui lòng thêm ít nhất một dòng hàng bán.')

  const subtotal = roundInventoryNumber(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), 2)
  const discountAmount = roundInventoryNumber(normalizeNonNegativeNumber(payload.discountAmount, 'Giảm giá', 0), 2)
  if (discountAmount > subtotal) throw new Error('Giảm giá không được lớn hơn tạm tính.')

  return {
    p_order: {
      code: cleanText(payload.code),
      customer_store_id: customerStoreId,
      note: cleanText(payload.note),
      discount_amount: discountAmount,
      created_by: cleanId(payload.createdBy),
    },
    p_items: items,
    p_request_id: cleanText(payload.requestId),
  }
}

export function getSalesOrderStockIssues(items = [], productsById = new Map()) {
  const requiredByProductId = new Map()

  for (const item of items || []) {
    const productId = cleanId(item?.productId)
    if (!productId) continue
    const quantity = toInventoryNumber(item?.quantity, 0)
    const conversion = toInventoryNumber(item?.conversionToBaseQty, 1) || 1
    if (quantity <= 0 || conversion <= 0) continue
    requiredByProductId.set(productId, (requiredByProductId.get(productId) || 0) + quantity * conversion)
  }

  return Array.from(requiredByProductId.entries())
    .map(([productId, requiredBaseQty]) => {
      const product = productsById.get(String(productId)) || null
      const onHandBaseQty = Number(product?.onHandBaseQty || 0)
      if (!product || requiredBaseQty <= onHandBaseQty) return null
      const unitName = product.base_unit_name || 'đơn vị gốc'
      return {
        productId,
        productName: product.name || 'Hàng hóa',
        requiredBaseQty: roundInventoryNumber(requiredBaseQty, 3),
        onHandBaseQty: roundInventoryNumber(onHandBaseQty, 3),
        unitName,
        message: `${product.name || 'Hàng hóa'} thiếu ${formatInventoryQuantity(requiredBaseQty - onHandBaseQty)} ${unitName}`,
      }
    })
    .filter(Boolean)
}

export function assertSalesOrderStockAvailable(items = [], productsById = new Map()) {
  const issues = getSalesOrderStockIssues(items, productsById)
  if (issues.length > 0) {
    throw new Error(`Không đủ tồn kho: ${issues.map((issue) => issue.message).join('; ')}.`)
  }
  return true
}

export function createSalesOrderLine(products = [], { priceType = 'retail' } = {}) {
  const product = Array.isArray(products) ? products[0] || null : null
  const unit = product?.units?.find((item) => Number(item.conversion_to_base_qty) > 1)
    || product?.baseUnit
    || product?.units?.[0]
    || null

  let unitPrice
  if (priceType === 'retail') {
    unitPrice = unit?.unit_retail_price ?? product?.retail_price ?? unit?.default_sale_price ?? product?.default_sale_price ?? ''
  } else if (priceType === 'wholesale') {
    unitPrice = unit?.unit_wholesale_price ?? product?.wholesale_price ?? unit?.default_sale_price ?? product?.default_sale_price ?? ''
  } else {
    unitPrice = unit?.default_sale_price ?? product?.default_sale_price ?? ''
  }

  return {
    productId: product?.id || '',
    productUnitId: unit?.id || '',
    conversionToBaseQty: unit?.conversion_to_base_qty || 1,
    quantity: '1',
    unitPrice,
    costPriceBase: '',
    note: '',
    priceType,
  }
}

export function createSalesOrderDraft({ draftNumber = 1, products = [], code = '' } = {}) {
  const safeNumber = Math.max(1, Number(draftNumber) || 1)
  return {
    id: `draft-${safeNumber}`,
    draftNumber: safeNumber,
    title: `Hóa đơn ${safeNumber}`,
    code,
    customerStoreId: '',
    customerQuery: '',
    note: '',
    discountAmount: '',
    requestId: createMutationRequestId('sales'),
    items: [],
  }
}

export function addSalesOrderDraft({ drafts = [], products = [], buildCode = () => '' } = {}) {
  const safeDrafts = Array.isArray(drafts) ? drafts : []
  const nextNumber = safeDrafts.reduce((max, draft) => Math.max(max, Number(draft?.draftNumber || 0)), 0) + 1
  const nextDraft = createSalesOrderDraft({
    draftNumber: nextNumber,
    products,
    code: buildCode(nextNumber),
  })

  return {
    drafts: [...safeDrafts, nextDraft],
    activeDraftId: nextDraft.id,
  }
}

function salesOrderStoreLabel(store) {
  return [store?.name, store?.ward, store?.district].filter(Boolean).join(' - ')
}

export function addSalesOrderDraftForStore({
  drafts = [],
  stores = [],
  queryStoreId,
  products = [],
  buildCode = () => '',
} = {}) {
  const safeDrafts = Array.isArray(drafts) ? drafts : []
  const storeId = String(queryStoreId || '').trim()
  const store = Array.isArray(stores)
    ? stores.find((item) => String(item?.id) === storeId)
    : null

  if (!store) {
    return {
      created: false,
      drafts: safeDrafts,
      activeDraftId: safeDrafts[0]?.id || '',
    }
  }

  const result = addSalesOrderDraft({ drafts: safeDrafts, products, buildCode })
  return {
    created: true,
    activeDraftId: result.activeDraftId,
    drafts: updateSalesOrderDraft(result.drafts, result.activeDraftId, {
      customerStoreId: String(store.id),
      customerQuery: salesOrderStoreLabel(store),
      items: [],
    }),
  }
}

export function updateSalesOrderDraft(drafts = [], draftId, patch = {}) {
  return (Array.isArray(drafts) ? drafts : []).map((draft) => (
    String(draft?.id) === String(draftId) ? { ...draft, ...patch } : draft
  ))
}

export function closeSalesOrderDraft({ drafts = [], activeDraftId, draftId } = {}) {
  const safeDrafts = Array.isArray(drafts) ? drafts : []
  if (safeDrafts.length <= 1) {
    return {
      drafts: safeDrafts,
      activeDraftId: activeDraftId || safeDrafts[0]?.id || '',
    }
  }

  const closedIndex = safeDrafts.findIndex((draft) => String(draft?.id) === String(draftId))
  if (closedIndex === -1) return { drafts: safeDrafts, activeDraftId }

  const nextDrafts = safeDrafts.filter((draft) => String(draft?.id) !== String(draftId))
  let nextActiveDraftId = activeDraftId
  if (String(activeDraftId) === String(draftId)) {
    nextActiveDraftId = nextDrafts[Math.min(closedIndex, nextDrafts.length - 1)]?.id || nextDrafts[0]?.id || ''
  }

  return {
    drafts: nextDrafts,
    activeDraftId: nextActiveDraftId,
  }
}

const SALES_ORDER_DRAFT_STORAGE_VERSION = 1

function stringValue(value) {
  return String(value ?? '')
}

function normalizeDraftItem(item = {}) {
  const productId = stringValue(item.productId).trim()
  const productUnitId = stringValue(item.productUnitId).trim()
  if (!productId || !productUnitId) return null

  return {
    productId,
    productUnitId,
    conversionToBaseQty: toInventoryNumber(item.conversionToBaseQty, 1) || 1,
    quantity: stringValue(item.quantity ?? '1'),
    unitPrice: stringValue(item.unitPrice ?? ''),
    costPriceBase: stringValue(item.costPriceBase ?? ''),
    note: stringValue(item.note).trim(),
    priceType: item.priceType === 'retail' || item.priceType === 'wholesale' ? item.priceType : 'retail',
  }
}

function normalizeDraft(draft = {}) {
  const id = stringValue(draft.id).trim()
  if (!id) return null

  const draftNumber = Math.max(1, Number(draft.draftNumber) || 1)
  const title = stringValue(draft.title).trim() || `Hóa đơn ${draftNumber}`

  return {
    id,
    draftNumber,
    title,
    code: stringValue(draft.code),
    customerStoreId: stringValue(draft.customerStoreId),
    customerQuery: stringValue(draft.customerQuery),
    note: stringValue(draft.note),
    discountAmount: stringValue(draft.discountAmount),
    requestId: stringValue(draft.requestId).trim() || createMutationRequestId('sales'),
    items: (Array.isArray(draft.items) ? draft.items : []).map(normalizeDraftItem).filter(Boolean),
  }
}

export function buildSalesOrderDraftStoragePayload({ drafts = [], activeDraftId = '' } = {}) {
  const safeDrafts = (Array.isArray(drafts) ? drafts : []).map(normalizeDraft).filter(Boolean)
  if (safeDrafts.length === 0) return null

  const safeActiveDraftId = safeDrafts.some((draft) => draft.id === activeDraftId)
    ? activeDraftId
    : safeDrafts[0].id

  return {
    version: SALES_ORDER_DRAFT_STORAGE_VERSION,
    activeDraftId: safeActiveDraftId,
    drafts: safeDrafts,
  }
}

export function parseSalesOrderDraftStoragePayload(rawPayload) {
  if (!rawPayload) return null

  try {
    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    if (!payload || payload.version !== SALES_ORDER_DRAFT_STORAGE_VERSION) return null
    return buildSalesOrderDraftStoragePayload({
      drafts: payload.drafts,
      activeDraftId: payload.activeDraftId,
    })
  } catch {
    return null
  }
}

export function buildCancelSalesOrderArgs(orderId, userId) {
  const id = cleanId(orderId)
  if (!id) throw new Error('Thiếu đơn hàng cần hủy.')
  return {
    p_order_id: id,
    p_cancelled_by: cleanId(userId),
  }
}

export function buildCancelPurchaseOrderArgs(purchaseOrderId, userId) {
  const id = cleanId(purchaseOrderId)
  if (!id) throw new Error('Thiếu phiếu nhập cần hủy.')
  return {
    p_purchase_order_id: id,
    p_cancelled_by: cleanId(userId),
  }
}

export function getSalesOrderCreateRedirect() {
  return '/orders'
}

const SALES_ORDER_PAYMENT_INFO = {
  bankCode: 'HDB',
  bankName: 'Ngân hàng HD Bank',
  accountNumber: '186704070009441',
}

export function getSalesOrderPaymentInfo() {
  return { ...SALES_ORDER_PAYMENT_INFO }
}

export function buildSalesOrderPaymentQrUrl(order = {}) {
  const amount = Math.max(0, Math.round(Number(order.total_amount || 0)))
  const addInfo = encodeURIComponent(String(order.code || 'THANH TOAN DON HANG').trim() || 'THANH TOAN DON HANG')
  const accountName = encodeURIComponent('NPP HA CONG')
  const { bankCode, accountNumber } = SALES_ORDER_PAYMENT_INFO
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`
}

const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const VI_SCALES = ['', 'nghìn', 'triệu', 'tỷ']

function readVietnameseTriplet(value, full = false) {
  const number = Number(value || 0)
  const hundreds = Math.floor(number / 100)
  const tens = Math.floor((number % 100) / 10)
  const ones = number % 10
  const words = []

  if (hundreds > 0 || full) words.push(`${VI_DIGITS[hundreds]} trăm`)
  if (tens > 1) {
    words.push(`${VI_DIGITS[tens]} mươi`)
    if (ones === 1) words.push('mốt')
    else if (ones === 5) words.push('lăm')
    else if (ones > 0) words.push(VI_DIGITS[ones])
  } else if (tens === 1) {
    words.push('mười')
    if (ones === 5) words.push('lăm')
    else if (ones > 0) words.push(VI_DIGITS[ones])
  } else if (ones > 0) {
    if (hundreds > 0 || full) words.push('lẻ')
    words.push(VI_DIGITS[ones])
  }

  return words.join(' ')
}

export function formatVietnameseMoneyInWords(value) {
  const amount = Math.max(0, Math.round(Number(value || 0)))
  if (amount === 0) return 'Không đồng'

  const groups = []
  let rest = amount
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const words = []
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]
    if (group === 0) continue
    const full = index < groups.length - 1 && group < 100
    words.push([readVietnameseTriplet(group, full), VI_SCALES[index]].filter(Boolean).join(' '))
  }

  const sentence = `${words.join(' ')} đồng`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

function findInvoiceUnit(product, item) {
  const units = product?.units || []
  return units.find((unit) => String(unit.id) === String(item.product_unit_id))
    || units.find((unit) => Number(unit.conversion_to_base_qty || 0) === Number(item.conversion_to_base_qty || 0))
    || null
}

export function buildSalesOrderInvoiceModel({
  order = {},
  customer = null,
  items = [],
  productsById = new Map(),
} = {}) {
  const paymentInfo = getSalesOrderPaymentInfo()
  const customerAddress = formatAddressParts(customer) || 'Chưa có địa chỉ'
  const lines = items.map((item) => {
    const product = productsById.get(String(item.product_id)) || null
    const unit = findInvoiceUnit(product, item)
    return {
      id: item.id,
      productName: product?.name || item.product_id || 'Hàng hóa',
      sku: product?.sku || 'Chưa có mã',
      unitName: unit?.unit_name || product?.base_unit_name || 'đơn vị',
      quantity: Number(item.quantity || 0),
      conversionToBaseQty: Number(item.conversion_to_base_qty || 0),
      baseUnitName: product?.base_unit_name || 'gốc',
      unitPrice: Number(item.unit_price || 0),
      lineTotal: Number(item.line_total || 0),
    }
  })

  return {
    order,
    customerName: customer?.name || 'Khách hàng',
    customerPhone: customer?.phone || '',
    customerAddress,
    lines,
    paymentInfo,
    paymentQrUrl: buildSalesOrderPaymentQrUrl(order),
    totalAmountInWords: formatVietnameseMoneyInWords(order.total_amount),
  }
}

export function summarizeSalesOrders(orders = []) {
  const activeOrders = orders.filter((order) => order.status !== 'cancelled')
  return {
    totalOrders: orders.length,
    activeOrders: activeOrders.length,
    totalAmount: activeOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    totalProfit: activeOrders.reduce((sum, order) => sum + Number(order.gross_profit_amount || 0), 0),
    cancelled: orders.length - activeOrders.length,
  }
}

export function summarizePurchaseOrders(orders = []) {
  const activeOrders = orders.filter((order) => !order.cancelled_at)
  return {
    totalOrders: orders.length,
    activeOrders: activeOrders.length,
    cancelled: orders.length - activeOrders.length,
    totalAmount: activeOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
  }
}

export function buildProductUpdatePayload(payload = {}) {
  const name = toTitleCaseVI(String(payload.name || '').trim())
  if (!name) throw new Error('Vui lòng nhập tên hàng hóa.')

  return {
    name,
    sku: cleanText(payload.sku),
    category: cleanText(payload.category),
    default_sale_price: normalizeNonNegativeNumber(payload.defaultSalePrice, 'Giá bán', 0),
    default_purchase_price: normalizeOptionalMoney(payload.defaultPurchasePrice, 'Giá nhập'),
    retail_price: normalizeOptionalMoney(payload.retailPrice, 'Giá bán lẻ'),
    wholesale_price: normalizeOptionalMoney(payload.wholesalePrice, 'Giá bán xỉ'),
    min_stock_base_qty: normalizeNonNegativeNumber(payload.minStockBaseQty, 'Tồn tối thiểu', 0),
    active: payload.active !== false,
    note: cleanText(payload.note),
  }
}

export function buildProductUnitPayload(payload = {}) {
  const unitName = String(payload.unitName || '').trim().toLowerCase()
  if (!unitName) throw new Error('Vui lòng nhập tên đơn vị.')

  const isBaseUnit = Boolean(payload.isBaseUnit)
  const active = payload.active !== false
  if (isBaseUnit && !active) throw new Error('Không được tắt đơn vị gốc.')

  const conversion = isBaseUnit ? 1 : toInventoryNumber(payload.conversionToBaseQty, 0)
  if (conversion <= 0) throw new Error('Quy đổi phải lớn hơn 0.')

  return {
    unit_name: unitName,
    conversion_to_base_qty: conversion,
    default_sale_price: normalizeOptionalMoney(payload.defaultSalePrice, 'Giá bán'),
    default_purchase_price: normalizeOptionalMoney(payload.defaultPurchasePrice, 'Giá nhập'),
    active,
    is_base_unit: isBaseUnit,
  }
}

function normalizeSearchText(value) {
  return removeVietnameseTones(String(value || '').trim()).replace(/\s+/g, ' ')
}

function isLowStock(product) {
  return Number(product?.onHandBaseQty || 0) <= Number(product?.min_stock_base_qty || 0)
}

function isOutOfStock(product) {
  return Number(product?.onHandBaseQty || 0) <= 0
}

export function formatProductStock(product) {
  const baseQty = Number(product?.onHandBaseQty || 0)
  const units = product?.units || []
  const caseUnit = units
    .filter((unit) => Number(unit.conversion_to_base_qty || 0) > 1)
    .sort((left, right) => Number(right.conversion_to_base_qty || 0) - Number(left.conversion_to_base_qty || 0))[0]

  if (!caseUnit) return `${formatInventoryQuantity(baseQty)} ${product?.base_unit_name || ''}`.trim()

  const conversion = Number(caseUnit.conversion_to_base_qty)
  const cases = Math.floor(baseQty / conversion)
  const remainder = baseQty - cases * conversion
  if (remainder <= 0) return `${cases} ${caseUnit.unit_name}`
  return `${cases} ${caseUnit.unit_name} ${formatInventoryQuantity(remainder)} ${product?.base_unit_name || ''}`.trim()
}

export function summarizeInventoryProducts(products = []) {
  return {
    total: products.length,
    active: products.filter((product) => product.active !== false).length,
    lowStock: products.filter(isLowStock).length,
    outOfStock: products.filter(isOutOfStock).length,
    stockValue: products.reduce((sum, product) => (
      sum + Number(product.onHandBaseQty || 0) * Number(product.avgCostPerBaseUnit || 0)
    ), 0),
  }
}

export function getSalesReportDateRange(period, now = new Date()) {
  const safeNow = now instanceof Date ? now : new Date()
  const startOfDay = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate())
  const addDays = (date, days) => {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }
  const dayOfWeek = startOfDay.getDay() || 7
  const weekStart = addDays(startOfDay, 1 - dayOfWeek)

  if (period === 'day') return [startOfDay, addDays(startOfDay, 1)]
  if (period === 'week') return [weekStart, addDays(weekStart, 7)]
  if (period === 'month') return [new Date(safeNow.getFullYear(), safeNow.getMonth(), 1), new Date(safeNow.getFullYear(), safeNow.getMonth() + 1, 1)]
  if (period === 'year') return [new Date(safeNow.getFullYear(), 0, 1), new Date(safeNow.getFullYear() + 1, 0, 1)]
  return [null, null]
}

export function summarizeSalesReport({ orders = [], items = [], products = [], stores = [] } = {}) {
  const productById = new Map(products.map((product) => [String(product.id), product]))
  const storeById = new Map(stores.map((store) => [String(store.id), store]))
  const orderById = new Map(orders.map((order) => [String(order.id), order]))
  const productStats = new Map()
  const customerStats = new Map()

  for (const item of items) {
    const order = orderById.get(String(item.sales_order_id))
    if (!order) continue

    const productId = String(item.product_id)
    const product = productById.get(productId)
    const productStat = productStats.get(productId) || {
      id: productId,
      name: product?.name || 'Không tìm thấy hàng hóa',
      sku: product?.sku || '',
      baseUnitName: product?.base_unit_name || '',
      quantityBase: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      orderCount: new Set(),
    }
    productStat.quantityBase += Number(item.quantity_base || 0)
    productStat.revenue += Number(item.line_total || 0)
    productStat.cost += Number(item.line_cost_total || 0)
    productStat.profit += Number(item.line_profit || 0)
    productStat.orderCount.add(String(item.sales_order_id))
    productStats.set(productId, productStat)

    const customerId = String(order.customer_store_id)
    const store = storeById.get(customerId)
    const customerStat = customerStats.get(customerId) || {
      id: customerId,
      name: store?.name || 'Không tìm thấy khách hàng',
      address: [store?.ward, store?.district].filter(Boolean).join(' - '),
      orderCount: new Set(),
      quantityBase: 0,
      revenue: 0,
      profit: 0,
    }
    customerStat.orderCount.add(String(order.id))
    customerStat.quantityBase += Number(item.quantity_base || 0)
    customerStat.revenue += Number(item.line_total || 0)
    customerStat.profit += Number(item.line_profit || 0)
    customerStats.set(customerId, customerStat)
  }

  const normalizeStats = (rows) => rows.map((row) => ({
    ...row,
    orderCount: row.orderCount.size,
    profitMargin: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0,
  }))

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
  const totalCost = orders.reduce((sum, order) => sum + Number(order.total_cost_amount || 0), 0)
  const totalProfit = orders.reduce((sum, order) => sum + Number(order.gross_profit_amount || 0), 0)

  return {
    summary: {
      orderCount: orders.length,
      itemCount: items.length,
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    },
    topProductsByQuantity: normalizeStats(Array.from(productStats.values())).sort((left, right) => right.quantityBase - left.quantityBase),
    topProductsByProfit: normalizeStats(Array.from(productStats.values())).sort((left, right) => right.profit - left.profit),
    topCustomers: normalizeStats(Array.from(customerStats.values())).sort((left, right) => right.quantityBase - left.quantityBase),
  }
}

export function getInventoryProductCategories(products = []) {
  return Array.from(new Set(
    products
      .map((product) => String(product.category || '').trim())
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right, 'vi'))
}

export function filterInventoryProducts(products = [], filters = {}) {
  const query = normalizeSearchText(filters.query)
  const category = String(filters.category || '').trim()
  const stockFilter = filters.stockFilter || 'all'
  const excludedIds = new Set((filters.excludeProductIds || []).map((item) => String(item)))

  return products.filter((product) => {
    if (excludedIds.has(String(product.id))) return false
    if (category && String(product.category || '') !== category) return false
    if (stockFilter === 'low' && !isLowStock(product)) return false
    if (stockFilter === 'out' && !isOutOfStock(product)) return false
    if (stockFilter === 'available' && isOutOfStock(product)) return false

    if (!query) return true
    const haystack = normalizeSearchText([
      product.name,
      product.sku,
      product.category,
      product.base_unit_name,
    ].filter(Boolean).join(' '))
    return haystack.includes(query)
  })
}

export function filterSalesOrders(orders = [], storesById = new Map(), filters = {}) {
  const query = normalizeSearchText(filters.query)
  const status = filters.status || 'all'
  const statuses = Array.isArray(filters.statuses) ? filters.statuses.map((item) => String(item)) : null
  const datePreset = filters.datePreset || 'all'
  const creatorId = String(filters.creatorId || '').trim()
  const now = filters.now instanceof Date ? filters.now : new Date()

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  function addDays(date, days) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  function getDateRange() {
    const today = startOfDay(now)
    const dayOfWeek = today.getDay() || 7
    const weekStart = addDays(today, 1 - dayOfWeek)

    if (datePreset === 'today') return [today, addDays(today, 1)]
    if (datePreset === 'yesterday') return [addDays(today, -1), today]
    if (datePreset === 'week') return [weekStart, addDays(weekStart, 7)]
    if (datePreset === 'lastWeek') return [addDays(weekStart, -7), weekStart]
    if (datePreset === 'last7days') return [addDays(today, -6), addDays(today, 1)]
    if (datePreset === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)]
    if (datePreset === 'lastMonth') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)]
    if (datePreset === 'last30days') return [addDays(today, -29), addDays(today, 1)]
    if (datePreset === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
      return [new Date(now.getFullYear(), quarterStartMonth, 1), new Date(now.getFullYear(), quarterStartMonth + 3, 1)]
    }
    if (datePreset === 'lastQuarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
      return [new Date(now.getFullYear(), quarterStartMonth - 3, 1), new Date(now.getFullYear(), quarterStartMonth, 1)]
    }
    if (datePreset === 'year') return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)]
    if (datePreset === 'lastYear') return [new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1)]
    return null
  }

  const dateRange = getDateRange()

  return orders.filter((order) => {
    if (statuses) {
      if (statuses.length === 0) return false
      if (!statuses.includes(String(order.status || 'active'))) return false
    }
    if (status !== 'all' && order.status !== status) return false
    if (creatorId && String(order.created_by || '') !== creatorId) return false

    if (dateRange) {
      const createdAt = new Date(order.created_at)
      if (Number.isNaN(createdAt.getTime())) return false
      if (createdAt < dateRange[0] || createdAt >= dateRange[1]) return false
    }

    if (!query) return true

    const store = storesById.get(String(order.customer_store_id))
    const haystack = normalizeSearchText([
      order.code,
      order.status,
      store?.name,
      store?.phone,
      store?.ward,
      store?.district,
    ].filter(Boolean).join(' '))
    return haystack.includes(query)
  })
}

export function filterStockMovements(rows = [], filters = {}) {
  const query = normalizeSearchText(filters.query)
  const type = filters.type || 'all'

  return rows.filter((row) => {
    if (type !== 'all' && row.movement_type !== type) return false
    if (!query) return true

    const haystack = normalizeSearchText([
      row.movement_type,
      row.note,
      row.product?.name,
      row.product?.sku,
    ].filter(Boolean).join(' '))
    return haystack.includes(query)
  })
}

export function getOrderInventoryWorkbenchClasses() {
  return {
    shell: 'mx-auto w-full max-w-[1900px] px-3 py-4 pb-20 sm:px-4 sm:py-5 sm:pb-5 min-[1900px]:px-8',
    formShell: 'mx-auto w-full max-w-[1900px] px-3 py-4 pb-28 sm:px-4 sm:py-5 sm:pb-5 min-[1900px]:px-8',
    productsGrid: 'grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr] min-[1900px]:grid-cols-[420px_1fr] min-[1900px]:gap-6',
    orderFormGrid: 'grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr] min-[1900px]:grid-cols-[460px_1fr] min-[1900px]:gap-6',
    purchaseGrid: 'grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_44px] min-[1900px]:grid-cols-[1.7fr_1fr_0.7fr_1fr_1fr_52px] min-[1900px]:gap-4',
    orderItemGrid: 'grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_0.7fr_1fr_1fr_44px] min-[1900px]:grid-cols-[1.7fr_1fr_0.6fr_1fr_1fr_52px] min-[1900px]:gap-4',
    orderListGrid: 'grid grid-cols-1 gap-2 lg:grid-cols-[0.9fr_1.5fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr] min-[1900px]:grid-cols-[0.8fr_1.8fr_1fr_0.8fr_0.8fr_0.7fr_0.7fr] min-[1900px]:gap-4',
    summaryGrid: 'grid grid-cols-2 gap-3 lg:grid-cols-4 min-[1900px]:gap-4',
  }
}
