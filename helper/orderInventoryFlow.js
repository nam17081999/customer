import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatAddressParts, toTitleCaseVI } from '@/lib/utils'

export function toInventoryNumber(value, fallback = 0) {
  const number = Number(String(value ?? '').replaceAll(',', '.'))
  return Number.isFinite(number) ? number : fallback
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
  const number = toInventoryNumber(value, 0)
  if (number <= 0) return null
  if (!Number.isFinite(number)) throw new Error(`${fieldName} không hợp lệ.`)
  return number
}

function normalizeNonNegativeNumber(value, fieldName, fallback = 0) {
  const number = toInventoryNumber(value, fallback)
  if (number < 0) throw new Error(`${fieldName} không được âm.`)
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
        conversion_to_base_qty: normalizeNonNegativeNumber(item.conversionToBaseQty, 'Quy đổi', 1) || 1,
        unit_cost: normalizeNonNegativeNumber(item.unitCost, 'Giá nhập', 0),
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
        conversion_to_base_qty: normalizeNonNegativeNumber(item.conversionToBaseQty, 'Quy đổi', 1) || 1,
        unit_price: normalizeNonNegativeNumber(item.unitPrice, 'Giá bán', 0),
        note: cleanText(item.note),
      }
    })
    .filter(Boolean)

  if (items.length === 0) throw new Error('Vui lòng thêm ít nhất một dòng hàng bán.')

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const discountAmount = normalizeNonNegativeNumber(payload.discountAmount, 'Giảm giá', 0)
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
    customerPhone: customer?.phone || 'Chưa có SĐT',
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

  return products.filter((product) => {
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

  return orders.filter((order) => {
    if (status !== 'all' && order.status !== status) return false
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
