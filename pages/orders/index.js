import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ChevronDown, Plus, Printer, Search, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { getOrRefreshStores } from '@/lib/storeCache'
import { cancelSalesOrder, formatMoney, getSalesOrderDetail, listProductsWithStock, listSalesOrders } from '@/api/inventory/inventory-client'
import {
  buildSalesOrderInvoiceModel,
  filterSalesOrders,
  formatInventoryQuantity,
  getOrderInventoryWorkbenchClasses,
  summarizeSalesOrders,
} from '@/helper/orderInventoryFlow'

const ORDER_FLASH_MESSAGE_KEY = 'storevis:order-flash-message'

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

export default function OrdersListPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState('')
  const [error, setError] = useState('')
  const [msgState, setMsgState] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilters, setStatusFilters] = useState(['active', 'cancelled'])
  const [datePreset, setDatePreset] = useState('all')
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [printInvoices, setPrintInvoices] = useState([])
  const [printing, setPrinting] = useState(false)

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

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [orderRows, storeRows] = await Promise.all([
        listSalesOrders(150),
        getOrRefreshStores(),
      ])
      setOrders(orderRows)
      setStores(storeRows || [])
    } catch (err) {
      setError(err?.message || 'Không tải được danh sách đơn hàng.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

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

  const storesById = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores])
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const filteredOrders = useMemo(() => filterSalesOrders(orders, storesById, {
    query,
    statuses: statusFilters,
    datePreset,
    creatorId: creatorFilter === 'all' ? '' : creatorFilter,
  }), [orders, storesById, query, statusFilters, datePreset, creatorFilter])
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
  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderIds.includes(String(order.id)))
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
        listProductsWithStock(),
        Promise.all(selectedOrders.map((order) => getSalesOrderDetail(order.id))),
      ])
      const productsById = new Map((productRows || []).map((product) => [String(product.id), product]))
      const nextInvoices = detailRows.map((detail) => {
        const customer = storesById.get(String(detail.order.customer_store_id))
        return buildSalesOrderInvoiceModel({
          order: detail.order,
          customer,
          items: detail.items,
          productsById,
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

      <main className="min-h-screen bg-black text-gray-100 print:bg-white print:text-black">
        {msgState ? <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg> : null}
        <div className={`${layoutClasses.shell} orders-list-screen-only flex min-h-[calc(100dvh-3rem)] flex-col gap-3`}>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="relative rounded-md border border-gray-800 bg-gray-950 p-3 xl:min-h-[calc(100dvh-7rem)]">
              <h1 className="mb-4 text-2xl font-bold">Đơn hàng</h1>

              <div className="space-y-5">
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

            <section className="min-w-0 space-y-3">
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
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>
              )}

              <div className="overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                <div className="overflow-x-auto">
                  <table className="min-w-[1380px] w-full border-collapse text-base">
                    <thead className="bg-gray-900 text-sm text-gray-300">
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
                        <th className="px-4 py-3 text-left font-semibold">Mã đơn</th>
                        <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                        <th className="px-4 py-3 text-left font-semibold">Người tạo</th>
                        <th className="px-4 py-3 text-left font-semibold">Khách hàng</th>
                        <th className="px-4 py-3 text-right font-semibold">Dòng hàng</th>
                        <th className="px-4 py-3 text-right font-semibold">Tổng tiền hàng</th>
                        <th className="px-4 py-3 text-right font-semibold">Giảm giá</th>
                        <th className="px-4 py-3 text-right font-semibold">Tổng phải thu</th>
                        <th className="px-4 py-3 text-right font-semibold">Lãi gộp</th>
                        <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                        <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-800 bg-gray-950 font-bold text-gray-100">
                        <td className="px-4 py-3" colSpan={4}>Tổng {filteredOrders.length} đơn</td>
                        <td className="px-4 py-3 text-right">{summary.activeOrders} hiệu lực</td>
                        <td className="px-4 py-3 text-right">{formatMoney(moneySummary.subtotal)}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(moneySummary.discount)}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(moneySummary.total)}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(moneySummary.profit)}</td>
                        <td className="px-4 py-3 text-gray-400" colSpan={3}>{summary.cancelled} đã hủy</td>
                      </tr>

                      {loading ? (
                        <tr>
                          <td className="px-4 py-5 text-gray-400" colSpan={12}>Đang tải đơn hàng...</td>
                        </tr>
                      ) : filteredOrders.length === 0 ? (
                        <tr>
                          <td className="px-4 py-5 text-gray-400" colSpan={12}>Chưa có đơn hàng phù hợp.</td>
                        </tr>
                      ) : filteredOrders.map((order) => {
                        const isCancelled = order.status === 'cancelled'
                        return (
                          <tr key={order.id} className="border-b border-gray-900 text-gray-100 transition last:border-b-0 hover:bg-gray-900/80">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.includes(String(order.id))}
                                onChange={() => toggleOrderSelection(order.id)}
                                aria-label={`Chọn đơn ${order.code}`}
                                className="h-4 w-4 accent-gray-100"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/orders/${order.id}`} className="font-semibold text-gray-100 hover:text-gray-300">{order.code}</Link>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-300">{formatDateTime(order.created_at)}</td>
                            <td className="px-4 py-3 text-gray-300">{getCreatorLabel(order, user)}</td>
                            <td className="px-4 py-3">{getCustomerName(order, storesById)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{order.itemCount}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatMoney(getOrderSubtotal(order))}</td>
                            <td className="px-4 py-3 text-right">{formatMoney(getOrderDiscount(order))}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatMoney(order.total_amount)}</td>
                            <td className={Number(order.gross_profit_amount || 0) >= 0 ? 'px-4 py-3 text-right font-semibold text-green-200' : 'px-4 py-3 text-right font-semibold text-red-200'}>
                              {formatMoney(order.gross_profit_amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-md border px-3 py-1 text-sm ${isCancelled ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-green-900 bg-green-950/30 text-green-200'}`}>
                                {isCancelled ? 'Đã hủy' : 'Hiệu lực'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/orders/${order.id}`}>Chi tiết</Link>
                                </Button>
                                {!isCancelled && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-red-900/60 text-red-300 hover:bg-red-950/30"
                                    disabled={cancellingId === order.id}
                                    onClick={() => handleCancelOrder(order)}
                                  >
                                    <XCircle className="h-4 w-4" /> {cancellingId === order.id ? 'Đang hủy...' : 'Hủy'}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 px-4 py-3 text-sm text-gray-400">
                  <span>Hiển thị {filteredOrders.length} / {orders.length} đơn hàng</span>
                  <span>Dữ liệu lấy tối đa 150 đơn gần nhất</span>
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
