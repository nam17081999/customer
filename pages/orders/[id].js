import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, Printer, RefreshCw, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { formatMoney } from '@/helper/inventoryFormat'
import { buildSalesOrderInvoiceModel, formatInventoryQuantity, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'
import { cancelSalesOrderById, loadSalesOrderDetailData } from '@/services/inventory/inventory-page-service'
import { useReactToPrint } from 'react-to-print'
import InvoicePrintContent from '@/components/print/InvoicePrintContent'
import { logAuditEvent } from '@/helper/api/audit-client'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateOnly(value) {
  if (!value) return '.../.../......'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '.../.../......'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const cancellingRef = useRef(false)
  const [error, setError] = useState('')

  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const storesById = useMemo(() => new Map(stores.map((store) => [String(store.id), store])), [stores])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const customer = order ? storesById.get(String(order.customer_store_id)) : null
  const invoice = useMemo(() => buildSalesOrderInvoiceModel({
    order: order || {},
    customer,
    items,
    productsById,
  }), [customer, items, order, productsById])

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
      const { detail, stores: storeRows, products: productRows } = await loadSalesOrderDetailData(id)
      setOrder(detail.order)
      setItems(detail.items)
      setStores(storeRows || [])
      setProducts(productRows || [])
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được chi tiết đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!pageReady) return
    loadDetail()
  }, [pageReady, loadDetail])

  const handleCancel = async () => {
    if (!order?.id || order.status === 'cancelled' || cancelling || cancellingRef.current) return
    if (!window.confirm(`Hủy đơn ${order.code}? Tồn kho sẽ được cộng lại.`)) return
    cancellingRef.current = true
    setCancelling(true)
    setError('')
    try {
      await cancelSalesOrderById(order.id, user?.id || null)

      logAuditEvent({
        eventType: 'sales_order.cancelled',
        entityType: 'sales_order',
        entityId: order.id,
        metadata: {
          summary: `Hủy đơn bán ${order.code || ''}`,
          code: order.code,
          orderId: order.id,
        },
      })

      await loadDetail()
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không hủy được đơn hàng.')
    } finally {
      cancellingRef.current = false
      setCancelling(false)
    }
  }

  const printRef = useRef(null)
  const handlePrint = useReactToPrint({ contentRef: printRef, pageStyle: '@page { size: A4 landscape; margin: 0; } body { margin: 0; padding: 0; }' })

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head>
        <title>Chi tiết đơn hàng - NPP Hà Công</title>
        <style>{`
          .print-hide { display: none; }
        `}</style>
      </Head>

      {/* ===== SCREEN VIEW ===== */}
      <main className="min-h-full bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/orders"><ArrowLeft className="h-4 w-4" /> Đơn hàng</Link>
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={loadDetail} disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={!order || loading}>
                  <Printer className="h-4 w-4" /> In
                </Button>
                {isAdmin && order && order.status !== 'cancelled' && (
                  <Button type="button" variant="outline" size="sm" className="border-red-900/60 text-red-300 hover:bg-red-950/30" onClick={handleCancel} disabled={cancelling}>
                    <XCircle className="h-4 w-4" /> {cancelling ? 'Đang hủy...' : 'Hủy'}
                  </Button>
                )}
              </div>
            </div>

            {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}

            {order && (
              <div>
                <h1 className="text-2xl font-bold">Khách hàng: {customer?.name || 'Không tìm thấy'}</h1>
                <p className="mt-0.5 text-sm text-gray-400">{formatDateTime(order.created_at)}</p>
                {customer && (
                  <p className="text-sm text-gray-500">{[customer.phone ? `SĐT: ${customer.phone}` : '', [customer.ward, customer.district].filter(Boolean).length > 0 ? `Địa chỉ: ${[customer.ward, customer.district].filter(Boolean).join(', ')}` : ''].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <Card><CardContent className="p-4 text-gray-400">Đang tải chi tiết...</CardContent></Card>
          ) : order ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 gap-3 border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 md:grid-cols-[1.5fr_0.55fr_0.75fr_0.9fr]">
                    <div>Hàng hóa</div><div>SL</div><div>Đơn giá</div><div>Thành tiền</div>
                  </div>
                  {(invoice?.lines?.length > 0 ? invoice?.lines : items)?.map((item) => {
                    if (item.productName) {
                      return (
                        <div key={item.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 last:border-b-0 md:grid-cols-[1.5fr_0.55fr_0.75fr_0.9fr]">
                          <div><p className="font-semibold">{item.productName}</p><p className="text-sm text-gray-400">{item.sku || '—'} · {item.unitName}</p></div>
                          <div>{formatInventoryQuantity(item.quantity)}</div>
                          <div className="text-gray-300">{formatMoney(item.unitPrice)}</div>
                          <div className="font-semibold">{formatMoney(item.lineTotal)}</div>
                        </div>
                      )
                    }
                    const product = productsById.get(String(item.product_id))
                    return (
                      <div key={item.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 last:border-b-0 md:grid-cols-[1.5fr_0.55fr_0.75fr_0.9fr]">
                        <div><p className="font-semibold">{product?.name || item.product_id}</p><p className="text-sm text-gray-400">{product?.sku || '—'}</p></div>
                        <div>{formatInventoryQuantity(item.quantity)}</div>
                        <div className="text-gray-300">{formatMoney(item.unit_price || 0)}</div>
                        <div className="font-semibold">{formatMoney(item.line_total)}</div>
                      </div>
                    )
                  })}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-t border-gray-800 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      {order.note && <p className="text-sm text-amber-400">📝 {order.note}</p>}
                    </div>
                    <div className="shrink-0 rounded-md border border-gray-800 bg-gray-900 px-5 py-3">
                      {Number(order.discount_amount) > 0 && (
                        <div className="flex items-baseline justify-between gap-8 text-sm text-gray-400">
                          <span>Giảm giá</span>
                          <span className="text-gray-300">-{formatMoney(order.discount_amount)}</span>
                        </div>
                      )}
                      <div className={`flex items-baseline justify-between gap-8 ${Number(order.discount_amount) > 0 ? 'mt-2' : ''}`}>
                        <span className="text-base font-bold text-gray-100">Khách cần trả</span>
                        <span className="text-xl font-bold">{formatMoney(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="p-4 text-gray-400">Không tìm thấy đơn hàng.</CardContent></Card>
          )}
        </div>
      </main>

      {/* ===== PRINT CONTENT (hidden, used by react-to-print) ===== */}
      <div className="print-hide">
        {order && invoice && (
          <InvoicePrintContent ref={printRef} invoice={invoice} order={order} userEmail={user?.email} />
        )}
      </div>
    </>
  )
}
