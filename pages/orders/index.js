import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Plus, Printer, Search, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { getOrRefreshStores } from '@/lib/storeCache'
import { cancelSalesOrder, formatMoney, getSalesOrderDetail, listProductsWithStock, listSalesOrders } from '@/api/inventory/inventory-client'
import {
  buildSalesOrderInvoiceModel,
  formatInventoryQuantity,
  getOrderInventoryWorkbenchClasses,
  summarizeSalesOrders,
} from '@/helper/orderInventoryFlow'

const ORDER_FLASH_MESSAGE_KEY = 'storevis:order-flash-message'
const ORDER_SEARCH_DEBOUNCE_MS = 300

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
  { key: 'subtotal', label: 'Tổng tiền hàng' },
  { key: 'discount', label: 'Giảm giá' },
  { key: 'total', label: 'Tổng phải thu' },
  { key: 'profit', label: 'Lãi gộp' },
  { key: 'status', label: 'Trạng thái' },
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
    case 'status':
      return {
        content: (
          <span className={`inline-flex rounded-md border px-3 py-1 text-sm ${order.status === 'cancelled' ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-green-900 bg-green-950/30 text-green-200'}`}>
            {order.status === 'cancelled' ? 'Đã hủy' : 'Hiệu lực'}
          </span>
        ),
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
  const [error, setError] = useState('')
  const [msgState, setMsgState] = useState(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilters, setStatusFilters] = useState(['active', 'cancelled'])
  const [datePreset, setDatePreset] = useState('all')
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [printInvoices, setPrintInvoices] = useState([])
  const [printing, setPrinting] = useState(false)
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
      const storeRows = await getOrRefreshStores()
      if (ordersRequestIdRef.current !== requestId) return
      setStores(storeRows || [])

      const matchingCustomerStoreIds = getMatchingCustomerStoreIds(storeRows || [], debouncedQuery)
      const { orders: orderRows, totalCount } = await listSalesOrders({
        page: orderPage,
        pageSize: orderPageSize,
        query: debouncedQuery,
        statuses: statusFilters,
        datePreset,
        creatorId: creatorFilter === 'all' ? '' : creatorFilter,
        matchingCustomerStoreIds,
      })

      if (ordersRequestIdRef.current !== requestId) return

      setOrders(orderRows || [])
      setOrdersTotalCount(Number(totalCount || 0))
    } catch (err) {
      setError(err?.message || 'Không tải được danh sách đơn hàng.')
      setOrders([])
      setOrdersTotalCount(0)
    } finally {
      if (ordersRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [creatorFilter, datePreset, debouncedQuery, orderPage, orderPageSize, statusFilters])

  const ensureProductsLoaded = useCallback(async () => {
    if (products.length > 0) return products
    const productRows = await listProductsWithStock()
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
  const tableMinWidth = Math.max(980, 240 + visibleOrderColumnDefs.length * 140)
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
  const moneySummary = useMemo(() => {
    const activeOrders = filteredOrders.filter((order) => order.status !== 'cancelled')
    return {
      subtotal: activeOrders.reduce((sum, order) => sum + getOrderSubtotal(order), 0),
      discount: activeOrders.reduce((sum, order) => sum + getOrderDiscount(order), 0),
      total: activeOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      profit: activeOrders.reduce((sum, order) => sum + Number(order.gross_profit_amount || 0), 0),
    }
  }, [filteredOrders])

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
      const [detail, productRows] = await Promise.all([
        getSalesOrderDetail(orderId),
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
        setError(err?.message || 'Không tải được chi tiết đơn hàng.')
      }
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setExpandedOrderDetailId('')
      }
    }
  }, [ensureProductsLoaded, expandedOrderId, orderDetailCache])

  const handleCancelOrder = async (order) => {
    if (!order?.id || order.status === 'cancelled' || cancellingId) return
    if (!window.confirm(`Hủy đơn ${order.code}? Tồn kho sẽ được cộng lại theo các dòng hàng trong đơn.`)) return

    setCancellingId(order.id)
    setError('')
    try {
      await cancelSalesOrder(order.id, user?.id || null)
      await loadOrders()
    } catch (err) {
      setError(err?.message || 'Không hủy được đơn hàng.')
    } finally {
      setCancellingId('')
    }
  }

  const handlePrintSelectedOrders = async () => {
    if (printing || selectedOrders.length === 0) return
    setPrinting(true)
    setError('')
    try {
      const [productRows, detailRows] = await Promise.all([
        ensureProductsLoaded(),
        Promise.all(selectedOrders.map((order) => getSalesOrderDetail(order.id))),
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
      window.setTimeout(() => window.print(), 100)
    } catch (err) {
      setError(err?.message || 'Không chuẩn bị được dữ liệu in đơn.')
    } finally {
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
          @media print {
            @page { size: A5 portrait; margin: 8mm; }
            body { background: #fff !important; }
            nav, .orders-list-screen-only { display: none !important; }
            .orders-list-print-only { display: block !important; }
            .orders-list-print-page { break-after: page; page-break-after: always; }
            .orders-list-print-page:last-child { break-after: auto; page-break-after: auto; }
          }
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
                    <span>{DATE_PRESET_LABELS[datePreset] || 'Tất cả'}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    type="button"
                    className="h-11 w-full rounded-md border border-gray-800 bg-gray-900 px-3 text-left text-base text-gray-300 hover:bg-gray-800"
                    onClick={() => {
                      setDatePreset('all')
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
                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    <Button asChild>
                      <Link href="/orders/new"><Plus className="h-4 w-4" /> Lên đơn</Link>
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

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full border-collapse text-base" style={{ minWidth: `${tableMinWidth}px` }}>
                    <thead className="sticky top-0 z-10 bg-gray-900 text-sm text-gray-300">
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-left font-semibold">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleAllFilteredSelection}
                            aria-label="Chọn tất cả đơn đang hiển thị"
                            className="h-4 w-4 accent-gray-100"
                          />
                        </th>
                        {visibleOrderColumnDefs.map((column) => (
                          <th
                            key={column.key}
                            className={column.key === 'itemCount' || column.key === 'subtotal' || column.key === 'discount' || column.key === 'total' || column.key === 'profit'
                              ? 'px-4 py-3 text-right font-semibold'
                              : 'px-4 py-3 text-left font-semibold'}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-800 bg-gray-950 font-bold text-gray-100">
                        <td className="px-4 py-3" colSpan={tableColumnCount}>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                            <span>Tổng {filteredOrders.length} đơn</span>
                            <span>{summary.activeOrders} hiệu lực</span>
                            <span>{summary.cancelled} đã hủy</span>
                            <span>{formatMoney(moneySummary.subtotal)} tiền hàng</span>
                            <span>{formatMoney(moneySummary.discount)} giảm giá</span>
                            <span>{formatMoney(moneySummary.total)} phải thu</span>
                            <span>{formatMoney(moneySummary.profit)} lãi gộp</span>
                          </div>
                        </td>
                      </tr>

                      {loading ? (
                        <tr>
                          <td className="px-4 py-5 text-gray-400" colSpan={tableColumnCount}>Đang tải đơn hàng...</td>
                        </tr>
                      ) : filteredOrders.length === 0 ? (
                        <tr>
                          <td className="px-4 py-5 text-gray-400" colSpan={tableColumnCount}>Chưa có đơn hàng phù hợp.</td>
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
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label={isExpanded ? `Thu gọn đơn ${order.code}` : `Mở rộng đơn ${order.code}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleToggleOrderDetail(order)
                                    }}
                                  >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  <input
                                    type="checkbox"
                                    checked={selectedOrderIds.includes(orderId)}
                                    onChange={() => toggleOrderSelection(order.id)}
                                    aria-label={`Chọn đơn ${order.code}`}
                                    className="h-4 w-4 accent-gray-100"
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </div>
                              </td>
                              {visibleOrderColumnDefs.map((column) => {
                                const cell = getOrderListCell(order, column.key, storesById, user)
                                return (
                                  <td key={column.key} className={`px-4 py-3 ${cell.className || ''}`}>
                                    {cell.content}
                                  </td>
                                )
                              })}
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  {!isCancelled && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-red-900/60 text-red-300 hover:bg-red-950/30"
                                      disabled={cancellingId === order.id}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        handleCancelOrder(order)
                                      }}
                                    >
                                      <XCircle className="h-4 w-4" /> {cancellingId === order.id ? 'Đang hủy...' : 'Hủy'}
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="border-b border-gray-900 bg-gray-950/80">
                                <td className="px-4 pb-5 pt-0" colSpan={tableColumnCount}>
                                  {detailLoading && !cachedDetail ? (
                                    <div className="rounded-md border border-gray-800 bg-gray-900 px-4 py-5 text-gray-400">Đang tải chi tiết đơn hàng...</div>
                                  ) : expandedOrderInvoice ? (
                                    <div className="space-y-4 rounded-md border border-gray-800 bg-gray-950 p-4 text-gray-100">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-xl font-bold">{expandedOrderInvoice.order.code}</h3>
                                            <span className={`inline-flex rounded-md border px-3 py-1 text-sm ${isCancelled ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-green-900 bg-green-950/30 text-green-200'}`}>
                                              {isCancelled ? 'Đã hủy' : 'Hiệu lực'}
                                            </span>
                                          </div>
                                          <p className="mt-1 text-sm text-gray-400">{formatDateTime(expandedOrderInvoice.order.created_at)} • {getCreatorLabel(expandedOrderInvoice.order, user)}</p>
                                          <p className="mt-2 text-base font-semibold">{expandedOrderInvoice.customerName}</p>
                                          <p className="text-sm text-gray-400">{expandedOrderInvoice.customerPhone}</p>
                                          <p className="text-sm text-gray-400">{expandedOrderInvoice.customerAddress}</p>
                                        </div>
                                        <div className="grid min-w-[260px] gap-2 rounded-md border border-gray-800 bg-gray-900 p-3 text-sm">
                                          <div className="flex justify-between gap-3"><span className="text-gray-400">Tạm tính</span><span className="font-semibold">{formatMoney(expandedOrderInvoice.order.subtotal_amount)}</span></div>
                                          <div className="flex justify-between gap-3"><span className="text-gray-400">Giảm giá</span><span className="font-semibold">{formatMoney(expandedOrderInvoice.order.discount_amount)}</span></div>
                                          <div className="flex justify-between gap-3"><span className="text-gray-400">Tổng phải thu</span><span className="font-semibold">{formatMoney(expandedOrderInvoice.order.total_amount)}</span></div>
                                          <div className="flex justify-between gap-3"><span className="text-gray-400">Lãi gộp</span><span className={Number(expandedOrderInvoice.order.gross_profit_amount || 0) >= 0 ? 'font-semibold text-green-200' : 'font-semibold text-red-200'}>{formatMoney(expandedOrderInvoice.order.gross_profit_amount)}</span></div>
                                          <div><span className="text-gray-500">Số dòng:</span> <span className="font-semibold text-gray-100">{expandedOrderInvoice.lines.length}</span></div>
                                          <div><span className="text-gray-500">Trạng thái:</span> <span className="font-semibold text-gray-100">{isCancelled ? 'Đã hủy' : 'Hiệu lực'}</span></div>
                                          <div><span className="text-gray-500">Ghi chú:</span> <span className="font-semibold text-gray-100">{expandedOrderInvoice.order.note || 'Không có'}</span></div>
                                        </div>
                                      </div>

                                      <div className="overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                                        <div className="overflow-x-auto">
                                          <table className="min-w-[980px] w-full border-collapse text-sm">
                                            <thead className="bg-gray-900 text-gray-300">
                                              <tr className="border-b border-gray-800">
                                                <th className="px-4 py-3 text-left font-semibold">Hàng hóa</th>
                                                <th className="px-4 py-3 text-left font-semibold">Đơn vị</th>
                                                <th className="px-4 py-3 text-right font-semibold">SL</th>
                                                <th className="px-4 py-3 text-right font-semibold">Đơn giá</th>
                                                <th className="px-4 py-3 text-right font-semibold">Thành tiền</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {expandedOrderInvoice.lines.map((line) => (
                                                <tr key={line.id} className="border-b border-gray-900 last:border-b-0">
                                                  <td className="px-4 py-3">
                                                    <p className="font-semibold text-gray-100">{line.productName}</p>
                                                    <p className="text-gray-400">{line.sku}</p>
                                                  </td>
                                                  <td className="px-4 py-3 text-gray-300">{line.unitName}</td>
                                                  <td className="px-4 py-3 text-right text-gray-300">{formatInventoryQuantity(line.quantity)}</td>
                                                  <td className="px-4 py-3 text-right text-gray-300">{formatMoney(line.unitPrice)}</td>
                                                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(line.lineTotal)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
                                        <div className="rounded-md border border-gray-800 bg-gray-900 p-3 text-sm text-gray-300">
                                          <p className="font-semibold text-gray-100">Nội dung xem nhanh</p>
                                          <p className="mt-2">Đây là phần xem-only của đơn hàng. Không có nút sửa, lưu hay thay đổi dòng hàng trong khung này.</p>
                                        </div>
                                        <div className="rounded-md border border-gray-800 bg-gray-900 p-3 text-sm text-gray-300">
                                          <div className="flex justify-between gap-3"><span className="text-gray-400">Tổng tiền hàng</span><span className="font-semibold text-gray-100">{formatMoney(expandedOrderInvoice.order.subtotal_amount)}</span></div>
                                          <div className="mt-2 flex justify-between gap-3"><span className="text-gray-400">Giảm giá</span><span className="font-semibold text-gray-100">{formatMoney(expandedOrderInvoice.order.discount_amount)}</span></div>
                                          <div className="mt-2 flex justify-between gap-3"><span className="text-gray-400">Khách cần trả</span><span className="font-semibold text-gray-100">{formatMoney(expandedOrderInvoice.order.total_amount)}</span></div>
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

        <div className="orders-list-print-only hidden bg-white text-gray-950">
          {printInvoices.map((invoice) => (
            <section key={invoice.order.id} className="orders-list-print-page mx-auto max-w-[148mm] bg-white p-5 font-serif text-sm leading-tight text-gray-950">
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <div>
                  <p className="font-bold uppercase">Công Ty TNHH Phân Phối Hà Công</p>
                  <p>Địa chỉ: ................................................</p>
                  <p>Điện thoại: ..............................................</p>
                  <p>STK: {invoice.paymentInfo.accountNumber} - {invoice.paymentInfo.bankName}</p>
                </div>
                <div className="text-right">
                  <p>Ngày: {formatDateOnly(invoice.order.created_at)}</p>
                  <p>Số: <span className="font-semibold">{invoice.order.code}</span></p>
                  <p>Loại tiền: VNĐ</p>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-lg font-bold uppercase">Hóa đơn bán hàng</p>
                <p className="text-sm">Liên giao khách hàng</p>
              </div>

              <div className="mt-4 space-y-1">
                <p>Tên khách hàng: <span className="font-semibold">{invoice.customerName}</span></p>
                <p>Địa chỉ: {invoice.customerAddress}</p>
                <p>Điện thoại: {invoice.customerPhone}</p>
                {invoice.order.note && <p>Ghi chú: {invoice.order.note}</p>}
              </div>

              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-900 px-1 py-1 text-center font-semibold">STT</th>
                    <th className="border border-gray-900 px-2 py-1 text-left font-semibold">Tên hàng hóa</th>
                    <th className="border border-gray-900 px-1 py-1 text-center font-semibold">ĐVT</th>
                    <th className="border border-gray-900 px-1 py-1 text-right font-semibold">SL</th>
                    <th className="border border-gray-900 px-2 py-1 text-right font-semibold">Đ.Giá</th>
                    <th className="border border-gray-900 px-2 py-1 text-right font-semibold">T.Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td className="border border-gray-900 px-1 py-1 text-center">{index + 1}</td>
                      <td className="border border-gray-900 px-2 py-1">
                        <p className="font-semibold">{line.productName}</p>
                        <p className="text-gray-700">{line.sku}</p>
                      </td>
                      <td className="border border-gray-900 px-1 py-1 text-center">{line.unitName}</td>
                      <td className="border border-gray-900 px-1 py-1 text-right">{formatInventoryQuantity(line.quantity)}</td>
                      <td className="border border-gray-900 px-2 py-1 text-right">{formatMoney(line.unitPrice)}</td>
                      <td className="border border-gray-900 px-2 py-1 text-right">{formatMoney(line.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-900 px-1 py-1 text-center" colSpan={5}>Tổng tiền thanh toán</td>
                    <td className="border border-gray-900 px-2 py-1 text-right font-bold">{formatMoney(invoice.order.total_amount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 space-y-1">
                <p>Số tiền bằng chữ: <span className="font-semibold italic">{invoice.totalAmountInWords}</span></p>
                <p>Quý khách kiểm tra hàng và thanh toán tiền trước khi nhận hàng ra về.</p>
                <p>Cảm ơn quý khách đã mua hàng.</p>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="font-semibold">Khách hàng</p>
                  <p className="mt-14">........................</p>
                </div>
                <div>
                  <p className="font-semibold">Thủ kho</p>
                  <p className="mt-14">........................</p>
                </div>
                <div>
                  <p className="font-semibold">Kế toán</p>
                  <p className="mt-14">........................</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  )
}
