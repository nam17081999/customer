import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { cancelPurchaseOrder, formatMoney, getPurchaseOrderDetail, listProductsWithStock } from '@/api/inventory/inventory-client'
import { formatInventoryQuantity, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function PurchaseOrderDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return router.replace(`/login?from=/inventory/purchases/${id || ''}`)
    if (!isAdmin) return router.replace('/account')
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router, id])

  const loadDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [detail, productRows] = await Promise.all([getPurchaseOrderDetail(id), listProductsWithStock()])
      setOrder(detail.order)
      setItems(detail.items)
      setProducts(productRows || [])
    } catch (err) {
      setError(err?.message || 'Không tải được chi tiết phiếu nhập.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { if (pageReady) loadDetail() }, [pageReady, loadDetail])

  const handleCancel = async () => {
    if (!order?.id || order.cancelled_at || cancelling) return
    if (!window.confirm(`Hủy phiếu nhập ${order.code}? Tồn kho sẽ bị trừ lại nếu còn đủ tồn.`)) return
    setCancelling(true)
    setError('')
    try {
      await cancelPurchaseOrder(order.id, user?.id || null)
      await loadDetail()
    } catch (err) {
      setError(err?.message || 'Không hủy được phiếu nhập.')
    } finally {
      setCancelling(false)
    }
  }

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head><title>Chi tiết phiếu nhập - NPP Hà Công</title></Head>
      <main className="min-h-screen bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Button asChild variant="outline"><Link href="/inventory/purchases"><ArrowLeft className="h-4 w-4" /> Phiếu nhập</Link></Button>
              <h1 className="mt-3 text-2xl font-bold">{order?.code || 'Chi tiết phiếu nhập'}</h1>
              <p className="text-base text-gray-400">{formatDateTime(order?.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={loadDetail} disabled={loading}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
              {order && !order.cancelled_at && <Button type="button" variant="outline" className="border-red-900/60 text-red-300 hover:bg-red-950/30" onClick={handleCancel} disabled={cancelling}><XCircle className="h-4 w-4" /> {cancelling ? 'Đang hủy...' : 'Hủy phiếu'}</Button>}
            </div>
          </div>
          {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}
          {loading ? <Card><CardContent className="p-4 text-gray-400">Đang tải...</CardContent></Card> : order ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] min-[1900px]:grid-cols-[1fr_430px]">
              <Card><CardContent className="p-0">
                <div className="grid grid-cols-1 gap-3 border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr]">
                  <div>Hàng hóa</div><div>Đơn vị</div><div>SL</div><div>Thành tiền</div>
                </div>
                {items.map((item) => {
                  const product = productsById.get(String(item.product_id))
                  return (
                    <div key={item.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 last:border-b-0 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr]">
                      <div><p className="font-semibold">{product?.name || item.product_id}</p><p className="text-sm text-gray-400">{product?.sku || 'Chưa có mã'}</p></div>
                      <div>{formatInventoryQuantity(item.conversion_to_base_qty)} gốc</div>
                      <div>{formatInventoryQuantity(item.quantity)}</div>
                      <div className="font-semibold">{formatMoney(item.line_total)}</div>
                    </div>
                  )
                })}
              </CardContent></Card>
              <Card><CardContent className="space-y-2 p-4">
                <h2 className="text-lg font-semibold">Thông tin phiếu</h2>
                <p>Nhà cung cấp: <span className="font-semibold">{order.supplier_name || 'Chưa có'}</span></p>
                <p className="text-xl font-bold">Tổng nhập: {formatMoney(order.total_amount)}</p>
                <p className="text-gray-400">Trạng thái: {order.cancelled_at ? 'Đã hủy' : 'Hiệu lực'}</p>
                {order.note && <p className="text-gray-300">Ghi chú: {order.note}</p>}
              </CardContent></Card>
            </div>
          ) : <Card><CardContent className="p-4 text-gray-400">Không tìm thấy phiếu nhập.</CardContent></Card>}
        </div>
      </main>
    </>
  )
}
