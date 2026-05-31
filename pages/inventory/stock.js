import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { RefreshCw, Search, ShieldCheck, Wrench } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/v2'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import {
  loadInventoryStockDashboard,
  repairStockFromLedgerAndReload,
  runReconciliationCheckAndReload,
} from '@/services/inventory/inventory-page-service'
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
    if (!isAuthenticated) return router.replace('/login?from=/inventory/stock')
    if (!isAdmin) return router.replace('/account')
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
      <main className="min-h-screen bg-black/40 text-slate-100">
        <div className={`${layoutClasses.shell} py-4 space-y-5`}>
          
          {/* Header Action panel */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">Báo cáo tồn kho</h1>
              <p className="mt-1 text-sm font-medium text-slate-400">Xem cảnh báo sản phẩm sắp hết hàng và quản lý sổ nhật ký phát sinh kho.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={handleReconciliationCheck} disabled={reconciling || loading} className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 rounded-xl">
                <ShieldCheck className="h-4 w-4 mr-1 text-sky-400" /> {reconciling ? 'Đang đối soát...' : 'Đối soát kho'}
              </PrimaryButton>
              <Button type="button" variant="outline" onClick={handleRepair} disabled={repairing || loading || reconciliationIssues.length === 0} className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 rounded-xl cursor-pointer">
                <Wrench className="h-4 w-4 mr-1 text-amber-400" /> {repairing ? 'Đang sửa...' : 'Sửa theo ledger'}
              </Button>
              <Button type="button" variant="outline" onClick={loadData} disabled={loading} className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 rounded-xl cursor-pointer">
                <RefreshCw className="h-4 w-4 mr-1 text-emerald-400" /> Làm mới
              </Button>
            </div>
          </div>

          {error && <div className="rounded-2xl border border-red-900 bg-red-950/20 px-4 py-3 text-sm font-bold text-red-300 shadow-md">{error}</div>}
          
          {/* Audit Health Cards Grid */}
          <Card className="rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-md shadow-lg">
            <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái đối soát</p>
                <p className={`mt-1 text-xl font-extrabold ${reconciliationIssues.length ? 'text-amber-400' : 'text-emerald-400'}`}>{reconciliationIssues.length} lỗi lệch</p>
              </div>
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Sản phẩm tồn dưới 0</p>
                <p className="mt-1 text-xl font-extrabold text-red-400">{reconciliationRows.filter((row) => row.negative_ledger || Number(row.replay_on_hand_base_qty || 0) < 0).length} hàng</p>
              </div>
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lịch sử mồ côi (Orphan)</p>
                <p className="mt-1 text-xl font-extrabold text-red-400">{reconciliationRows.filter((row) => row.has_orphan_movement).length} phát sinh</p>
              </div>
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái lần chạy</p>
                <p className="mt-1 text-sm font-extrabold text-slate-200 capitalize bg-slate-900 px-2 py-0.5 rounded border border-slate-800 inline-block">{reconciliationRun?.status || 'Chưa thực hiện'}</p>
              </div>
              {reconciliationIssues.length > 0 && (
                <div className="md:col-span-4 rounded-xl border border-amber-950 bg-amber-950/20 p-3.5 text-xs font-bold text-amber-300 shadow-inner">
                  ⚠️ Phát hiện chênh lệch tồn thực tế: {reconciliationIssues.slice(0, 3).map((row) => `${row.product_name}: ${(row.issue_codes || []).join(', ')}`).join(' · ')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock vs Movement ledger panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr] min-[1900px]:grid-cols-[430px_1fr]">
            
            {/* Left Column: Low Stock warnings list */}
            <Card className="rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-md shadow-lg h-fit">
              <CardContent className="p-4 space-y-4">
                <div className="border-b border-slate-900 pb-2 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-200 uppercase tracking-widest text-[11px]">Sản phẩm sắp hết hàng</h2>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">{lowProducts.length}</span>
                </div>
                
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {lowProducts.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500 py-4 text-center">Không có sản phẩm nào chạm ngưỡng tối thiểu.</p>
                  ) : (
                    lowProducts.slice(0, 20).map((product) => (
                      <Link key={product.id} href={`/inventory/products/${product.id}`} className="block rounded-xl border border-amber-950 bg-amber-950/10 px-3.5 py-2.5 hover:border-amber-700/60 hover:bg-amber-950/20 transition-all duration-200 shadow-sm">
                        <p className="text-sm font-extrabold text-amber-200">{product.name}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center justify-between">
                          <span>Ngưỡng: {product.min_stock_base_qty || 0}</span>
                          <span className="text-amber-400 font-extrabold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-900">{formatProductStock(product)}</span>
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Ledger records timeline */}
            <Card className="rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-md shadow-lg">
              <CardContent className="p-0">
                
                {/* Filters toolbar */}
                <div className="space-y-3 border-b border-slate-900 p-4 bg-slate-950/40">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input className="pl-9.5 h-11 rounded-xl border-slate-800 bg-slate-900/60 focus:border-blue-500" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm tên hàng, ghi chú kho..." />
                    </div>
                    <select className="h-11 rounded-xl border border-slate-800 bg-slate-900/90 px-3 text-sm font-bold text-slate-100 focus:border-blue-500 focus:outline-none" value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="all">Tất cả lịch sử phát sinh</option>
                      {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">Tìm thấy {filteredMovements.length} / {movements.length} phát sinh được liệt kê</p>
                </div>
                
                {/* Ledger Timeline List */}
                <div className="divide-y divide-slate-900 max-h-[550px] overflow-y-auto">
                  {loading ? (
                    <div className="p-8 text-center text-sm font-semibold text-slate-400">Đang tải dữ liệu sổ kho...</div>
                  ) : filteredMovements.length === 0 ? (
                    <div className="p-12 text-center text-sm font-semibold text-slate-500">Chưa ghi nhận lịch sử phát sinh kho phù hợp.</div>
                  ) : (
                    filteredMovements.map((row) => (
                      <div key={row.id} className="grid grid-cols-1 gap-2.5 px-4 py-4 lg:grid-cols-[1.5fr_1fr_1.1fr_1fr] lg:items-center hover:bg-slate-900/20 transition-all duration-200">
                        <div>
                          <p className="text-sm font-bold text-slate-100">{row.product?.name || row.product_id}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-1">{formatDateTime(row.created_at)}</p>
                        </div>
                        <div>
                          <span className="inline-flex rounded-full bg-slate-900 border border-slate-800 px-3 py-0.5 text-xs font-bold text-slate-300">
                            {TYPE_LABEL[row.movement_type] || row.movement_type}
                          </span>
                        </div>
                        <div className={`text-sm font-extrabold ${Number(row.quantity_base || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {Number(row.quantity_base || 0) >= 0 ? '+' : ''}{formatInventoryQuantity(row.quantity_base)}
                        </div>
                        <div className="text-sm font-bold text-slate-300">
                          <span className="text-slate-500 font-semibold text-xs mr-1.5">Tồn sau:</span>
                          {formatInventoryQuantity(row.stock_after_base_qty)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </>
  )
}
