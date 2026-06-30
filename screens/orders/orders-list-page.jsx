import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Download, ListChecks, Plus, Printer, Search, Table2, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { STORE_TYPE_OPTIONS, DISTRICT_SUGGESTIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { formatMoney } from '@/helper/inventoryFormat'
import {
  buildSalesOrderInvoiceModel,
  formatInventoryQuantity,
  summarizeSalesOrders,
} from '@/helper/orderInventoryFlow'
import { cancelSalesOrderById, loadProductManagementData, loadSalesOrderDetailData, loadSalesOrdersIndexData } from '@/services/inventory/inventory-page-service'
import { markOrdersPrinted } from '@/api/inventory/inventory-client'
import { useReactToPrint } from 'react-to-print'
import InvoicePrintContent from '@/components/print/InvoicePrintContent'
import BatchInvoicePrintContent from '@/components/print/BatchInvoicePrintContent'
import ConsolidationPrintContent from '@/components/print/ConsolidationPrintContent'

const ORDER_FLASH_MESSAGE_KEY = 'storevis:order-flash-message'
const ORDER_SEARCH_DEBOUNCE_MS = 300

const DATE_PRESETS = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'yesterday', label: 'Hôm qua' },
  { value: 'last7days', label: '7 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tuỳ chọn' },
]

/* ── Status helpers ── */
const STATUS_LABEL = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' }
const STATUS_CLS = { pending: 's-pending', confirmed: 's-approved', cancelled: 's-cancelled' }

