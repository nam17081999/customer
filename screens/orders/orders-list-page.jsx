import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Calendar, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, ListChecks, Plus, Printer, Search, Table2, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
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
  getOrderInventoryWorkbenchClasses,
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

function getPresetDateValues(preset) {
  const now = new Date()
  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  function addDays(d, n) {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
  }
  const today = startOfDay(now)
  const dayOfWeek = today.getDay() || 7
  const weekStart = addDays(today, 1 - dayOfWeek)

  let from, exclusiveTo
  if (preset === 'today') { from = today; exclusiveTo = addDays(today, 1) }
  else if (preset === 'yesterday') { from = addDays(today, -1); exclusiveTo = today }
  else if (preset === 'week') { from = weekStart; exclusiveTo = addDays(weekStart, 7) }
  else if (preset === 'lastWeek') { from = addDays(weekStart, -7); exclusiveTo = weekStart }
  else if (preset === 'last7days') { from = addDays(today, -6); exclusiveTo = addDays(today, 1) }
  else if (preset === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); exclusiveTo = new Date(now.getFullYear(), now.getMonth() + 1, 1) }
  else if (preset === 'lastMonth') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); exclusiveTo = new Date(now.getFullYear(), now.getMonth(), 1) }
  else if (preset === 'last30days') { from = addDays(today, -29); exclusiveTo = addDays(today, 1) }
  else if (preset === 'quarter') { const qsm = Math.floor(now.getMonth() / 3) * 3; from = new Date(now.getFullYear(), qsm, 1); exclusiveTo = new Date(now.getFullYear(), qsm + 3, 1) }
  else if (preset === 'lastQuarter') { const qsm = Math.floor(now.getMonth() / 3) * 3; from = new Date(now.getFullYear(), qsm - 3, 1); exclusiveTo = new Date(now.getFullYear(), qsm, 1) }
  else if (preset === 'year') { from = new Date(now.getFullYear(), 0, 1); exclusiveTo = new Date(now.getFullYear() + 1, 0, 1) }
  else if (preset === 'lastYear') { from = new Date(now.getFullYear() - 1, 0, 1); exclusiveTo = new Date(now.getFullYear(), 0, 1) }
  else { return { dateFrom: '', dateTo: '' } }
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { dateFrom: fmt(from), dateTo: fmt(addDays(exclusiveTo, -1)) }
}

const DATE_PRESET_GROUPS = [
  {
    title: 'Theo ngày',
    options: [
      ['today', 'Hôm nay'],
      ['yesterday', 'Hôm qua'],
    ],
  },
  {
    title: 'Theo tuần',
    options: [
      ['week', 'Tuần này'],
      ['lastWeek', 'Tuần trước'],
      ['last7days', '7 ngày qua'],
    ],
  },
  {
    title: 'Theo tháng',
    options: [
      ['month', 'Tháng này'],
      ['lastMonth', 'Tháng trước'],
      ['last30days', '30 ngày qua'],
    ],
  },
  {
    title: 'Theo quý',
    options: [
      ['quarter', 'Quý này'],
      ['lastQuarter', 'Quý trước'],
    ],
  },
  {
    title: 'Theo năm',
    options: [
      ['year', 'Năm nay'],
      ['lastYear', 'Năm trước'],
    ],
  },
]

const DATE_PRESET_LABELS = Object.fromEntries([
  ['all', 'Tất cả'],
  ...DATE_PRESET_GROUPS.flatMap((group) => group.options),
])

const ORDER_LIST_COLUMN_STORAGE_KEY = 'storevis:orders-list-columns'

const ORDER_LIST_COLUMN_DEFS = [
  { key: 'code', label: 'Mã đơn' },
  { key: 'created_at', label: 'Thời gian' },
  { key: 'created_by', label: 'Người tạo' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'itemCount', label: 'Dòng hàng' },
  { key: 'profit', label: 'Lãi gộp' },
  { key: 'subtotal', label: 'Tổng tiền hàng' },
  { key: 'discount', label: 'Giảm giá' },
  { key: 'total', label: 'Tổng phải thu' },
]

const DEFAULT_ORDER_LIST_COLUMNS = ORDER_LIST_COLUMN_DEFS.map((column) => column.key)

function normalizeOrderListColumns(values = []) {
  const sourceValues = values instanceof Set ? Array.from(values) : Array.isArray(values) ? values : []
  const safeValues = sourceValues.map((value) => String(value).trim())
  const selected = new Set(safeValues)
  return ORDER_LIST_COLUMN_DEFS.map((column) => column.key).filter((key) => selected.has(key))
}

