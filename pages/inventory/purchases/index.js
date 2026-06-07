import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { formatMoney } from '@/helper/inventoryFormat'
import { getOrderInventoryWorkbenchClasses, summarizePurchaseOrders } from '@/helper/orderInventoryFlow'
import { loadPurchaseOrdersList } from '@/services/inventory/inventory-page-service'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const summary = useMemo(() => summarizePurchaseOrders(orders), [orders])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.replace('/login?from=/inventory/purchases'); return }
    if (!isAdmin) { router.replace('/account'); return }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setOrders((await loadPurchaseOrdersList()).orders)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được phiếu nhập.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pageReady) loadOrders()
  }, [pageReady, loadOrders])

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head><title>Phiếu nhập - NPP Hà Công</title></Head>
      <main className="min-h-full bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">Phiếu nhập</h1><p className="text-base text-gray-400">Theo dõi nhập kho, tổng nhập và phiếu đã hủy.</p></div>
            <div className="flex gap-2">
              <Button asChild><Link href="/inventory/purchases/new"><Plus className="h-4 w-4" /> Nhập hàng</Link></Button>
              <Button type="button" variant="outline" onClick={loadOrders} disabled={loading}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
            </div>
          </div>
          {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-md border border-gray-800 bg-gray-950 p-4"><p className="text-sm text-gray-400">Phiếu hiệu lực</p><p className="text-2xl font-bold">{summary.activeOrders}</p></div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-4"><p className="text-sm text-gray-400">Tổng nhập</p><p className="text-2xl font-bold">{formatMoney(summary.totalAmount)}</p></div>
            <div className="rounded-md border border-red-900 bg-red-950/20 p-4"><p className="text-sm text-red-300">Đã hủy</p><p className="text-2xl font-bold text-red-100">{summary.cancelled}</p></div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-4"><p className="text-sm text-gray-400">Tất cả phiếu</p><p className="text-2xl font-bold">{summary.totalOrders}</p></div>
          </div>
          <Card><CardContent className="p-0">
            <div className="hidden grid-cols-[0.9fr_1.5fr_1fr_0.9fr_0.8fr] gap-3 border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 lg:grid">
              <div>Mã phiếu</div><div>Nhà cung cấp</div><div>Ngày nhập</div><div>Tổng tiền</div><div>Trạng thái</div>
            </div>
            {loading ? <div className="p-4 text-gray-400">Đang tải...</div> : orders.length === 0 ? <div className="p-4 text-gray-400">Chưa có phiếu nhập.</div> : orders.map((order) => (
              <Link key={order.id} href={`/inventory/purchases/${order.id}`} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 transition hover:bg-gray-900/60 lg:grid-cols-[0.9fr_1.5fr_1fr_0.9fr_0.8fr] lg:gap-3">
                <div><p className="font-semibold">{order.code}</p><p className="text-sm text-gray-400">{order.itemCount} dòng hàng</p></div>
                <div>{order.supplier_name || 'Chưa có nhà cung cấp'}</div>
                <div className="text-gray-300">{formatDateTime(order.created_at)}</div>
                <div className="font-semibold">{formatMoney(order.total_amount)}</div>
                <div>{order.cancelled_at ? <span className="rounded-full border border-red-900 bg-red-950/30 px-3 py-1 text-sm text-red-200">Đã hủy</span> : <span className="rounded-full border border-green-900 bg-green-950/30 px-3 py-1 text-sm text-green-200">Hiệu lực</span>}</div>
              </Link>
            ))}
          </CardContent></Card>
        </div>
      </main>
    </>
  )
}
