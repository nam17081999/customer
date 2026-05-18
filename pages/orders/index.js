import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Plus, RefreshCw, Search, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { getOrRefreshStores } from '@/lib/storeCache'
import { cancelSalesOrder, formatMoney, listSalesOrders } from '@/api/inventory/inventory-client'
import { filterSalesOrders, getOrderInventoryWorkbenchClasses, summarizeSalesOrders } from '@/helper/orderInventoryFlow'

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

function getCustomerName(order, storesById) {
  const store = storesById.get(String(order.customer_store_id))
  if (!store) return 'Không tìm thấy khách hàng'
  return store.name || 'Chưa có tên'
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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const storesById = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores])
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const filteredOrders = useMemo(() => filterSalesOrders(orders, storesById, {
    query,
    status: statusFilter,
  }), [orders, storesById, query, statusFilter])
  const summary = useMemo(() => summarizeSalesOrders(filteredOrders), [filteredOrders])

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

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Danh sách đơn hàng - NPP Hà Công</title>
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Danh sách đơn hàng</h1>
              <p className="text-base text-gray-400">Theo dõi đơn đã lên, trạng thái hủy, doanh thu và lãi gộp theo bộ lọc.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/orders/new"><Plus className="h-4 w-4" /> Lên đơn</Link>
              </Button>
              <Button type="button" variant="outline" onClick={loadOrders} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>
          )}

          <div className={layoutClasses.summaryGrid}>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-400">Đơn hiệu lực</p>
              <p className="text-2xl font-bold">{summary.activeOrders}</p>
            </div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-400">Doanh thu</p>
              <p className="text-2xl font-bold">{formatMoney(summary.totalAmount)}</p>
            </div>
            <div className="rounded-md border border-green-900 bg-green-950/20 p-4">
              <p className="text-sm text-green-300">Lãi gộp</p>
              <p className="text-2xl font-bold text-green-100">{formatMoney(summary.totalProfit)}</p>
            </div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-4">
              <p className="text-sm text-gray-400">Đã hủy</p>
              <p className="text-2xl font-bold">{summary.cancelled}</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    className="pl-9"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm mã đơn, khách hàng hoặc SĐT"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'Tất cả'],
                    ['active', 'Hiệu lực'],
                    ['cancelled', 'Đã hủy'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`h-11 rounded-md border px-4 text-base font-medium transition ${statusFilter === value ? 'border-sky-500 bg-sky-500/15 text-sky-100' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-gray-100'}`}
                      onClick={() => setStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-400">Hiển thị {filteredOrders.length} / {orders.length} đơn hàng</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className={`${layoutClasses.orderListGrid} hidden border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 lg:grid`}>
                <div>Mã đơn</div>
                <div>Khách hàng</div>
                <div>Ngày tạo</div>
                <div>Tổng tiền</div>
                <div>Lãi gộp</div>
                <div>Trạng thái</div>
                <div>Thao tác</div>
              </div>

              {loading ? (
                <div className="p-4 text-gray-400">Đang tải đơn hàng...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-4 text-gray-400">Chưa có đơn hàng.</div>
              ) : filteredOrders.map((order) => {
                const isCancelled = order.status === 'cancelled'
                return (
                  <div key={order.id} className={`${layoutClasses.orderListGrid} border-b border-gray-900 px-4 py-4 last:border-b-0`}>
                    <div>
                      <Link href={`/orders/${order.id}`} className="font-semibold text-gray-100 hover:text-sky-200">{order.code}</Link>
                      <p className="text-sm text-gray-400">{order.itemCount} dòng hàng</p>
                    </div>
                    <div className="text-gray-100">{getCustomerName(order, storesById)}</div>
                    <div className="text-gray-300">{formatDateTime(order.created_at)}</div>
                    <div className="font-semibold text-gray-100">{formatMoney(order.total_amount)}</div>
                    <div className={Number(order.gross_profit_amount || 0) >= 0 ? 'font-semibold text-green-200' : 'font-semibold text-red-200'}>
                      {formatMoney(order.gross_profit_amount)}
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${isCancelled ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-green-900 bg-green-950/30 text-green-200'}`}>
                        {isCancelled ? 'Đã hủy' : 'Đang hiệu lực'}
                      </span>
                    </div>
                    <div>
                      <Button asChild variant="outline" className="mb-2 mr-2">
                        <Link href={`/orders/${order.id}`}>Chi tiết</Link>
                      </Button>
                      {!isCancelled && (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-red-900/60 text-red-300 hover:bg-red-950/30"
                          disabled={cancellingId === order.id}
                          onClick={() => handleCancelOrder(order)}
                        >
                          <XCircle className="h-4 w-4" /> {cancellingId === order.id ? 'Đang hủy...' : 'Hủy'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
