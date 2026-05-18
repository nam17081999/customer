import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { RefreshCw, Search } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { listProductsWithStock, listStockMovements } from '@/api/inventory/inventory-client'
import { filterStockMovements, formatInventoryQuantity, formatProductStock, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TYPE_LABEL = {
  purchase: 'Nhập',
  sale: 'Bán',
  adjustment: 'Điều chỉnh',
  purchase_cancel: 'Hủy nhập',
  sale_cancel: 'Hủy bán',
}

export default function StockReportPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const lowProducts = useMemo(() => products.filter((product) => Number(product.onHandBaseQty || 0) <= Number(product.min_stock_base_qty || 0)), [products])
  const enrichedMovements = useMemo(() => movements.map((row) => ({ ...row, product: productsById.get(String(row.product_id)) || null })), [movements, productsById])
  const filteredMovements = useMemo(() => filterStockMovements(enrichedMovements, { query, type }), [enrichedMovements, query, type])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return router.replace('/login?from=/inventory/stock')
    if (!isAdmin) return router.replace('/account')
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [productRows, movementRows] = await Promise.all([listProductsWithStock(), listStockMovements(250)])
      setProducts(productRows || [])
      setMovements(movementRows || [])
    } catch (err) {
      setError(err?.message || 'Không tải được báo cáo tồn kho.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (pageReady) loadData() }, [pageReady, loadData])

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head><title>Báo cáo tồn kho - NPP Hà Công</title></Head>
      <main className="min-h-screen bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">Báo cáo tồn kho</h1><p className="text-base text-gray-400">Hàng sắp hết và lịch sử phát sinh kho.</p></div>
            <Button type="button" variant="outline" onClick={loadData} disabled={loading}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
          </div>
          {error && <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr] min-[1900px]:grid-cols-[430px_1fr]">
            <Card><CardContent className="p-4 space-y-3">
              <h2 className="text-lg font-semibold">Sắp hết hàng</h2>
              {lowProducts.length === 0 ? <p className="text-gray-400">Không có hàng dưới tồn tối thiểu.</p> : lowProducts.slice(0, 20).map((product) => (
                <Link key={product.id} href={`/inventory/products/${product.id}`} className="block rounded-md border border-amber-900/50 bg-amber-950/15 px-3 py-2 hover:bg-amber-950/25">
                  <p className="font-semibold text-amber-100">{product.name}</p>
                  <p className="text-sm text-amber-200">{formatProductStock(product)}</p>
                </Link>
              ))}
            </CardContent></Card>
            <Card><CardContent className="p-0">
              <div className="space-y-3 border-b border-gray-800 p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm hàng hóa hoặc ghi chú" /></div>
                  <select className="h-11 rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="all">Tất cả phát sinh</option>
                    {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <p className="text-sm text-gray-400">Hiển thị {filteredMovements.length} / {movements.length} phát sinh</p>
              </div>
              {loading ? <div className="p-4 text-gray-400">Đang tải...</div> : filteredMovements.length === 0 ? <div className="p-4 text-gray-400">Chưa có phát sinh kho.</div> : filteredMovements.map((row) => (
                <div key={row.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
                  <div><p className="font-semibold">{row.product?.name || row.product_id}</p><p className="text-sm text-gray-400">{formatDateTime(row.created_at)}</p></div>
                  <div>{TYPE_LABEL[row.movement_type] || row.movement_type}</div>
                  <div className={Number(row.quantity_base || 0) >= 0 ? 'font-semibold text-green-200' : 'font-semibold text-red-200'}>{formatInventoryQuantity(row.quantity_base)}</div>
                  <div className="text-gray-300">Sau: {formatInventoryQuantity(row.stock_after_base_qty)}</div>
                </div>
              ))}
            </CardContent></Card>
          </div>
        </div>
      </main>
    </>
  )
}
