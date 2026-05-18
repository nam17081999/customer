import { supabase } from '@/lib/supabaseClient'
import { toTitleCaseVI } from '@/lib/utils'
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

export async function listProductsWithStock() {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (productError) throw productError

  const productIds = (products || []).map((item) => item.id)
  if (productIds.length === 0) return []

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

  return (products || []).map((row) => normalizeProduct(row, unitsByProduct, stockByProduct))
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
  if (error) throw error
  return data
}

export async function createSalesOrder(payload) {
  const rpcPayload = buildSalesOrderRpcPayload({
    ...payload,
    code: payload.code || buildDocumentCode('DH'),
  })
  const { data, error } = await supabase.rpc('create_sales_order_with_items', rpcPayload)
  if (error) throw error
  return data
}

export async function cancelSalesOrder(orderId, userId = null) {
  const { data, error } = await supabase.rpc('cancel_sales_order_and_restore_stock', buildCancelSalesOrderArgs(orderId, userId))
  if (error) throw error
  return data
}

export async function cancelPurchaseOrder(purchaseOrderId, userId = null) {
  const { data, error } = await supabase.rpc('cancel_purchase_order_and_remove_stock', buildCancelPurchaseOrderArgs(purchaseOrderId, userId))
  if (error) throw error
  return data
}

export async function getProductDetail(productId) {
  const products = await listProductsWithStock()
  return products.find((product) => String(product.id) === String(productId)) || null
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

export async function listSalesOrders(limit = 100) {
  const { data: orders, error: orderError } = await supabase
    .from('sales_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (orderError) throw orderError

  const orderIds = (orders || []).map((order) => order.id)
  if (orderIds.length === 0) return []

  const { data: items, error: itemError } = await supabase
    .from('sales_order_items')
    .select('sales_order_id,id')
    .in('sales_order_id', orderIds)

  if (itemError) throw itemError

  const itemCountByOrder = new Map()
  for (const item of items || []) {
    itemCountByOrder.set(item.sales_order_id, (itemCountByOrder.get(item.sales_order_id) || 0) + 1)
  }

  return (orders || []).map((order) => ({
    ...order,
    itemCount: itemCountByOrder.get(order.id) || 0,
  }))
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

export async function listPurchaseOrders(limit = 100) {
  const { data: orders, error: orderError } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (orderError) throw orderError

  const orderIds = (orders || []).map((order) => order.id)
  if (orderIds.length === 0) return []

  const { data: items, error: itemError } = await supabase
    .from('purchase_order_items')
    .select('purchase_order_id,id')
    .in('purchase_order_id', orderIds)

  if (itemError) throw itemError

  const itemCountByOrder = new Map()
  for (const item of items || []) {
    itemCountByOrder.set(item.purchase_order_id, (itemCountByOrder.get(item.purchase_order_id) || 0) + 1)
  }

  return (orders || []).map((order) => ({
    ...order,
    itemCount: itemCountByOrder.get(order.id) || 0,
  }))
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
