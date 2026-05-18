import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, Printer, RefreshCw, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { getOrRefreshStores } from '@/lib/storeCache'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { cancelSalesOrder, formatMoney, getSalesOrderDetail, listProductsWithStock } from '@/api/inventory/inventory-client'
import { buildSalesOrderInvoiceModel, formatInventoryQuantity, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'

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

  const handlePrint = () => {
    if (!order) return
    window.print()
  }

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head>
        <title>Chi tiết đơn hàng - NPP Hà Công</title>
        <style>{`
          @media print {
            @page { size: A5 portrait; margin: 8mm; }
            body { background: #fff !important; }
            nav, .sales-order-screen-only { display: none !important; }
            .sales-order-invoice-print { display: block !important; }
          }
        `}</style>
      </Head>
      <main className="min-h-screen bg-black text-gray-100 print:bg-white print:text-black">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="sales-order-screen-only space-y-4">
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
                <Button type="button" variant="outline" onClick={handlePrint} disabled={!order || loading}>
                  <Printer className="h-4 w-4" /> In đơn
                </Button>
                {order && order.status !== 'cancelled' && (
                  <Button type="button" variant="outline" className="border-red-900/60 text-red-300 hover:bg-red-950/30" onClick={handleCancel} disabled={cancelling}>
                    <XCircle className="h-4 w-4" /> {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                  </Button>
                )}
              </div>
            </div>

            {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}
          </div>

          {loading ? (
            <Card><CardContent className="p-4 text-gray-400">Đang tải chi tiết...</CardContent></Card>
          ) : order ? (
            <>
              <div className="sales-order-screen-only grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] min-[1900px]:grid-cols-[1fr_430px]">
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

              <section className="sales-order-invoice-print mx-auto max-w-[148mm] rounded-sm border border-gray-800 bg-white p-5 font-serif text-sm leading-tight text-gray-950 shadow-sm print:border-0 print:p-0 print:shadow-none">
                <div className="grid grid-cols-[1fr_auto] gap-4">
                  <div>
                    <p className="font-bold uppercase">Công Ty TNHH Phân Phối Hà Công</p>
                    <p>Địa chỉ: ................................................</p>
                    <p>Điện thoại: ..............................................</p>
                    <p>STK: {invoice.paymentInfo.accountNumber} - {invoice.paymentInfo.bankName}</p>
                  </div>
                  <div className="text-right">
                    <p>Ngày: {formatDateOnly(order.created_at)}</p>
                    <p>Số: <span className="font-semibold">{order.code}</span></p>
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
                  <p>NVBH: {user?.email || '................................'} </p>
                  {order.note && <p>Ghi chú: {order.note}</p>}
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
                      <td className="border border-gray-900 px-2 py-1 text-right font-bold">{formatMoney(order.total_amount)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-3 space-y-1">
                  <p>Số tiền bằng chữ: <span className="font-semibold italic">{invoice.totalAmountInWords}</span></p>
                  <p>Quý khách kiểm tra hàng và thanh toán tiền trước khi nhận hàng ra về.</p>
                  <p>Quý khách được đổi/trả hàng trong vòng 30 ngày nếu hàng còn nguyên vẹn.</p>
                  <p>Cảm ơn quý khách đã mua hàng.</p>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] gap-4">
                  <div>
                    <p className="font-semibold">Thông tin chuyển khoản</p>
                    <p>{invoice.paymentInfo.bankName}</p>
                    <p>STK: <span className="font-bold">{invoice.paymentInfo.accountNumber}</span></p>
                    <p>Số tiền: <span className="font-bold">{formatMoney(order.total_amount)} VNĐ</span></p>
                  </div>
                  <img src={invoice.paymentQrUrl} alt={`QR thanh toán ${order.code}`} className="h-24 w-24 border border-gray-900 object-contain p-1" />
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
            </>
          ) : (
            <Card><CardContent className="p-4 text-gray-400">Không tìm thấy đơn hàng.</CardContent></Card>
          )}
        </div>
      </main>
    </>
  )
}
