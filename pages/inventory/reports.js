import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { formatMoney } from '@/helper/inventoryFormat'
import { useAuth } from '@/lib/AuthContext'
import {
  formatInventoryQuantity,
  getOrderInventoryWorkbenchClasses,
  getSalesReportDateRange,
  summarizeSalesReport,
} from '@/helper/orderInventoryFlow'
import { buildCsvContent, buildReportExportRows, downloadCsvFile } from '@/helper/exportCsv'
import { loadSalesReportData } from '@/services/inventory/inventory-page-service'

const PERIODS = [
  ['day', 'Hôm nay'],
  ['week', 'Tuần này'],
  ['month', 'Tháng này'],
  ['year', 'Năm nay'],
  ['all', 'Tất cả'],
]

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

function formatRange(period, from, to) {
  if (period === 'all') return 'Toàn bộ đơn active gần nhất'
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' }
  return `${from.toLocaleDateString('vi-VN', options)} - ${to.toLocaleDateString('vi-VN', options)}`
}

function StatCard({ label, value, tone = 'text-gray-100', hint }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-sm font-medium text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${tone}`}>{value}</p>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function EmptyRows() {
  return <div className="p-4 text-gray-400">Chưa có dữ liệu trong kỳ này.</div>
}

function ProductRows({ rows, mode }) {
  if (rows.length === 0) return <EmptyRows />
  return rows.slice(0, 10).map((row, index) => (
    <div key={row.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-3 last:border-b-0 md:grid-cols-[56px_1.4fr_1fr_1fr_1fr]">
      <div className="font-semibold text-gray-400">#{index + 1}</div>
      <div>
        <p className="font-semibold text-gray-100">{row.name}</p>
        <p className="text-sm text-gray-400">{row.sku || 'Chưa có mã'}</p>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-gray-500 md:hidden">Số lượng</p>
        <p className="text-gray-100">{formatInventoryQuantity(row.quantityBase)} {row.baseUnitName}</p>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-gray-500 md:hidden">Doanh thu</p>
        <p className="text-gray-100">{formatMoney(row.revenue)}</p>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-gray-500 md:hidden">{mode === 'profit' ? 'Lãi / biên' : 'Lãi'}</p>
        <p className={row.profit >= 0 ? 'font-semibold text-green-200' : 'font-semibold text-red-200'}>{formatMoney(row.profit)}</p>
        <p className="text-sm text-gray-400">Biên {formatPercent(row.profitMargin)}</p>
      </div>
    </div>
  ))
}

function CustomerRows({ rows }) {
  if (rows.length === 0) return <EmptyRows />
  return rows.slice(0, 10).map((row, index) => (
    <div key={row.id} className="grid grid-cols-1 gap-2 border-b border-gray-900 px-4 py-3 last:border-b-0 md:grid-cols-[56px_1.6fr_0.8fr_1fr_1fr]">
      <div className="font-semibold text-gray-400">#{index + 1}</div>
      <div>
        <p className="font-semibold text-gray-100">{row.name}</p>
        <p className="text-sm text-gray-400">{row.address || 'Chưa có địa chỉ'}</p>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-gray-500 md:hidden">Đơn</p>
        <p className="text-gray-100">{row.orderCount}</p>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-gray-500 md:hidden">Số lượng</p>
        <p className="text-gray-100">{formatInventoryQuantity(row.quantityBase)}</p>
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-gray-500 md:hidden">Doanh thu / lãi</p>
        <p className="text-gray-100">{formatMoney(row.revenue)}</p>
        <p className={row.profit >= 0 ? 'text-sm font-semibold text-green-200' : 'text-sm font-semibold text-red-200'}>Lãi {formatMoney(row.profit)}</p>
      </div>
    </div>
  ))
}

function ReportSection({ title, subtitle, headers, children }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-gray-800 p-4">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        <div className="sticky top-0 z-10 hidden border-b border-gray-800 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-300 md:grid md:grid-cols-[56px_1.4fr_1fr_1fr_1fr]">
          {headers.map((header) => <div key={header}>{header}</div>)}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export default function InventoryReportsPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [period, setPeriod] = useState('day')
  const [reportRows, setReportRows] = useState({ orders: [], items: [] })
  const [aggregateReport, setAggregateReport] = useState(null)
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const [from, to] = useMemo(() => getSalesReportDateRange(period), [period])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/login?from=/inventory/reports')
      return
    }
    if (!isAdmin) {
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await loadSalesReportData({ from, to })
      if (result.mode === 'aggregate') {
        setAggregateReport(result.aggregate)
        setReportRows({ orders: [], items: [] })
        setProducts([])
        setStores([])
      } else {
        setAggregateReport(null)
        setReportRows(result.fallback.salesRows)
        setProducts(result.fallback.products || [])
        setStores(result.fallback.stores || [])
      }
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được thống kê.')
      setAggregateReport(null)
      setReportRows({ orders: [], items: [] })
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    if (!pageReady) return
    loadReport()
  }, [pageReady, loadReport])

  const report = useMemo(() => {
    if (aggregateReport) {
      const sales = aggregateReport.sales || {}
      const topProducts = (aggregateReport.topProducts || []).map((row) => ({
        id: row.product_id,
        name: row.product_name,
        sku: row.sku,
        quantityBase: Number(row.quantity_base || 0),
        baseUnitName: '',
        revenue: Number(row.revenue || 0),
        profit: Number(row.profit || 0),
        profitMargin: Number(row.revenue || 0) > 0 ? (Number(row.profit || 0) / Number(row.revenue || 0)) * 100 : 0,
      }))
      const customers = (aggregateReport.customers || []).map((row) => ({
        id: row.customer_store_id,
        name: row.customer_name,
        address: '',
        orderCount: Number(row.order_count || 0),
        quantityBase: 0,
        revenue: Number(row.revenue || 0),
        profit: Number(row.profit || 0),
        profitMargin: Number(row.revenue || 0) > 0 ? (Number(row.profit || 0) / Number(row.revenue || 0)) * 100 : 0,
      }))
      return {
        summary: {
          orderCount: Number(sales.order_count || 0),
          itemCount: topProducts.length,
          revenue: Number(sales.revenue || 0),
          cost: Number(sales.cost || 0),
          profit: Number(sales.profit || 0),
          profitMargin: Number(sales.revenue || 0) > 0 ? (Number(sales.profit || 0) / Number(sales.revenue || 0)) * 100 : 0,
        },
        topProductsByQuantity: topProducts,
        topProductsByProfit: [...topProducts].sort((left, right) => right.profit - left.profit),
        topCustomers: customers,
        inventory: aggregateReport.inventory || null,
        lowStock: aggregateReport.lowStock || [],
      }
    }

    return summarizeSalesReport({
      orders: reportRows.orders,
      items: reportRows.items,
      products,
      stores,
    })
  }, [aggregateReport, reportRows, products, stores])

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  const handleExport = () => {
    const rows = buildReportExportRows(report.topProductsByQuantity, (row) => ({
      name: row.name,
      sku: row.sku || '',
      quantity: row.quantityBase,
      revenue: row.revenue,
      profit: row.profit,
    }))
    const content = buildCsvContent({
      columns: [
        { key: 'stt', label: 'STT' },
        { key: 'name', label: 'Hàng hóa' },
        { key: 'sku', label: 'SKU' },
        { key: 'quantity', label: 'Số lượng gốc' },
        { key: 'revenue', label: 'Doanh thu' },
        { key: 'profit', label: 'Lãi' },
      ],
      rows,
    })
    downloadCsvFile({ filename: `bao-cao-hang-ban-${period}.csv`, content })
  }

  return (
    <>
      <Head>
        <title>Thống kê bán hàng - NPP Hà Công</title>
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="h-6 w-6" /> Thống kê bán hàng</h1>
              <p className="text-base text-gray-400">Hàng bán nhiều, lãi/lỗ theo kỳ, khách lấy nhiều hàng và sản phẩm lãi nhất.</p>
              <p className="text-sm text-gray-500">{formatRange(period, from, to)} · {aggregateReport ? 'Aggregate RPC' : 'Fallback client-side'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/inventory/products"><ArrowLeft className="h-4 w-4" /> Hàng hóa</Link></Button>
              <Button type="button" variant="outline" onClick={handleExport} disabled={loading || report.topProductsByQuantity.length === 0}>Xuất CSV</Button>
              <Button type="button" variant="outline" onClick={loadReport} disabled={loading}><RefreshCw className="h-4 w-4" /> Làm mới</Button>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-wrap gap-2 p-4">
              {PERIODS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`h-10 rounded-md border px-3 text-sm font-medium transition ${period === value ? 'border-sky-500 bg-sky-500/15 text-sky-100' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-gray-100'}`}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </CardContent>
          </Card>

          {error && <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-red-200">{error}</div>}
          {loading ? <Card><CardContent className="p-4 text-gray-400">Đang tải thống kê...</CardContent></Card> : (
            <>
              <div className={layoutClasses.summaryGrid}>
                <StatCard label="Đơn hiệu lực" value={report.summary.orderCount} hint={`${report.summary.itemCount} dòng hàng`} />
                <StatCard label="Doanh thu" value={formatMoney(report.summary.revenue)} />
                <StatCard label="Giá vốn" value={formatMoney(report.summary.cost)} />
                <StatCard label="Lãi gộp" value={formatMoney(report.summary.profit)} tone={report.summary.profit >= 0 ? 'text-green-200' : 'text-red-200'} hint={`Biên ${formatPercent(report.summary.profitMargin)}`} />
                {report.inventory && <StatCard label="Giá trị tồn" value={formatMoney(report.inventory.stock_value)} hint={`${report.inventory.low_stock_count || 0} hàng tồn thấp`} />}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ReportSection title="Hàng hóa bán nhiều" subtitle="Xếp theo số lượng quy đổi về đơn vị gốc" headers={['#', 'Hàng hóa', 'Số lượng', 'Doanh thu', 'Lãi']}>
                  <ProductRows rows={report.topProductsByQuantity} />
                </ReportSection>
                <ReportSection title="Sản phẩm lãi nhất" subtitle="Xếp theo tổng lãi gộp" headers={['#', 'Hàng hóa', 'Số lượng', 'Doanh thu', 'Lãi / biên']}>
                  <ProductRows rows={report.topProductsByProfit} mode="profit" />
                </ReportSection>
              </div>

              <ReportSection title="Khách lấy nhiều hàng" subtitle="Xếp theo tổng số lượng hàng đã lấy trong kỳ" headers={['#', 'Khách hàng', 'Đơn', 'Số lượng', 'Doanh thu / lãi']}>
                <CustomerRows rows={report.topCustomers} />
              </ReportSection>
            </>
          )}
        </div>
      </main>
    </>
  )
}