/* ── Chip config — labels match design, values map to real DB ── */
const STATUS_CHIPS = [
  { value: 'all', label: 'Tất cả', icon: '<circle cx="12" cy="12" r="10"/>' },
  { value: 'pending', label: 'Chờ xác nhận', icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
  { value: 'confirmed', label: 'Đã xác nhận', icon: '<polyline points="20 6 9 17 4 12"/>' },
  { value: 'cancelled', label: 'Đã hủy', icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' },
]

/* ── Helpers ── */
function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateOnly(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtVND(n) {
  if (!n && n !== 0) return ''
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

function getCustomerName(order, storesById) {
  const store = storesById.get(String(order.customer_store_id))
  return store?.name || 'Không tìm thấy khách hàng'
}

function getStorePhone(order, storesById) {
  return storesById.get(String(order.customer_store_id))?.phone || ''
}

function getStoreDistrict(order, storesById) {
  return storesById.get(String(order.customer_store_id))?.district || ''
}

function getStoreType(order, storesById) {
  return storesById.get(String(order.customer_store_id))?.store_type_name || ''
}

function getCreatorLabel(order, currentUser) {
  const creatorId = String(order?.created_by || '').trim()
  if (!creatorId) return 'Không rõ'
  if (currentUser?.id && creatorId === String(currentUser.id)) return currentUser.email || 'Bạn'
  return 'User ' + creatorId.slice(0, 8)
}

function normalizeSearchText(value) {
  return removeVietnameseTones(String(value || '').trim()).replace(/\s+/g, ' ')
}

function estimateOrderPageSize() {
  if (typeof window === 'undefined') return 12
  return Math.max(8, Math.min(24, Math.floor((window.innerHeight - 430) / 52)))
}

/* ── StatusBadge component ── */
function StatusBadge({ status }) {
  const cls = STATUS_CLS[status] || 's-draft'
  const label = STATUS_LABEL[status] || status
  return <span className={'status-badge ' + cls}><span className="dot"></span> {label}</span>
}

/* ── OrderDetailModal ── */
function OrderDetailModal({ order, storesById, onClose, onCancel }) {
  if (!order) return null

  const customerName = getCustomerName(order, storesById)
  const phone = getStorePhone(order, storesById)
  const district = getStoreDistrict(order, storesById)
  const storeType = getStoreType(order, storesById)
  const subtotal = Number(order.subtotal_amount ?? order.total_amount ?? 0)
  const discount = Number(order.discount_amount || 0)
  const shipping = Number(order.shipping_amount || 0)
  const total = Number(order.total_amount || 0)
  const items = order.items || []
  const timelineItems = order.timeline || []

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>Chi tiết đơn<span className="o-code-big">{order.code}</span></h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Store card */}
          <div className="store-info-card">
            <div>
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="si-name">{customerName}</div>
              <div className="si-addr">{[phone, district, storeType].filter(Boolean).join(' · ')}</div>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="detail-row">
              <span className="label">Trạng thái</span>
              <div className="value"><StatusBadge status={order.status} /></div>
            </div>
            <div className="detail-row">
              <span className="label">Tổng tiền</span>
              <div className="value" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtVND(total)}</div>
            </div>
            <div className="detail-row">
              <span className="label">Ngày tạo</span>
              <div className="value">{formatDateOnly(order.created_at)}</div>
            </div>
            <div className="detail-row">
              <span className="label">Người tạo</span>
              <div className="value" style={{ fontSize: 12 }}>{getCreatorLabel(order, null)}</div>
            </div>
            {discount > 0 && (
              <div className="detail-row">
                <span className="label">Giảm giá</span>
                <div className="value" style={{ color: 'var(--green)' }}>-{fmtVND(discount)}</div>
              </div>
            )}
            {shipping > 0 && (
              <div className="detail-row">
                <span className="label">Phí ship</span>
                <div className="value">{fmtVND(shipping)}</div>
              </div>
            )}
            {order.note && (
              <div className="detail-row" style={{ gridColumn: '1/-1' }}>
                <span className="label">Ghi chú</span>
                <div className="value" style={{ textAlign: 'left' }}>{order.note}</div>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="detail-section">
            <h4>Sản phẩm</h4>
            {items.length === 0 ? (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Không có sản phẩm</div>
            ) : (
              <>
                <table className="detail-items-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 140 }}>Tên</th>
                      <th className="item-qty">SL</th>
                      <th className="item-price">Đơn giá</th>
                      <th className="item-total">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td>{it.product_name || it.name}</td>
                        <td className="item-qty">{it.quantity || it.qty}</td>
                        <td className="item-price">{fmtVND(it.unit_price ?? it.price)}</td>
                        <td className="item-total">{fmtVND((it.unit_price ?? it.price) * (it.quantity || it.qty))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="detail-summary">
                  <div className="sum-row"><span>Tạm tính</span><span>{fmtVND(subtotal)}</span></div>
                  {discount > 0 && <div className="sum-row" style={{ color: 'var(--green)' }}><span>Giảm giá</span><span>-{fmtVND(discount)}</span></div>}
                  {shipping > 0 && <div className="sum-row"><span>Phí vận chuyển</span><span>{fmtVND(shipping)}</span></div>}
                  <div className="sum-row total"><span>Tổng cộng</span><span>{fmtVND(total)}</span></div>
                </div>
              </>
            )}
          </div>

          {/* Timeline */}
          {timelineItems.length > 0 && (
            <div className="detail-section">
              <h4>Lịch sử đơn</h4>
              <div className="timeline">
                {timelineItems.map((tl, i) => (
                  <div key={i} className={'tl-item ' + (tl.current ? 'current' : tl.done ? 'done' : '')}>
                    <span className="tl-label">{tl.label}</span>
                    <span className="tl-time">{new Date(tl.time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          {order.status === 'active' && (
            <button className="btn btn-outline" style={{ color: 'var(--red)', borderColor: 'transparent', background: 'oklch(60% 0.16 28 / 0.1)' }} onClick={() => { if (window.confirm('Hủy đơn ' + order.code + '?')) onCancel(order) }}>Hủy đơn</button>
          )}
          <div style={{ flex: 1 }}></div>
          <button className="btn btn-outline" onClick={onClose}>Đóng</button>
        </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Người tạo</label>
                  <select value={advCreator} onChange={(e) => setAdvCreator(e.target.value)}
                    style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 28px 0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 160, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6964\' stroke-width=\'2.5\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                    <option value="">Tất cả</option>
                    <option value={user?.id || ''}>{user?.email || 'Tôi'}</option>
                  </select>
                </div>
              </div>
  )
}

/* ═══════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function OrdersListPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)

  /* ── Data state ── */
  const [orders, setOrders] = useState([])
  const [ordersTotalCount, setOrdersTotalCount] = useState(0)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msgState, setMsgState] = useState(null)

  /* ── Filter state ── */
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilters, setStatusFilters] = useState([])  // [] = no filter (all), ['active'], ['cancelled']
  const [activeChip, setActiveChip] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [filterStoreType, setFilterStoreType] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterCreator, setFilterCreator] = useState('')

  /* ── Advanced filter form state ── */
  const [advStatus, setAdvStatus] = useState('')
  const [advDateFrom, setAdvDateFrom] = useState('')
  const [advDateTo, setAdvDateTo] = useState('')
  const [advDatePreset, setAdvDatePreset] = useState('all')
  const [advStoreType, setAdvStoreType] = useState('')
  const [advDistrict, setAdvDistrict] = useState('')
  const [advCreator, setAdvCreator] = useState('')
  const [mobStatus, setMobStatus] = useState('')

  /* ── Batch ops state ── */
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [selectedOrdersModalOpen, setSelectedOrdersModalOpen] = useState(false)
  const [printInvoices, setPrintInvoices] = useState([])
  const [printing, setPrinting] = useState(false)
  const batchPrintRef = useRef(null)
  const consolidationPrintRef = useRef(null)
  const handleBatchPrint = useReactToPrint({ contentRef: batchPrintRef, pageStyle: '@page { size: A4 landscape; margin: 0; } body { margin: 0; padding: 0; }' })
  const handleConsolidationPrint = useReactToPrint({ contentRef: consolidationPrintRef, pageStyle: '@page { size: A4 portrait; margin: 8mm 10mm; }' })
  const [consolidationModalOpen, setConsolidationModalOpen] = useState(false)
  const [consolidationData, setConsolidationData] = useState([])
  const [consolidating, setConsolidating] = useState(false)
  const [products, setProducts] = useState([])

  /* ── Pagination state ── */
  const [orderPage, setOrderPage] = useState(1)
  const [orderPageSize, setOrderPageSize] = useState(12)
  const [orderPageInput, setOrderPageInput] = useState('1')
  const orderPageSizeOptions = [8, 12, 16, 24]

  /* ── Detail modal ── */
  const [detailOrder, setDetailOrder] = useState(null)

  /* ── Refs ── */
  const [cancellingId, setCancellingId] = useState('')
  const cancellingRef = useRef('')
  const detailRequestIdRef = useRef(0)
  const ordersRequestIdRef = useRef(0)
  const orderListSignatureRef = useRef('')

  /* ── Auth guard ── */
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.replace('/login?from=/orders'); return }
    if (!isAdmin) { router.replace('/account'); return }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updatePageSize = () => setOrderPageSize((prev) => (prev === 12 ? estimateOrderPageSize() : prev))
    updatePageSize()
    window.addEventListener('resize', updatePageSize)
    return () => window.removeEventListener('resize', updatePageSize)
  }, [])

  useEffect(() => { setOrderPageInput(String(orderPage)) }, [orderPage])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), ORDER_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  /* ── Store matching helper ── */
  const matchStoreIds = useCallback((stores, query) => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery && !filterStoreType && !filterDistrict) return []
    let matched = Array.isArray(stores) ? [...stores] : []
    if (normalizedQuery) {
      matched = matched.filter((store) => {
        const haystack = normalizeSearchText([store?.name, store?.phone, store?.ward, store?.district].filter(Boolean).join(' '))
        return haystack.includes(normalizedQuery)
      })
    }
    if (filterStoreType) {
      matched = matched.filter((store) => String(store.store_type) === filterStoreType)
    }
    if (filterDistrict) {
      matched = matched.filter((store) => normalizeSearchText(store?.district || '').includes(normalizeSearchText(filterDistrict)))
    }
    return matched.map((store) => String(store.id)).filter(Boolean)
  }, [filterStoreType, filterDistrict])

  /* ── Load orders ── */
  const loadOrders = useCallback(async () => {
    const requestId = ++ordersRequestIdRef.current
    const statuses = statusFilters.length > 0 ? statusFilters : ['confirmed', 'pending', 'cancelled']
    const nextSignature = JSON.stringify({ query: debouncedQuery, statuses, datePreset, dateFrom, dateTo, orderPageSize, filterStoreType, filterDistrict, filterCreator })

    if (orderListSignatureRef.current !== nextSignature) {
      orderListSignatureRef.current = nextSignature
      if (orderPage !== 1) { setOrderPage(1); return }
    }

    setLoading(true)
    setError('')
    try {
      const { stores: storeRows, orders: orderRows, totalCount } = await loadSalesOrdersIndexData({
        page: orderPage,
        pageSize: orderPageSize,
        query: debouncedQuery,
        statuses,
        datePreset,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        creatorId: filterCreator || undefined,
      }, { matchCustomerStoreIds: matchStoreIds })
      if (ordersRequestIdRef.current !== requestId) return
      setStores(storeRows || [])
      if (ordersRequestIdRef.current !== requestId) return
      setOrders(orderRows || [])
      setOrdersTotalCount(Number(totalCount || 0))
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được danh sách đơn hàng.')
      setOrders([])
      setOrdersTotalCount(0)
    } finally {
      if (ordersRequestIdRef.current === requestId) setLoading(false)
    }
  }, [datePreset, dateFrom, dateTo, debouncedQuery, orderPage, orderPageSize, statusFilters, filterStoreType, filterDistrict, filterCreator, matchStoreIds])

  const ensureProductsLoaded = useCallback(async () => {
    if (products.length > 0) return products
    const { products: productRows } = await loadProductManagementData()
    setProducts(productRows || [])
    return productRows || []
  }, [products])

  useEffect(() => { if (pageReady) loadOrders() }, [pageReady, loadOrders])

  /* ── Flash messages ── */
  useEffect(() => {
    if (!pageReady || typeof window === 'undefined') return
    const rawFlash = window.sessionStorage.getItem(ORDER_FLASH_MESSAGE_KEY)
    if (!rawFlash) return
    window.sessionStorage.removeItem(ORDER_FLASH_MESSAGE_KEY)
    try {
      const flash = JSON.parse(rawFlash)
      if (!flash?.text) return
      setMsgState({ type: flash.type || 'info', text: flash.text, show: true })
      window.setTimeout(() => setMsgState((prev) => (prev?.text === flash.text ? { ...prev, show: false } : prev)), 2500)
    } catch {
      setMsgState({ type: 'success', text: rawFlash, show: true })
      window.setTimeout(() => setMsgState((prev) => (prev?.text === rawFlash ? { ...prev, show: false } : prev)), 2500)
    }
  }, [pageReady])

  /* ── Memos ── */
  const storesById = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const filteredOrders = orders
  const summary = useMemo(() => summarizeSalesOrders(filteredOrders), [filteredOrders])

  const selectedOrders = useMemo(() => (
    selectedOrderIds.map((orderId) => orders.find((order) => String(order.id) === String(orderId))).filter(Boolean)
  ), [orders, selectedOrderIds])

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderIds.includes(String(order.id)))
  const displayOrdersTotalCount = ordersTotalCount > 0 ? ordersTotalCount : filteredOrders.length
  const totalPages = Math.max(1, Math.ceil(displayOrdersTotalCount / orderPageSize))
  const visibleOrderStart = displayOrdersTotalCount === 0 ? 0 : ((orderPage - 1) * orderPageSize) + 1
  const visibleOrderEnd = Math.min(displayOrdersTotalCount, orderPage * orderPageSize)

  /* ── Handlers ── */
  const handleChipClick = (value) => {
    setActiveChip(value)
    if (value === 'all') {
      setStatusFilters([])
    } else {
      setStatusFilters([value])
    }
    setAdvStatus('')
    setAdvDateFrom('')
    setAdvDateTo('')
    setAdvDatePreset('all')
    setAdvStoreType('')
    setAdvDistrict('')
    setFilterStoreType('')
    setFilterDistrict('')
    setDatePreset('all')
    setDateFrom('')
    setDateTo('')
  }

  const applyAdvancedFilter = () => {
    const status = advStatus
    if (status) {
      setActiveChip(status)
      setStatusFilters([status])
    } else {
      setActiveChip('all')
      setStatusFilters([])
    }
    setFilterStoreType(advStoreType)
    setFilterDistrict(advDistrict)
    setFilterCreator(advCreator)
    setDatePreset(advDatePreset)
    if (advDatePreset === 'custom') {
      setDateFrom(advDateFrom)
      setDateTo(advDateTo)
    } else {
      setDateFrom('')
      setDateTo('')
    }
    setFilterPanelOpen(false)
    setFilterSheetOpen(false)
  }

  const resetAdvancedFilter = () => {
    setAdvStatus('')
    setAdvDateFrom('')
    setAdvDateTo('')
    setAdvDatePreset('all')
    setAdvStoreType('')
    setAdvDistrict('')
    setAdvCreator('')
    setActiveChip('all')
    setStatusFilters([])
    setFilterStoreType('')
    setFilterDistrict('')
    setFilterCreator('')
    setDatePreset('all')
    setDateFrom('')
    setDateTo('')
    setFilterPanelOpen(false)
  }

  const applyMobileFilter = () => {
    if (mobStatus) {
      setAdvStatus(mobStatus)
      setActiveChip(mobStatus)
      setStatusFilters([mobStatus])
    } else {
      setAdvStatus('')
      setActiveChip('all')
      setStatusFilters([])
    }
    setFilterSheetOpen(false)
  }

  const toggleOrderSelection = (orderId) => {
    const safeOrderId = String(orderId)
    setSelectedOrderIds((prev) => prev.includes(safeOrderId) ? prev.filter((item) => item !== safeOrderId) : [...prev, safeOrderId])
  }

  const toggleAllFilteredSelection = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredOrders.map((order) => String(order.id)))
      setSelectedOrderIds((prev) => prev.filter((orderId) => !filteredIds.has(orderId)))
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...filteredOrders.map((order) => String(order.id))])))
    }
  }

  const goToPreviousPage = useCallback(() => setOrderPage((prev) => Math.max(1, prev - 1)), [])
  const goToFirstPage = useCallback(() => setOrderPage(1), [])
  const goToNextPage = useCallback(() => setOrderPage((prev) => Math.min(totalPages, prev + 1)), [totalPages])
  const goToLastPage = useCallback(() => setOrderPage(totalPages), [totalPages])
  const commitPageInput = useCallback(() => {
    const nextPage = Math.max(1, Math.min(totalPages, Number(orderPageInput) || 1))
    setOrderPage(nextPage)
    setOrderPageInput(String(nextPage))
  }, [orderPageInput, totalPages])

  const handleCancelOrder = async (order) => {
    if (!order?.id || order.status === 'cancelled' || cancellingId || cancellingRef.current) return
    cancellingRef.current = order.id
    setCancellingId(order.id)
    setError('')
    try {
      await cancelSalesOrderById(order.id, user?.id || null)
      await loadOrders()
      setDetailOrder(null)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không hủy được đơn hàng.')
    } finally {
      cancellingRef.current = ''
      setCancellingId('')
    }
  }

  const handleShowConsolidation = async () => {
    if (consolidating || selectedOrders.length === 0) return
    setConsolidating(true)
    setError('')
    try {
      const [productRows, detailRows] = await Promise.all([
        ensureProductsLoaded(),
        Promise.all(selectedOrders.map((order) => loadSalesOrderDetailData(order.id).then((r) => r.detail))),
      ])
      const productMap = new Map((productRows || []).map((p) => [String(p.id), p]))
      const quantityMap = new Map()
      for (const detail of detailRows) {
        if (!detail?.items) continue
        for (const item of detail.items) {
          const pid = String(item.product_id)
          const product = productMap.get(pid)
          const name = product?.name || item.product_name || pid
          quantityMap.set(name, (quantityMap.get(name) || 0) + Number(item.quantity || 0))
        }
      }
      setConsolidationData(Array.from(quantityMap.entries()).map(([productName, quantity]) => ({ productName, quantity })).sort((a, b) => b.quantity - a.quantity))
      setConsolidationModalOpen(true)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tổng hợp được hàng hóa.')
    } finally {
      setConsolidating(false)
    }
  }

  const handlePrintSelectedOrders = async () => {
    if (printing || selectedOrders.length === 0) return
    setPrinting(true)
    setError('')
    try {
      const [productRows, detailRows] = await Promise.all([
        ensureProductsLoaded(),
        Promise.all(selectedOrders.map((order) => loadSalesOrderDetailData(order.id).then((r) => r.detail))),
      ])
      const nextInvoices = detailRows.map((detail) => {
        const customer = storesById.get(String(detail.order.customer_store_id))
        return buildSalesOrderInvoiceModel({ order: detail.order, customer, items: detail.items, productsById: new Map((productRows || []).map((p) => [String(p.id), p])) })
      })
      setPrintInvoices(nextInvoices)
      try {
        await markOrdersPrinted(selectedOrders.map((o) => String(o.id)))
        setOrders((prev) => prev.map((o) => (selectedOrderIds.includes(String(o.id)) ? { ...o, is_printed: true } : o)))
      } catch (err) { console.error('[print_mark_error]', err) }
      window.setTimeout(() => { handleBatchPrint(); setPrinting(false) }, 100)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không chuẩn bị được dữ liệu in đơn.')
      setPrinting(false)
    }
  }

  const handleOpenDetail = async (order) => {
    setDetailOrder(null)
    try {
      const requestId = ++detailRequestIdRef.current
      const result = await loadSalesOrderDetailData(order.id)
      if (detailRequestIdRef.current !== requestId) return
      setDetailOrder({ ...order, items: result.detail?.items || [], timeline: result.detail?.timeline || [] })
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được chi tiết đơn hàng.')
    }
  }

  /* ── Pagination number generation (matches design pattern) ── */
  const pageNumbers = useMemo(() => {
    const tp = Math.max(1, totalPages)
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
    const pages = new Set([1])
    for (let i = Math.max(2, orderPage - 2); i <= Math.min(tp - 1, orderPage + 2); i++) pages.add(i)
    pages.add(tp)
    return [...pages].sort((a, b) => a - b)
  }, [totalPages, orderPage])

  /* ── Render ── */
  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Danh sách đơn hàng - NPP Hà Công</title>
        <style>{`.print-hide { display: none; }`}</style>
      </Head>

      {/* ═══ Page Header ═══ */}
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Danh sách đơn hàng</h1>
          <p>Quản lý và theo dõi đơn hàng</p>
        </div>
        <Button asChild><Link href="/orders/new"><Plus className="h-4 w-4" /> Lên đơn</Link></Button>
      </div>

      <div className="text-gray-100 print:bg-white print:text-black">
        {msgState ? <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg> : null}

        <div className="orders-list-screen-only flex h-full min-h-0 flex-col gap-3">

            {/* ═══ KPI Row ═══ */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Tổng đơn</div>
                <div className="kpi-value" style={{ color: 'var(--accent)' }}>{orders.length}</div>
                <div className="kpi-sub">Tất cả trạng thái</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Hiệu lực</div>
                <div className="kpi-value" style={{ color: 'var(--green)' }}>{summary.activeOrders}</div>
                <div className="kpi-sub">{summary.activeOrders > 0 ? summary.activeOrders + ' đơn đang hoạt động' : 'Không có đơn hiệu lực'}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Đã hủy</div>
                <div className="kpi-value" style={{ color: 'var(--red)' }}>{summary.cancelled}</div>
                <div className="kpi-sub">Tổng số đơn đã hủy</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Hiển thị</div>
                <div className="kpi-value" style={{ color: 'var(--muted)' }}>{filteredOrders.length}</div>
                <div className="kpi-sub">Đơn trong bộ lọc hiện tại</div>
              </div>
            </div>

            {/* ═══ Toolbar ═══ */}
            <div className="toolbar">
              {/* Search */}
              <div className="search-box" style={{ width: 260 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Mã đơn hoặc tên cửa hàng..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              {/* Status chips */}
              <div className="filter-chips">
                {STATUS_CHIPS.map((chip) => (
                  <span key={chip.value} className={'chip' + (activeChip === chip.value ? ' active' : '')} onClick={() => handleChipClick(chip.value)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: chip.icon }} />
                    {chip.label}
                  </span>
                ))}
              </div>

              {/* Mobile filter toggle */}
              <div className="filter-toggle" onClick={() => { setMobStatus(advStatus); setFilterSheetOpen(true) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
                </svg>
                Bộ lọc
              </div>

              {/* Actions */}
              <div className="toolbar-extra">
                <button className={'btn btn-outline btn-sm' + (filterPanelOpen ? ' active' : '')} onClick={() => setFilterPanelOpen((prev) => !prev)} style={{ position: 'relative' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Bộ lọc
                  {(() => {
                    const activeCount = [filterStoreType, filterDistrict, filterCreator].filter(Boolean).length + (datePreset !== 'all' ? 1 : 0)
                    return activeCount > 0 ? <span style={{
                      position: 'absolute', top: -4, right: -4, background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 700, lineHeight: 1, minWidth: 16, height: 16, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                    }}>{activeCount}</span> : null
                  })()}
                </button>
              </div>
            </div>

            {/* ═══ Filter panel desktop ═══ */}
            <div className={'filter-panel' + (filterPanelOpen ? ' open' : '')}>
              <div className="filter-row">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Trạng thái</label>
                  <select value={advStatus} onChange={(e) => setAdvStatus(e.target.value)}
                    style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 28px 0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 160, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6964\' stroke-width=\'2.5\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                    <option value="">Tất cả</option>
                    <option value="pending">Chờ xác nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Loại cửa hàng</label>
                  <select value={advStoreType} onChange={(e) => setAdvStoreType(e.target.value)}
                    style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 28px 0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 160, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6964\' stroke-width=\'2.5\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                    <option value="">Tất cả</option>
                    {STORE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Quận/Huyện</label>
                  <select value={advDistrict} onChange={(e) => setAdvDistrict(e.target.value)}
                    style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 28px 0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 160, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6964\' stroke-width=\'2.5\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                    <option value="">Tất cả</option>
                    {DISTRICT_SUGGESTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Người tạo</label>
                  <select value={advCreator} onChange={(e) => setAdvCreator(e.target.value)}
                    style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 28px 0 10px', fontSize: 13, outline: 'none', cursor: 'pointer', minWidth: 160, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b6964\' stroke-width=\'2.5\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                    <option value="">Tất cả</option>
                    <option value={user?.id || ''}>{user?.email || 'Tôi'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 6 }}>Khoảng ngày</label>
                <div className="date-chips">
                  {DATE_PRESETS.map((dp) => (
                    <span key={dp.value} className={'date-chip' + (advDatePreset === dp.value ? ' active' : '')}
                      onClick={() => { setAdvDatePreset(dp.value); if (dp.value !== 'custom') { setAdvDateFrom(''); setAdvDateTo('') } }}>
                      {dp.label}
                    </span>
                  ))}
                </div>
                {advDatePreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <input type="date" value={advDateFrom} onChange={(e) => setAdvDateFrom(e.target.value)}
                      style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 10px', fontSize: 13, outline: 'none' }} />
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>→</span>
                    <input type="date" value={advDateTo} onChange={(e) => setAdvDateTo(e.target.value)}
                      style={{ height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--fg)', padding: '0 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-outline btn-sm" onClick={resetAdvancedFilter}>Đặt lại</button>
                <button className="btn btn-primary btn-sm" onClick={applyAdvancedFilter}>Áp dụng</button>
              </div>
            </div>

            {/* Error */}
            {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}

            {/* ═══ Multi-action bar (above table) ═══ */}
            {selectedOrders.length > 0 && (
              <div className="multi-bar">
                <div className="multi-bar-left">
                  <ListChecks className="h-4 w-4" />
                  <span>Đã chọn <strong>{selectedOrders.length}</strong> đơn</span>
                </div>
                <div className="multi-bar-right">
                  <button className="btn btn-outline btn-sm" onClick={() => setSelectedOrdersModalOpen(true)}>
                    <ListChecks className="h-3.5 w-3.5" /> Xem
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={handleShowConsolidation} disabled={consolidating}>
                    <Table2 className="h-3.5 w-3.5" /> {consolidating ? 'Đang tổng hợp...' : 'Tổng hợp'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={handlePrintSelectedOrders} disabled={printing}>
                    <Printer className="h-3.5 w-3.5" /> {printing ? 'Đang chuẩn bị...' : 'In đơn'}
                  </button>
                  <button className="btn btn-outline btn-sm">
                    <Download className="h-3.5 w-3.5" /> Xuất Excel
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelectedOrderIds([])}>
                    <X className="h-3.5 w-3.5" /> Bỏ chọn
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Order Table ═══ */}
            <div className="order-table-wrap" style={{ flex: '1 1 0%', minHeight: 0, overflow: 'auto' }}>
              <table className="order-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, padding: '10px 8px' }}>
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFilteredSelection} aria-label="Chọn tất cả" className="h-3.5 w-3.5 accent-gray-100" />
                    </th>
                    <th className="th-sort">Mã đơn<span className="sort-arrow">⇅</span></th>
                    <th className="th-sort">Cửa hàng<span className="sort-arrow">⇅</span></th>
                    <th className="th-sort">Trạng thái<span className="sort-arrow">⇅</span></th>
                    <th className="th-sort" style={{ textAlign: 'right' }}>Giá trị<span className="sort-arrow">⇅</span></th>
                    <th className="o-items">Mặt hàng</th>
                    <th className="th-sort" style={{ textAlign: 'right' }}>Thời gian<span className="sort-arrow">⇅</span></th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td style={{ padding: '10px 8px' }}><Skeleton className="h-3.5 w-3.5" /></td>
                        <td><Skeleton className="h-3.5 w-24" /></td>
                        <td><Skeleton className="h-3.5 w-36" /></td>
                        <td><Skeleton className="h-3.5 w-20" /></td>
                        <td><Skeleton className="ml-auto h-3.5 w-24" /></td>
                        <td className="o-items"><Skeleton className="h-3.5 w-28" /></td>
                        <td><Skeleton className="ml-auto h-3.5 w-28" /></td>
                        <td></td>
                      </tr>
                    ))
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div className="empty-state">
                          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <h3>Không tìm thấy đơn hàng</h3>
                          <p>Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.map((order) => (
                    <tr key={order.id} role="button" tabIndex={0} onClick={() => handleOpenDetail(order)} onKeyDown={(e) => { if (e.key === 'Enter') handleOpenDetail(order) }}>
                      <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedOrderIds.includes(String(order.id))} onChange={() => toggleOrderSelection(order.id)} aria-label={'Chọn ' + order.code} className="h-3.5 w-3.5 accent-gray-100" />
                      </td>
                      <td className="o-code">{order.code}</td>
                      <td>
                        <div className="o-store">
                          {getCustomerName(order, storesById)}
                          {getStorePhone(order, storesById) && <span className="o-phone">{getStorePhone(order, storesById)}</span>}
                        </div>
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="o-amount" style={{ color: order.status === 'cancelled' ? 'var(--muted)' : 'var(--fg)' }}>{fmtVND(order.total_amount)}</td>
                      <td className="o-items">{order.itemCount || 0} loại</td>
                      <td className="o-time">{formatDateOnly(order.created_at)}</td>
                      <td className="o-actions">
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleOpenDetail(order) }} title="Chi tiết">⋯</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ═══ Pagination (outside table-wrap, matching design) ═══ */}
            <div className="pagination" style={{ justifyContent: 'center', marginTop: 0 }}>
              <button className="page-btn" onClick={goToPreviousPage} disabled={orderPage <= 1}>‹</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {pageNumbers.map((num, idx) => (
                  <Fragment key={num}>
                    {idx > 0 && num - pageNumbers[idx - 1] > 1 && <span className="page-ellipsis">…</span>}
                    <button className={'page-btn' + (num === orderPage ? ' active' : '')} onClick={() => setOrderPage(num)}>{num}</button>
                  </Fragment>
                ))}
              </div>
              <button className="page-btn" onClick={goToNextPage} disabled={orderPage >= totalPages}>›</button>
              <span className="page-info">Trang {orderPage}/{totalPages} · {displayOrdersTotalCount} đơn</span>
            </div>
          </div>

        {/* ═══ Detail Modal ═══ */}
        {detailOrder && <OrderDetailModal order={detailOrder} storesById={storesById} onClose={() => setDetailOrder(null)} onCancel={handleCancelOrder} />}

        {/* Consolidation modal */}
        <Dialog open={consolidationModalOpen} onOpenChange={setConsolidationModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader className="border-b border-gray-800 pb-3">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base">Tổng hợp hàng hóa — <strong>{selectedOrders.length}</strong> đơn</DialogTitle>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleConsolidationPrint} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs font-medium text-gray-200 hover:bg-gray-800">
                    <Printer className="h-3.5 w-3.5" /> In
                  </button>
                  <DialogClose className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100"><X className="h-4 w-4" /></DialogClose>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-auto px-4 pb-4">
              {consolidationData.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Không có dữ liệu hàng hóa để tổng hợp.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-gray-400">Tổng số mặt hàng: <strong className="text-gray-200">{consolidationData.length}</strong> · Tổng số lượng: <strong className="text-gray-200">{consolidationData.reduce((s, r) => s + r.quantity, 0)}</strong></p>
                  <div className="overflow-hidden rounded-lg border border-gray-700">
                    <table className="w-full border-collapse text-sm">
                      <thead><tr className="bg-gray-800 text-gray-200"><th className="w-12 border-r border-gray-700 px-3 py-2.5 text-center font-semibold">STT</th><th className="border-r border-gray-700 px-3 py-2.5 text-left font-semibold">Tên sản phẩm</th><th className="w-28 px-3 py-2.5 text-right font-semibold">Số lượng</th></tr></thead>
                      <tbody>{consolidationData.map((row, index) => (<tr key={row.productName} className="border-t border-gray-800 transition hover:bg-gray-900/50"><td className="border-r border-gray-800 px-3 py-2.5 text-center text-gray-400">{index + 1}</td><td className="border-r border-gray-800 px-3 py-2.5 font-medium text-gray-100">{row.productName}</td><td className="px-3 py-2.5 text-right font-semibold text-gray-100">{row.quantity}</td></tr>))}</tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Selected orders modal */}
        <Dialog open={selectedOrdersModalOpen} onOpenChange={setSelectedOrdersModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader className="border-b border-gray-800 pb-3">
              <div className="flex items-center justify-between"><DialogTitle className="text-base">Đã chọn <strong>{selectedOrders.length}</strong> đơn</DialogTitle><DialogClose className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100"><X className="h-4 w-4" /></DialogClose></div>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
              {selectedOrders.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Chưa chọn đơn hàng nào.</p> : (
                <div className="divide-y divide-gray-900">{selectedOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-100">{order.code}</p><p className="text-xs text-gray-400">Khách hàng: {getCustomerName(order, storesById)}</p><p className="text-xs text-gray-400">Số tiền: {formatMoney(order.total_amount)}</p></div>
                    <button type="button" onClick={() => toggleOrderSelection(order.id)} className="ml-3 shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-red-950/30 hover:text-red-400" aria-label={'Bỏ chọn ' + order.code}><X className="h-4 w-4" /></button>
                  </div>
                ))}</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Print content */}
        <div className="orders-list-print-only hidden bg-white text-gray-950 print:bg-white">
          {printInvoices.map((invoice) => (
            <section key={invoice.order.id} className="orders-list-print-page mx-auto max-w-[148mm]">
              <InvoicePrintContent invoice={invoice} order={invoice.order} userEmail={user?.email} />
            </section>
          ))}
        </div>
      </div>

      <div className="print-hide">{printInvoices.length > 0 && <BatchInvoicePrintContent ref={batchPrintRef} invoices={printInvoices} userEmail={user?.email} />}</div>
      <div className="print-hide">{consolidationData.length > 0 && <ConsolidationPrintContent ref={consolidationPrintRef} selectedOrders={selectedOrders} consolidationData={consolidationData} dateFrom={dateFrom} dateTo={dateTo} userEmail={user?.email} />}</div>

      {/* ═══ Mobile filter sheet ═══ */}
      <div className={'filter-sheet' + (filterSheetOpen ? ' open' : '')}>
        <div className="sheet-handle"></div>
        <div className="sheet-title">Bộ lọc</div>
        <div className="sheet-group">
          <label>Trạng thái</label>
          <select value={mobStatus} onChange={(e) => setMobStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="apply-btn" style={{ flex: 1, background: 'var(--border)', color: 'var(--fg)' }} onClick={() => { setMobStatus(''); setFilterSheetOpen(false) }}>Đặt lại</button>
          <button className="apply-btn" style={{ flex: 3 }} onClick={applyMobileFilter}>Xem kết quả</button>
        </div>
      </div>
      <div className={'filter-backdrop' + (filterSheetOpen ? ' open' : '')} onClick={() => setFilterSheetOpen(false)}></div>
    </>
  )
}
