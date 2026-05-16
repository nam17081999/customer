import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { getOrRefreshStores } from '@/lib/storeCache'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { cancelSalesOrder, formatMoney, getSalesOrderDetail, listProductsWithStock } from '@/api/inventory/inventory-client'
import { formatInventoryQuantity, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function SalesOrderDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [stores, setStores] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const storesById = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const customer = order ? storesById.get(String(order.customer_store_id)) : null

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace(`/login?from=/orders/${id || ''}`)
      return
    }
    if (!isAdmin) {
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router, id])

  const loadDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [detail, storeRows, productRows] = await Promise.all([
        getSalesOrderDetail(id),
        getOrRefreshStores(),
        listProductsWithStock(),
      ])
      setOrder(detail.order)
      setItems(detail.items)
      setStores(storeRows || [])
      setProducts(productRows || [])
    } catch (err) {
      setError(err?.message || 'Không tải được chi tiết đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!pageReady) return
    loadDetail()
  }, [pageReady, loadDetail])

  const handleCancel = async () => {
    if (!order?.id || order.status === 'cancelled' || cancelling) return
    if (!window.confirm(`Hủy đơn ${order.code}? Tồn kho sẽ được cộng lại.`)) return
    setCancelling(true)
    setError('')
    try {
      await cancelSalesOrder(order.id, user?.id || null)
      await loadDetail()
    } catch (err) {
      setError(err?.message || 'Không hủy được đơn hàng.')
    } finally {
      setCancelling(false)
    }
  }

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head><title>Chi tiết đơn hàng - NPP Hà Công</title></Head>
      <main className="min-h-screen bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Button asChild variant="outline">
                <Link href="/orders"><ArrowLeft className="h-4 w-4" /> Đơn hàng</Link>
              </Button>
              <h1 className="mt-3 text-2xl font-bold">{order?.code || 'Chi tiết đơn hàng'}</h1>
              <p className="text-base text-gray-400">{formatDateTime(order?.created_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={loadDetail} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
              {order && order.status !== 'cancelled' && (
                <Button type="button" variant="outline" className="border-red-900/60 text-red-300 hover:bg-red-950/30" onClick={handleCancel} disabled={cancelling}>
                  <XCircle className="h-4 w-4" /> {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                </Button>
              )}
            </div>
          </div>

          {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}

          {loading ? (
            <Card><CardContent className="p-4 text-gray-400">Đang tải chi tiết...</CardContent></Card>
          ) : order ? (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] min-[1900px]:grid-cols-[1fr_430px]">
                <Card>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 gap-3 border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.9fr]">
                      <div>Hàng hóa</div><div>Đơn vị</div><div>SL</div><div>Thành tiền</div><div>Lãi dòng</div>
                    </div>
                    {items.map((item) => {
                      const product = productsById.get(String(item.product_id))
                      return (
                        <div key={item.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 last:border-b-0 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.9fr]">
                          <div><p className="font-semibold">{product?.name || item.product_id}</p><p className="text-sm text-gray-400">{product?.sku || 'Chưa có mã'}</p></div>
                          <div>{formatInventoryQuantity(item.conversion_to_base_qty)} gốc</div>
                          <div>{formatInventoryQuantity(item.quantity)}</div>
                          <div className="font-semibold">{formatMoney(item.line_total)}</div>
                          <div className={Number(item.line_profit || 0) >= 0 ? 'font-semibold text-green-200' : 'font-semibold text-red-200'}>{formatMoney(item.line_profit)}</div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card><CardContent className="space-y-2 p-4">
                    <h2 className="text-lg font-semibold">Khách hàng</h2>
                    <p className="font-semibold">{customer?.name || 'Không tìm thấy khách hàng'}</p>
                    <p className="text-gray-400">{customer?.phone || 'Chưa có SĐT'}</p>
                    <p className="text-gray-400">{[customer?.ward, customer?.district].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</p>
                  </CardContent></Card>
                  <Card><CardContent className="space-y-2 p-4">
                    <h2 className="text-lg font-semibold">Tổng đơn</h2>
                    <p>Tạm tính: <span className="font-semibold">{formatMoney(order.subtotal_amount)}</span></p>
                    <p>Giảm giá: <span className="font-semibold">{formatMoney(order.discount_amount)}</span></p>
                    <p className="text-xl font-bold">Tổng: {formatMoney(order.total_amount)}</p>
                    <p className="text-green-200">Lãi gộp: {formatMoney(order.gross_profit_amount)}</p>
                    <p className="text-gray-400">Trạng thái: {order.status === 'cancelled' ? 'Đã hủy' : 'Đang hiệu lực'}</p>
                  </CardContent></Card>
                </div>
              </div>
            </>
          ) : (
            <Card><CardContent className="p-4 text-gray-400">Không tìm thấy đơn hàng.</CardContent></Card>
          )}
        </div>
      </main>
    </>
  )
}
