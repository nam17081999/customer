import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { RefreshCw, Search, ShieldCheck, Wrench } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import {
  loadInventoryStockDashboard,
  repairStockFromLedgerAndReload,
  runReconciliationCheckAndReload,
} from '@/services/inventory/inventory-page-service'
import { filterStockMovements, formatInventoryQuantity, formatProductStock, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'

const ISSUE_CODE_LABEL = {
  quantity_mismatch: 'Sai lệch số lượng tồn',
  negative_replay_stock: 'Tồn ledger đang âm',
  negative_movement_snapshot: 'Tồn kho âm khi phát sinh',
  orphan_movement: 'Phát sinh kho không có hàng hóa',
  avg_cost_mismatch: 'Sai lệch giá vốn',
}

function formatIssueCodes(codes) {
  if (!codes || codes.length === 0) return ''
  return codes.map((c) => ISSUE_CODE_LABEL[c] || c).join(', ')
}

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
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [error, setError] = useState('')
  const [reconciliationRows, setReconciliationRows] = useState([])
  const [reconciliationRun, setReconciliationRun] = useState(null)
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const lowProducts = useMemo(() => products.filter((product) => Number(product.onHandBaseQty || 0) <= Number(product.min_stock_base_qty || 0)), [products])
  const enrichedMovements = useMemo(() => movements.map((row) => ({ ...row, product: productsById.get(String(row.product_id)) || null })), [movements, productsById])
  const filteredMovements = useMemo(() => filterStockMovements(enrichedMovements, { query, type }), [enrichedMovements, query, type])
  const reconciliationIssues = useMemo(() => reconciliationRows.filter((row) => (row.issue_codes || []).length > 0), [reconciliationRows])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.replace('/login?from=/inventory/stock'); return }
    if (!isAdmin) { router.replace('/account'); return }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { products: productRows, movements: movementRows, reconciliation } = await loadInventoryStockDashboard()
      setProducts(productRows || [])
      setMovements(movementRows || [])
      setReconciliationRows(reconciliation || [])
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được báo cáo tồn kho.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (pageReady) loadData() }, [pageReady, loadData])

  const handleReconciliationCheck = async () => {
    if (reconciling) return
    setReconciling(true)
    setError('')
    try {
      const { run, reconciliation } = await runReconciliationCheckAndReload(user?.id || null)
      setReconciliationRun(run)
      setReconciliationRows(reconciliation || [])
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không kiểm tra đối soát tồn kho được.')
    } finally {
      setReconciling(false)
    }
  }

  const handleRepair = async () => {
    if (repairing) return
    if (!window.confirm('Sửa tồn hiện tại theo ledger phát sinh? Lợi nhuận lịch sử không bị ghi lại.')) return
    setRepairing(true)
    setError('')
    try {
      const { repair, reconciliation } = await repairStockFromLedgerAndReload(user?.id || null)
      setReconciliationRun(repair)
      setReconciliationRows(reconciliation || [])
      await loadData()
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không sửa tồn theo ledger được.')
    } finally {
      setRepairing(false)
    }
  }

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head><title>Báo cáo tồn kho - NPP Hà Công</title></Head>
      <main className="min-h-full bg-black text-gray-100 lg:h-screen lg:overflow-hidden">
        <div className="mx-auto flex h-[calc(100dvh-75px)] w-full max-w-[1900px] flex-col px-3 sm:px-4 min-[1900px]:px-8">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-2xl font-bold">Báo cáo tồn kho</h1><p className="text-base text-gray-400">Hàng sắp hết và lịch sử phát sinh kho.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleReconciliationCheck} disabled={reconciling || loading}><ShieldCheck className="h-4 w-4" /> {reconciling ? 'Đang đối soát...' : 'Đối soát'}</Button>
              <Button type="button" variant="outline" onClick={handleRepair} disabled={repairing || loading || reconciliationIssues.length === 0}><Wrench className="h-4 w-4" /> {repairing ? 'Đang sửa...' : 'Sửa theo ledger'}</Button>
              <Button type="button" variant="outline" onClick={loadData} disabled={loading}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
            </div>
          </div>
          <div className="shrink-0">
            {error && <div className="my-3 rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>}
          </div>
          <Card className="shrink-0"><CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Đối soát</p>
                <p className={reconciliationIssues.length ? 'mt-1 text-2xl font-bold text-amber-200' : 'mt-1 text-2xl font-bold text-green-200'}>{reconciliationIssues.length} lỗi</p>
              </div>
              <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Tồn dưới 0</p>
                <p className="mt-1 text-2xl font-bold text-red-200">{reconciliationRows.filter((row) => row.negative_ledger || Number(row.replay_on_hand_base_qty || 0) < 0).length}</p>
              </div>
              <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Phát sinh lẻ</p>
                <p className="mt-1 text-2xl font-bold text-red-200">{reconciliationRows.filter((row) => row.has_orphan_movement).length}</p>
              </div>
              <div className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Lần chạy</p>
                <p className="mt-1 text-base font-semibold text-gray-100">{reconciliationRun?.status || 'Chưa chạy'}</p>
              </div>
            </div>
          </CardContent></Card>
          <div className="min-h-0 flex-1 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr] min-[1900px]:grid-cols-[430px_1fr] overflow-hidden pt-4">
            <Card className="min-h-0 flex flex-col overflow-hidden"><CardContent className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4">
              <h2 className="text-lg font-semibold shrink-0">Sắp hết hàng</h2>
              {lowProducts.length === 0 ? <p className="text-gray-400">Không có hàng dưới tồn tối thiểu.</p> : lowProducts.slice(0, 20).map((product) => (
                <Link key={product.id} href={`/inventory/products/${product.id}`} className="block rounded-md border border-amber-900/50 bg-amber-950/15 px-3 py-2 hover:bg-amber-950/25">
                  <p className="font-semibold text-amber-100">{product.name}</p>
                  <p className="text-sm text-amber-200">{formatProductStock(product)}</p>
                </Link>
              ))}
            </CardContent></Card>
            <Card className="min-h-0 flex flex-col overflow-hidden"><CardContent className="flex flex-col p-0 min-h-0">
              <div className="shrink-0 border-b border-gray-800 p-4">
                <h2 className="text-lg font-semibold">Phát sinh kho</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm hàng hóa hoặc ghi chú" /></div>
                  <select className="h-11 rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="all">Tất cả phát sinh</option>
                    {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <p className="mt-2 text-sm text-gray-400">Hiển thị {filteredMovements.length} / {movements.length} phát sinh</p>
                {reconciliationIssues.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-900/60 bg-amber-950/20 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200">Lỗi đối soát gần đây</p>
                    <ul className="space-y-1.5">
                      {reconciliationIssues.slice(0, 4).map((row) => (
                        <li key={row.product_name} className="text-sm text-amber-100">
                          <span className="font-semibold">{row.product_name}</span>: {formatIssueCodes(row.issue_codes)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? <div className="p-4 text-gray-400">Đang tải...</div> : filteredMovements.length === 0 ? <div className="p-4 text-gray-400">Chưa có phát sinh kho.</div> : filteredMovements.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
                    <div><p className="font-semibold">{row.product?.name || row.product_id}</p><p className="text-sm text-gray-400">{formatDateTime(row.created_at)}</p></div>
                    <div className="text-base">{TYPE_LABEL[row.movement_type] || row.movement_type}</div>
                    <div className={Number(row.quantity_base || 0) >= 0 ? 'text-base font-semibold text-green-200' : 'text-base font-semibold text-red-200'}>{formatInventoryQuantity(row.quantity_base)}</div>
                    <div className="text-base text-gray-300">Sau: {formatInventoryQuantity(row.stock_after_base_qty)}</div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        </div>
      </main>
    </>
  )
}