function getOrderListCell(order, columnKey, storesById, currentUser) {
  switch (columnKey) {
    case 'code':
      return {
        className: 'font-semibold',
        content: (
          <Link href={`/orders/${order.id}`} className="font-semibold text-gray-100 hover:text-gray-300">
            {order.code}
          </Link>
        ),
      }
    case 'created_at':
      return {
        className: 'whitespace-nowrap text-gray-300',
        content: formatDateTime(order.created_at),
      }
    case 'created_by':
      return {
        className: 'text-gray-300',
        content: getCreatorLabel(order, currentUser),
      }
    case 'customer':
      return {
        content: getCustomerName(order, storesById),
      }
    case 'itemCount':
      return {
        className: 'text-right text-gray-300',
        content: order.itemCount,
      }
    case 'subtotal':
      return {
        className: 'text-right font-semibold',
        content: formatMoney(getOrderSubtotal(order)),
      }
    case 'discount':
      return {
        className: 'text-right',
        content: formatMoney(getOrderDiscount(order)),
      }
    case 'total':
      return {
        className: 'text-right font-semibold',
        content: formatMoney(order.total_amount),
      }
    case 'profit':
      return {
        className: Number(order.gross_profit_amount || 0) >= 0
          ? 'text-right font-semibold text-green-200'
          : 'text-right font-semibold text-red-200',
        content: formatMoney(order.gross_profit_amount),
      }
    default:
      return { content: null }
  }
}

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateOnly(value) {
  if (!value) return '.../.../......'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '.../.../......'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getCustomerName(order, storesById) {
  const store = storesById.get(String(order.customer_store_id))
  if (!store) return 'Không tìm thấy khách hàng'
  return store.name || 'Chưa có tên'
}

function getOrderSubtotal(order) {
  return Number(order.subtotal_amount ?? order.total_amount ?? 0)
}

function getOrderDiscount(order) {
  return Number(order.discount_amount || 0)
}

function getCreatorLabel(order, currentUser) {
  const creatorId = String(order?.created_by || '').trim()
  if (!creatorId) return 'Không rõ'
  if (currentUser?.id && creatorId === String(currentUser.id)) return currentUser.email || 'Bạn'
  return `User ${creatorId.slice(0, 8)}`
}

function normalizeSearchText(value) {
  return removeVietnameseTones(String(value || '').trim()).replace(/\s+/g, ' ')
}

function estimateOrderPageSize() {
  if (typeof window === 'undefined') return 12
  const availableHeight = window.innerHeight - 430
  return Math.max(8, Math.min(24, Math.floor(availableHeight / 52)))
}

function getMatchingCustomerStoreIds(stores = [], query = '') {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  return (Array.isArray(stores) ? stores : [])
    .filter((store) => {
      const haystack = normalizeSearchText([
        store?.name,
        store?.phone,
        store?.ward,
        store?.district,
      ].filter(Boolean).join(' '))
      return haystack.includes(normalizedQuery)
    })
    .map((store) => String(store.id))
    .filter(Boolean)
}

export default function OrdersListPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersTotalCount, setOrdersTotalCount] = useState(0)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState('')
  const cancellingRef = useRef('')
  const [error, setError] = useState('')
  const [msgState, setMsgState] = useState(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilters, setStatusFilters] = useState(['active'])
  const [datePreset, setDatePreset] = useState('all')
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('all')
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
  const [expandedOrderId, setExpandedOrderId] = useState('')
  const [expandedOrderDetailId, setExpandedOrderDetailId] = useState('')
  const [orderDetailCache, setOrderDetailCache] = useState({})
  const [visibleOrderColumns, setVisibleOrderColumns] = useState(DEFAULT_ORDER_LIST_COLUMNS)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [columnPrefsReady, setColumnPrefsReady] = useState(false)
  const [orderPage, setOrderPage] = useState(1)
  const [orderPageSize, setOrderPageSize] = useState(12)
  const [orderPageInput, setOrderPageInput] = useState('1')
  const orderPageSizeOptions = [8, 12, 16, 24]
  const detailRequestIdRef = useRef(0)
  const columnMenuRef = useRef(null)
  const ordersRequestIdRef = useRef(0)
  const orderListSignatureRef = useRef('')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/login?from=/orders')
      return
    }
    if (!isAdmin) {
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updatePageSize = () => {
      setOrderPageSize((prev) => (prev === 12 ? estimateOrderPageSize() : prev))
    }

    updatePageSize()
    window.addEventListener('resize', updatePageSize)

    return () => window.removeEventListener('resize', updatePageSize)
  }, [])

  useEffect(() => {
    setOrderPageInput(String(orderPage))
  }, [orderPage])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, ORDER_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  const loadOrders = useCallback(async () => {
    const requestId = ++ordersRequestIdRef.current
    const nextSignature = JSON.stringify({
      query: debouncedQuery,
      statusFilters,
      datePreset,
      dateFrom,
      dateTo,
      creatorFilter,
      orderPageSize,
    })

    if (orderListSignatureRef.current !== nextSignature) {
      orderListSignatureRef.current = nextSignature
      if (orderPage !== 1) {
        setOrderPage(1)
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      const { stores: storeRows, orders: orderRows, totalCount } = await loadSalesOrdersIndexData({
        page: orderPage,
        pageSize: orderPageSize,
        query: debouncedQuery,
        statuses: statusFilters,
        datePreset,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        creatorId: creatorFilter === 'all' ? '' : creatorFilter,
      }, { matchCustomerStoreIds: getMatchingCustomerStoreIds })
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
      if (ordersRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [creatorFilter, datePreset, dateFrom, dateTo, debouncedQuery, orderPage, orderPageSize, statusFilters])

  const ensureProductsLoaded = useCallback(async () => {
    if (products.length > 0) return products
    const { products: productRows } = await loadProductManagementData()
    setProducts(productRows || [])
    return productRows || []
  }, [products])

  useEffect(() => {
    if (!pageReady) return
    loadOrders()
  }, [pageReady, loadOrders])

  useEffect(() => {
    if (!pageReady || typeof window === 'undefined') return

    const rawFlash = window.sessionStorage.getItem(ORDER_FLASH_MESSAGE_KEY)
    if (!rawFlash) return

    window.sessionStorage.removeItem(ORDER_FLASH_MESSAGE_KEY)
    try {
      const flash = JSON.parse(rawFlash)
      if (!flash?.text) return
      setMsgState({ type: flash.type || 'info', text: flash.text, show: true })
      const timer = window.setTimeout(() => {
        setMsgState((prev) => (prev?.text === flash.text ? { ...prev, show: false } : prev))
      }, 2500)
      return () => window.clearTimeout(timer)
    } catch {
      setMsgState({ type: 'success', text: rawFlash, show: true })
      const timer = window.setTimeout(() => {
        setMsgState((prev) => (prev?.text === rawFlash ? { ...prev, show: false } : prev))
      }, 2500)
      return () => window.clearTimeout(timer)
    }
  }, [pageReady])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const rawColumns = window.localStorage.getItem(ORDER_LIST_COLUMN_STORAGE_KEY)
      if (rawColumns) {
        const parsedColumns = JSON.parse(rawColumns)
        const nextColumns = normalizeOrderListColumns(parsedColumns)
        if (nextColumns.length > 0) {
          setVisibleOrderColumns(nextColumns)
        }
      }
    } catch {
      setVisibleOrderColumns(DEFAULT_ORDER_LIST_COLUMNS)
    } finally {
      setColumnPrefsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!columnPrefsReady || typeof window === 'undefined') return
    window.localStorage.setItem(ORDER_LIST_COLUMN_STORAGE_KEY, JSON.stringify(visibleOrderColumns))
  }, [columnPrefsReady, visibleOrderColumns])

  useEffect(() => {
    if (!columnMenuOpen) return

    const handlePointerDown = (event) => {
      if (columnMenuRef.current?.contains(event.target)) return
      setColumnMenuOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setColumnMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [columnMenuOpen])

  const storesById = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const visibleOrderColumnSet = useMemo(() => new Set(visibleOrderColumns), [visibleOrderColumns])
  const visibleOrderColumnDefs = useMemo(() => (
    ORDER_LIST_COLUMN_DEFS.filter((column) => visibleOrderColumnSet.has(column.key))
  ), [visibleOrderColumnSet])
  const tableColumnCount = 2 + visibleOrderColumnDefs.length
  const tableMinWidth = Math.max(700, 140 + visibleOrderColumnDefs.length * 90)
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const filteredOrders = orders
  const summary = useMemo(() => summarizeSalesOrders(filteredOrders), [filteredOrders])
  const creatorOptions = useMemo(() => (
    Array.from(new Set(orders.map((order) => String(order.created_by || '').trim()).filter(Boolean)))
      .map((creatorId) => {
        const sampleOrder = orders.find((order) => String(order.created_by || '') === creatorId)
        return {
          id: creatorId,
          label: getCreatorLabel(sampleOrder, user),
        }
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'vi'))
  ), [orders, user])
  const selectedOrders = useMemo(() => (
    selectedOrderIds
      .map((orderId) => orders.find((order) => String(order.id) === String(orderId)))
      .filter(Boolean)
  ), [orders, selectedOrderIds])
  const expandedOrderDetail = expandedOrderId ? orderDetailCache[expandedOrderId] || null : null
  const expandedOrderInvoice = useMemo(() => {
    if (!expandedOrderDetail) return null
    return buildSalesOrderInvoiceModel({
      order: expandedOrderDetail.order,
      customer: storesById.get(String(expandedOrderDetail.order?.customer_store_id)),
      items: expandedOrderDetail.items,
      productsById,
    })
  }, [expandedOrderDetail, productsById, storesById])
  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderIds.includes(String(order.id)))
  const displayOrdersTotalCount = ordersTotalCount > 0 ? ordersTotalCount : filteredOrders.length
  const totalPages = Math.max(1, Math.ceil(displayOrdersTotalCount / orderPageSize))
  const visibleOrderStart = displayOrdersTotalCount === 0 ? 0 : ((orderPage - 1) * orderPageSize) + 1
  const visibleOrderEnd = Math.min(displayOrdersTotalCount, orderPage * orderPageSize)

  const toggleStatusFilter = (status) => {
    setStatusFilters((prev) => (
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status]
    ))
  }

  const toggleOrderSelection = (orderId) => {
    const safeOrderId = String(orderId)
    setSelectedOrderIds((prev) => (
      prev.includes(safeOrderId)
        ? prev.filter((item) => item !== safeOrderId)
        : [...prev, safeOrderId]
    ))
  }

  const toggleAllFilteredSelection = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredOrders.map((order) => String(order.id)))
      setSelectedOrderIds((prev) => prev.filter((orderId) => !filteredIds.has(orderId)))
      return
    }

    setSelectedOrderIds((prev) => Array.from(new Set([
      ...prev,
      ...filteredOrders.map((order) => String(order.id)),
    ])))
  }

  const toggleOrderListColumn = useCallback((columnKey) => {
    setVisibleOrderColumns((prev) => {
      const selected = new Set(prev)
      if (selected.has(columnKey)) {
        if (prev.length <= 1) return prev
        selected.delete(columnKey)
      } else {
        selected.add(columnKey)
      }
      return normalizeOrderListColumns(selected)
    })
  }, [])

  const resetOrderListColumns = useCallback(() => {
    setVisibleOrderColumns(DEFAULT_ORDER_LIST_COLUMNS)
  }, [])

  const goToPreviousPage = useCallback(() => {
    setOrderPage((prev) => Math.max(1, prev - 1))
  }, [])

  const goToFirstPage = useCallback(() => {
    setOrderPage(1)
  }, [])

  const goToNextPage = useCallback(() => {
    setOrderPage((prev) => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const goToLastPage = useCallback(() => {
    setOrderPage(totalPages)
  }, [totalPages])

  const commitPageInput = useCallback(() => {
    const nextPage = Math.max(1, Math.min(totalPages, Number(orderPageInput) || 1))
    setOrderPage(nextPage)
    setOrderPageInput(String(nextPage))
  }, [orderPageInput, totalPages])

  const handleToggleOrderDetail = useCallback(async (order) => {
    const orderId = String(order?.id || '').trim()
    if (!orderId) return

    if (expandedOrderId === orderId) {
      setExpandedOrderId('')
      return
    }

    setExpandedOrderId(orderId)

    if (orderDetailCache[orderId]) return

    const requestId = ++detailRequestIdRef.current
    setExpandedOrderDetailId(orderId)
    setError('')

    try {
      const [{ detail }, productRows] = await Promise.all([
        loadSalesOrderDetailData(orderId),
        ensureProductsLoaded(),
      ])

      if (detailRequestIdRef.current !== requestId) return

      setProducts(productRows || [])
      setOrderDetailCache((prev) => ({
        ...prev,
        [orderId]: detail,
      }))
    } catch (err) {
      if (detailRequestIdRef.current === requestId) {
        setError(err?.operatorMessage || err?.message || 'Không tải được chi tiết đơn hàng.')
      }
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setExpandedOrderDetailId('')
      }
    }
  }, [ensureProductsLoaded, expandedOrderId, orderDetailCache])

  const handleCancelOrder = async (order) => {
    if (!order?.id || order.status === 'cancelled' || cancellingId || cancellingRef.current) return
    if (!window.confirm(`Hủy đơn ${order.code}? Tồn kho sẽ được cộng lại theo các dòng hàng trong đơn.`)) return

    cancellingRef.current = order.id
    setCancellingId(order.id)
    setError('')
    try {
      await cancelSalesOrderById(order.id, user?.id || null)
      await loadOrders()
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
        Promise.all(selectedOrders.map((order) => loadSalesOrderDetailData(order.id).then((result) => result.detail))),
      ])

      const productMap = new Map((productRows || []).map((p) => [String(p.id), p]))
      const quantityMap = new Map()

      for (const detail of detailRows) {
        if (!detail?.items) continue
        for (const item of detail.items) {
          const pid = String(item.product_id)
          const product = productMap.get(pid)
          const name = product?.name || item.product_name || pid
          const qty = Number(item.quantity || 0)
          quantityMap.set(name, (quantityMap.get(name) || 0) + qty)
        }
      }

      const sorted = Array.from(quantityMap.entries())
        .map(([productName, quantity]) => ({ productName, quantity }))
        .sort((a, b) => b.quantity - a.quantity)

      setConsolidationData(sorted)
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
        Promise.all(selectedOrders.map((order) => loadSalesOrderDetailData(order.id).then((result) => result.detail))),
      ])
      const nextInvoices = detailRows.map((detail) => {
        const customer = storesById.get(String(detail.order.customer_store_id))
        return buildSalesOrderInvoiceModel({
          order: detail.order,
          customer,
          items: detail.items,
          productsById: new Map((productRows || []).map((product) => [String(product.id), product])),
        })
      })
      setPrintInvoices(nextInvoices)
      try {
        await markOrdersPrinted(selectedOrders.map((o) => String(o.id)))
        setOrders((prev) => prev.map((o) => (selectedOrderIds.includes(String(o.id)) ? { ...o, is_printed: true } : o)))
      } catch (err) {
        console.error('[print_mark_error]', err)
      }
      window.setTimeout(() => {
        handleBatchPrint()
        setPrinting(false)
      }, 100)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không chuẩn bị được dữ liệu in đơn.')
      setPrinting(false)
    }
  }

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Danh sách đơn hàng - NPP Hà Công</title>
        <style>{`
          .print-hide { display: none; }
        `}</style>
      </Head>

      <main className="h-[calc(100svh-3.5rem)] overflow-hidden bg-black text-gray-100 print:bg-white print:text-black sm:h-[calc(100dvh-3rem)]">
        {msgState ? <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg> : null}
        <div className={`${layoutClasses.shell} orders-list-screen-only flex h-full min-h-0 flex-col gap-3 py-3`}>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="relative flex min-h-0 flex-col overflow-hidden rounded-md border border-gray-800 bg-gray-950 p-3">
              <h1 className="mb-4 text-2xl font-bold">Đơn hàng</h1>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-100">Thời gian</h2>
                  <button
                    type="button"
                    className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-gray-700 bg-gray-900 px-3 text-left text-base text-gray-100 hover:bg-gray-800"
                    onClick={() => setDateMenuOpen((prev) => !prev)}
                  >
                    <span>{DATE_PRESET_LABELS[datePreset] || (datePreset === 'custom' ? 'Tùy chỉnh' : 'Tất cả')}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    type="button"
                    className="h-11 w-full rounded-md border border-gray-800 bg-gray-900 px-3 text-left text-base text-gray-300 hover:bg-gray-800"
                    onClick={() => {
                      setDatePreset('all')
                      setDateFrom('')
                      setDateTo('')
                      setDateMenuOpen(false)
                    }}
                  >
                    Tất cả thời gian
                  </button>
                  {dateMenuOpen && (
                    <div className="fixed left-4 right-4 top-24 z-50 grid gap-4 rounded-md border border-gray-800 bg-gray-950 p-4 shadow-2xl shadow-black/50 md:grid-cols-5 xl:left-[280px] xl:right-8">
                      {DATE_PRESET_GROUPS.map((group) => (
                        <section key={group.title} className="space-y-2">
                          <h3 className="text-base font-semibold text-gray-100">{group.title}</h3>
                          {group.options.map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              className={`block h-10 rounded-full border px-4 text-base ${datePreset === value ? 'border-gray-100 bg-gray-100 text-gray-950' : 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'}`}
                              onClick={() => {
                                const { dateFrom: df, dateTo: dt } = getPresetDateValues(value)
                                setDateFrom(df)
                                setDateTo(dt)
                                setDatePreset(value)
                                setDateMenuOpen(false)
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </section>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-400">Khoảng thời gian tùy chỉnh</h3>
                    <div className="space-y-2">
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type="date"
                          value={dateFrom}
                          max={dateTo || undefined}
                          onChange={(e) => {
                            setDateFrom(e.target.value)
                            setDatePreset('custom')
                          }}
                          className="h-10 w-full rounded-md border border-gray-700 bg-gray-900 pl-8 pr-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 [color-scheme:dark]"
                          placeholder="Từ ngày"
                        />
                      </div>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type="date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => {
                            setDateTo(e.target.value)
                            setDatePreset('custom')
                          }}
                          className="h-10 w-full rounded-md border border-gray-700 bg-gray-900 pl-8 pr-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 [color-scheme:dark]"
                          placeholder="Đến ngày"
                        />
                      </div>
                    </div>
                    {datePreset === 'custom' && dateFrom && dateTo && (
                      <div className="rounded-md border border-blue-800 bg-blue-950/20 px-3 py-2 text-xs text-blue-300">
                        Đang lọc theo khoảng thời gian tùy chỉnh
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-100">Trạng thái</h2>
                  {[
                    ['active', 'Hiệu lực'],
                    ['cancelled', 'Đã hủy'],
                  ].map(([value, label]) => (
                    <label key={value} className="flex h-11 cursor-pointer items-center gap-3 rounded-md border border-gray-800 bg-gray-900 px-3 text-base text-gray-100 hover:bg-gray-800">
                      <input
                        type="checkbox"
                        checked={statusFilters.includes(value)}
                        onChange={() => toggleStatusFilter(value)}
                        className="h-4 w-4 accent-gray-100"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </section>

                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-gray-100">Người tạo</h2>
                  <select
                    className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                    value={creatorFilter}
                    onChange={(event) => setCreatorFilter(event.target.value)}
                  >
                    <option value="all">Tất cả người tạo</option>
                    {creatorOptions.map((creator) => (
                      <option key={creator.id} value={creator.id}>{creator.label}</option>
                    ))}
                  </select>
                </section>

                <section className="rounded-md border border-gray-800 bg-gray-900 p-3">
                  <h2 className="mb-3 text-base font-semibold text-gray-100">Tổng quan</h2>
                  <div className="space-y-2 text-base">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400">Hiển thị</span>
                      <span className="font-semibold text-gray-100">{filteredOrders.length}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400">Hiệu lực</span>
                      <span className="font-semibold text-gray-100">{summary.activeOrders}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400">Đã hủy</span>
                      <span className="font-semibold text-gray-100">{summary.cancelled}</span>
                    </div>
                  </div>
                </section>
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden gap-3">
              <div className="rounded-md border border-gray-800 bg-gray-950 p-2">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,520px)_1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                    <Input
                      className="h-11 border-gray-700 bg-gray-900 pl-10"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm mã đơn, khách hàng hoặc SĐT"
                    />
                  </div>
                  <div />
                  <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                    {selectedOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedOrdersModalOpen(true)}
                        className="inline-flex h-11 items-center gap-1.5 rounded-md border border-blue-800 bg-blue-950/40 px-3 text-sm font-medium text-blue-300 hover:bg-blue-950/60"
                      >
                        <ListChecks className="h-4 w-4" />
                        <span>Đã chọn <strong>{selectedOrders.length}</strong></span>
                      </button>
                    )}
                    <Button asChild>
                      <Link href="/orders/new"><Plus className="h-4 w-4" /> Lên đơn</Link>
                    </Button>
                    <Button type="button" variant="outline" onClick={handleShowConsolidation} disabled={selectedOrders.length === 0 || consolidating}>
                      <Table2 className="h-4 w-4" /> {consolidating ? 'Đang tổng hợp...' : 'Tổng hợp'}
                    </Button>
                    <Button type="button" variant="outline" onClick={handlePrintSelectedOrders} disabled={selectedOrders.length === 0 || printing}>
                      <Printer className="h-4 w-4" /> {printing ? 'Đang chuẩn bị...' : `In đơn${selectedOrders.length ? ` (${selectedOrders.length})` : ''}`}
                    </Button>
                    <div ref={columnMenuRef} className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setColumnMenuOpen((prev) => !prev)}
                        aria-expanded={columnMenuOpen}
                        aria-haspopup="menu"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${columnMenuOpen ? 'rotate-180' : ''}`} />
                        Cột hiển thị
                      </Button>
                      {columnMenuOpen && (
                        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-md border border-gray-800 bg-gray-950 p-3 shadow-2xl shadow-black/60">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-100">Cột hiển thị</p>
                              <p className="text-xs text-gray-400">Cột chọn và thao tác luôn luôn hiện.</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={resetOrderListColumns}>
                              Mặc định
                            </Button>
                          </div>
                          <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1">
                            {ORDER_LIST_COLUMN_DEFS.map((column) => {
                              const isChecked = visibleOrderColumnSet.has(column.key)
                              const isLastVisible = visibleOrderColumns.length <= 1 && isChecked
                              return (
                                <label key={column.key} className="flex items-center gap-3 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isLastVisible}
                                    onChange={() => toggleOrderListColumn(column.key)}
                                    className="h-4 w-4 accent-gray-100 disabled:opacity-50"
                                  />
                                  <span>{column.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>
              )}

            {/* Tổng hợp hàng hóa modal */}
            <Dialog open={consolidationModalOpen} onOpenChange={setConsolidationModalOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader className="border-b border-gray-800 pb-3">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-base">
                      Tổng hợp hàng hóa — <strong>{selectedOrders.length}</strong> đơn
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleConsolidationPrint}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs font-medium text-gray-200 hover:bg-gray-800"
                      >
                        <Printer className="h-3.5 w-3.5" /> In
                      </button>
                      <DialogClose className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100">
                        <X className="h-4 w-4" />
                      </DialogClose>
                    </div>
                  </div>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-auto px-4 pb-4">
                  {consolidationData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">Không có dữ liệu hàng hóa để tổng hợp.</p>
                  ) : (
                    <>
                      <p className="mb-3 text-xs text-gray-400">
                        Tổng số mặt hàng: <strong className="text-gray-200">{consolidationData.length}</strong>
                        {' · '}Tổng số lượng: <strong className="text-gray-200">{consolidationData.reduce((s, r) => s + r.quantity, 0)}</strong>
                      </p>
                      <div className="overflow-hidden rounded-lg border border-gray-700">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-800 text-gray-200">
                              <th className="w-12 border-r border-gray-700 px-3 py-2.5 text-center font-semibold">STT</th>
                              <th className="border-r border-gray-700 px-3 py-2.5 text-left font-semibold">Tên sản phẩm</th>
                              <th className="w-28 px-3 py-2.5 text-right font-semibold">Số lượng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consolidationData.map((row, index) => (
                              <tr key={row.productName} className="border-t border-gray-800 transition hover:bg-gray-900/50">
                                <td className="border-r border-gray-800 px-3 py-2.5 text-center text-gray-400">{index + 1}</td>
                                <td className="border-r border-gray-800 px-3 py-2.5 font-medium text-gray-100">{row.productName}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-gray-100">{row.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
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
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-base">
                      Đã chọn <strong>{selectedOrders.length}</strong> đơn
                    </DialogTitle>
                    <DialogClose className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-100">
                      <X className="h-4 w-4" />
                    </DialogClose>
                  </div>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
                  {selectedOrders.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">Chưa chọn đơn hàng nào.</p>
                  ) : (
                    <div className="divide-y divide-gray-900">
                      {selectedOrders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-100">{order.code}</p>
                            <p className="text-xs text-gray-400">
                              Khách hàng: {getOrderListCell(order, 'customer', storesById, user).content}
                            </p>
                            <p className="text-xs text-gray-400">Số tiền: {formatMoney(order.total_amount)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleOrderSelection(order.id)}
                            className="ml-3 shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-red-950/30 hover:text-red-400"
                            aria-label={`Bỏ chọn ${order.code}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full border-collapse text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
                    <thead className="sticky top-0 z-10 bg-gray-900 text-xs text-gray-300">
                      <tr className="border-b border-gray-800">
                        <th className="px-3 py-2 text-left font-semibold">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleAllFilteredSelection}
                            aria-label="Chọn tất cả đơn đang hiển thị"
                            className="h-3.5 w-3.5 accent-gray-100"
                          />
                        </th>
                        {visibleOrderColumnDefs.map((column) => (
                          <th
                            key={column.key}
                            className={column.key === 'itemCount' || column.key === 'subtotal' || column.key === 'discount' || column.key === 'total' || column.key === 'profit'
                              ? 'px-3 py-2 text-right font-semibold'
                              : 'px-3 py-2 text-left font-semibold'}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="px-2 py-1.5 text-center font-semibold">In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-900">
                            <td className="px-2 py-1.5">
                              <Skeleton className="h-3.5 w-3.5" />
                            </td>
                            {visibleOrderColumnDefs.filter(col => col.key !== 'status').map((col) => {
                              if (col.key === 'code') {
                                return (
                                  <td key={col.key} className="px-3 py-2">
                                    <Skeleton className="h-3.5 w-24" />
                                  </td>
                                )
                              }
                              if (col.key === 'created_at') {
                                return (
                                  <td key={col.key} className="px-3 py-2">
                                    <Skeleton className="h-3.5 w-32" />
                                  </td>
                                )
                              }
                              if (col.key === 'customer') {
                                return (
                                  <td key={col.key} className="px-3 py-2">
                                    <Skeleton className="h-3.5 w-36 max-w-full" />
                                  </td>
                                )
                              }
                              if (col.key === 'created_by') {
                                return (
                                  <td key={col.key} className="px-3 py-2">
                                    <Skeleton className="h-3.5 w-20" />
                                  </td>
                                )
                              }
                              const right = col.key === 'itemCount' || col.key === 'subtotal' || col.key === 'discount' || col.key === 'total' || col.key === 'profit'
                              const moneyWidth = col.key === 'total' ? 'w-24' : col.key === 'profit' ? 'w-20' : 'w-[88px]'
                              return (
                                <td key={col.key} className="px-3 py-2">
                                  <Skeleton className={`h-3.5 ${right ? 'ml-auto ' : ''}${moneyWidth}`} />
                                </td>
                              )
                            })}
                            <td className="px-2 py-1.5">
                              <Skeleton className="ml-auto h-4 w-12 rounded-full" />
                            </td>
                          </tr>
                        ))
                      ) : filteredOrders.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-sm text-gray-400" colSpan={tableColumnCount}>Chưa có đơn hàng phù hợp.</td>
                        </tr>
                      ) : filteredOrders.map((order) => {
                        const isCancelled = order.status === 'cancelled'
                        const orderId = String(order.id)
                        const isExpanded = expandedOrderId === orderId
                        const detailLoading = expandedOrderDetailId === orderId
                        const cachedDetail = orderDetailCache[orderId] || null

                        return (
                          <Fragment key={order.id}>
                            <tr
                              className={`border-b border-gray-900 text-gray-100 transition last:border-b-0 hover:bg-gray-900/80 ${isExpanded ? 'bg-gray-900/80' : ''}`}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              title="Bấm để xem chi tiết đơn hàng"
                              onClick={() => handleToggleOrderDetail(order)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  handleToggleOrderDetail(order)
                                }
                              }}
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedOrderIds.includes(orderId)}
                                    onChange={() => toggleOrderSelection(order.id)}
                                    aria-label={`Chọn đơn ${order.code}`}
                                    className="h-3.5 w-3.5 accent-gray-100"
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </div>
                              </td>
                              {visibleOrderColumnDefs.map((column) => {
                                const cell = getOrderListCell(order, column.key, storesById, user)
                                return (
                                  <td key={column.key} className={`px-3 py-2 ${cell.className || ''}`}>
                                    {cell.content}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-1.5 text-right">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${order.is_printed ? 'bg-gray-800 text-gray-400' : 'border border-dashed border-gray-700 text-gray-500'}`}>
                                  {order.is_printed ? 'Đã in' : 'Chưa in'}
                                </span>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="border-b border-gray-900 bg-gray-950/80">
                                <td className="p-4" colSpan={tableColumnCount}>
                                  {detailLoading && !cachedDetail ? (
                                    <div className="rounded-md border border-gray-800 bg-gray-900 px-4 py-5 text-gray-400">Đang tải chi tiết đơn hàng...</div>
                                  ) : expandedOrderInvoice ? (
                                    <div className="space-y-4 rounded-md border border-gray-800 bg-gray-950 p-4 text-gray-100">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <h3 className="text-xl font-bold">Khách hàng: {expandedOrderInvoice.customerName}</h3>
                                          <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(expandedOrderInvoice.order.created_at)}</p>
                                          <p className="text-sm text-gray-500">{[expandedOrderInvoice.customerPhone ? `SĐT: ${expandedOrderInvoice.customerPhone}` : '', expandedOrderInvoice.customerAddress].filter(Boolean).join(' · ')}</p>
                                        </div>
                                      </div>

                                      <div className="overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                                        <div className="overflow-x-auto">
                                          <table className="w-full border-collapse text-sm">
                                            <thead className="bg-gray-900 text-gray-300">
                                              <tr className="border-b border-gray-800">
                                                <th className="px-4 py-3 text-left font-semibold">Hàng hóa</th>
                                                <th className="w-16 px-4 py-3 text-right font-semibold">SL</th>
                                                <th className="w-28 px-4 py-3 text-right font-semibold">Đơn giá</th>
                                                <th className="w-32 px-4 py-3 text-right font-semibold">Thành tiền</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {expandedOrderInvoice.lines.map((line) => (
                                                <tr key={line.id} className="border-b border-gray-900 last:border-b-0">
                                                  <td className="px-4 py-3">
                                                    <p className="font-semibold text-gray-100">{line.productName}</p>
                                                    <p className="text-xs text-gray-400">{line.sku || '—'} · {line.unitName}</p>
                                                  </td>
                                                  <td className="px-4 py-3 text-right text-gray-300">{formatInventoryQuantity(line.quantity)}</td>
                                                  <td className="px-4 py-3 text-right text-gray-300">{formatMoney(line.unitPrice)}</td>
                                                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(line.lineTotal)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>

                                    {/* Bottom: ghi chú + tổng kết */}
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                      <div className="min-w-0 flex-1">
                                        {expandedOrderInvoice.order.note && <p className="text-sm text-amber-400">Ghi chú: {expandedOrderInvoice.order.note}</p>}
                                      </div>
                                      <div className="shrink-0 rounded-md border border-gray-800 bg-gray-900 px-5 py-3">
                                        {Number(expandedOrderInvoice.order.discount_amount) > 0 && (
                                          <div className="flex items-baseline justify-between gap-8 text-sm text-gray-400">
                                            <span>Giảm giá</span>
                                            <span className="text-gray-300">-{formatMoney(expandedOrderInvoice.order.discount_amount)}</span>
                                          </div>
                                        )}
                                        <div className={`flex items-baseline justify-between gap-8 ${Number(expandedOrderInvoice.order.discount_amount) > 0 ? 'mt-2' : ''}`}>
                                          <span className="text-base font-bold text-gray-100">Khách cần trả</span>
                                          <span className="text-xl font-bold">{formatMoney(expandedOrderInvoice.order.total_amount)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-md border border-gray-800 bg-gray-900 px-4 py-5 text-gray-400">Không tải được chi tiết đơn hàng.</div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-auto grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 border-t border-gray-800 px-3 py-2 text-sm text-gray-400 lg:gap-5">
                  <div className="flex items-center gap-2 whitespace-nowrap self-start pt-0.5">
                    <span>Hiển thị</span>
                    <select
                      className="h-7 rounded-md border border-gray-700 bg-gray-900 px-2 text-sm text-gray-100"
                      value={orderPageSize}
                      onChange={(event) => setOrderPageSize(Number(event.target.value) || 12)}
                    >
                      {orderPageSizeOptions.map((size) => (
                        <option key={size} value={size}>{size} dòng</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={orderPageInput}
                      onChange={(event) => setOrderPageInput(event.target.value)}
                      onBlur={commitPageInput}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitPageInput()
                        }
                      }}
                      aria-label="Trang hiện tại"
                      className="h-7 w-16 text-center text-sm"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-3 self-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={goToFirstPage} disabled={orderPage <= 1} className="h-7 w-7 p-0">
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={goToPreviousPage} disabled={orderPage <= 1} className="h-7 w-7 p-0">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={goToNextPage} disabled={orderPage >= totalPages} className="h-7 w-7 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={goToLastPage} disabled={orderPage >= totalPages} className="h-7 w-7 p-0">
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="self-start pt-0.5 text-right text-sm text-gray-400">
                    {displayOrdersTotalCount === 0
                      ? '0 - 0 trong 0 giao dịch'
                      : `${visibleOrderStart} - ${visibleOrderEnd} trong ${displayOrdersTotalCount} giao dịch`}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="orders-list-print-only hidden bg-white text-gray-950 print:bg-white">
          {printInvoices.map((invoice) => (
            <section key={invoice.order.id} className="orders-list-print-page mx-auto max-w-[148mm]">
              <InvoicePrintContent invoice={invoice} order={invoice.order} userEmail={user?.email} />
            </section>
          ))}
        </div>
      </main>

      {/* ===== BATCH PRINT CONTENT (used by react-to-print) ===== */}
      <div className="print-hide">
        {printInvoices.length > 0 && (
          <BatchInvoicePrintContent ref={batchPrintRef} invoices={printInvoices} userEmail={user?.email} />
        )}
      </div>

      {/* ===== CONSOLIDATION PRINT CONTENT (used by react-to-print) ===== */}
      <div className="print-hide">
        {consolidationData.length > 0 && (
          <ConsolidationPrintContent
            ref={consolidationPrintRef}
            selectedOrders={selectedOrders}
            consolidationData={consolidationData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            userEmail={user?.email}
          />
        )}
      </div>
    </>
  )
}
