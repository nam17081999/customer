import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { getOrRefreshStores } from '@/lib/storeCache'
import { formatAddressParts } from '@/lib/utils'
import { getPendingReportCount } from '@/api/reports/report-stats-client'
import { listProductsWithStock } from '@/api/inventory/inventory-client'
import { formatProductStock } from '@/helper/orderInventoryFlow'
import { buildTodayWorkSummary } from '@/helper/todayWork'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { PageHeader, Badge } from '@/components/ui/v2'

function WorkCard({ card }) {
  return (
    <Link href={card.href} className="block rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 transition hover:border-sky-500/40 hover:bg-slate-900/70">
      <p className="text-sm font-medium text-gray-400">{card.label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-100">{card.count}</p>
    </Link>
  )
}

function StoreList({ id, title, items, emptyText, actionLabel = 'Mở', getHref }) {
  return (
    <section id={id} className="rounded-3xl border border-slate-800/80 bg-slate-950/70">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        <Badge>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-base text-gray-400">{emptyText}</p>
      ) : (
        <div className="divide-y divide-slate-900/80">
          {items.map((store) => (
            <div key={store.id} className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-100">{store.name || 'Chưa có tên'}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-400">{formatAddressParts(store) || 'Chưa có địa chỉ'}</p>
              </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={getHref(store)}>{actionLabel}</Link>
                </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ProductList({ items }) {
  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-100">Hàng sắp hết</h2>
        <Badge variant="warning">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-base text-gray-400">Không có hàng dưới tồn tối thiểu.</p>
      ) : (
        <div className="divide-y divide-gray-900">
          {items.map((product) => (
            <Link key={product.id} href={`/inventory/products/${product.id}`} className="block px-4 py-3 hover:bg-gray-900">
              <p className="text-base font-semibold text-amber-100">{product.name}</p>
              <p className="mt-1 text-sm text-amber-200">{formatProductStock(product)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default function TodayPage() {
  const router = useRouter()
  const { isAdmin, isTelesale, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [stores, setStores] = useState([])
  const [pendingReports, setPendingReports] = useState(0)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inventoryWarning, setInventoryWarning] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      router.replace('/login?from=/today')
      return
    }
    if (!isAdmin && !isTelesale) {
      setPageReady(false)
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, isTelesale, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    setInventoryWarning('')
    try {
      const storeRows = await getOrRefreshStores()
      setStores(storeRows || [])

      if (isAdmin) {
        const [reportCount, productRows] = await Promise.all([
          getPendingReportCount().catch(() => 0),
          listProductsWithStock().catch(() => {
            setInventoryWarning('Chưa tải được tồn kho. Các việc cửa hàng vẫn hiển thị bình thường.')
            return []
          }),
        ])
        setPendingReports(reportCount)
        setProducts(productRows || [])
      } else {
        setPendingReports(0)
        setProducts([])
      }
    } catch {
      setError('Không tải được công việc hôm nay. Vui lòng thử lại.')
      setStores([])
      setPendingReports(0)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!pageReady) return
    loadData()
  }, [pageReady, loadData])

  useEffect(() => {
    if (!pageReady || typeof window === 'undefined') return undefined
    const handleChanged = () => loadData()
    window.addEventListener('storevis:stores-changed', handleChanged)
    window.addEventListener('storevis:reports-changed', handleChanged)
    return () => {
      window.removeEventListener('storevis:stores-changed', handleChanged)
      window.removeEventListener('storevis:reports-changed', handleChanged)
    }
  }, [pageReady, loadData])

  const summary = useMemo(() => buildTodayWorkSummary({ stores, pendingReports, products }), [stores, pendingReports, products])
  const cards = isAdmin ? summary.adminCards : summary.telesaleCards

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head>
        <title>Công việc hôm nay - NPP Hà Công</title>
      </Head>
    <main className="min-h-screen text-gray-100">
        <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 pb-20 sm:px-4 sm:py-6">
          <PageHeader
            title="Công việc hôm nay"
            subtitle="Các việc cần xử lý nhanh để dữ liệu và vận hành không bị tồn đọng."
            actions={(
              <Button type="button" variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                {loading ? 'Đang tải...' : 'Làm mới'}
              </Button>
            )}
          />

          {error && <div className="rounded-2xl border border-red-900/60 bg-red-950/25 px-4 py-3 text-red-200">{error}</div>}
          {inventoryWarning && <div className="rounded-2xl border border-amber-900/60 bg-amber-950/25 px-4 py-3 text-amber-100">{inventoryWarning}</div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => <WorkCard key={card.key} card={card} />)}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {isAdmin && (
              <>
                <StoreList
                  title="Cửa hàng chờ duyệt"
                  items={summary.lists.pendingStores}
                  emptyText="Không có cửa hàng chờ duyệt."
                  getHref={() => '/store/verify'}
                />
                <ProductList items={summary.lists.lowStockProducts} />
              </>
            )}

            {(isAdmin || isTelesale) && (
              <StoreList
                title="Cần gọi hôm nay"
                items={summary.lists.telesaleQueueStores}
                emptyText="Không có cửa hàng đến lượt gọi."
                actionLabel="Gọi"
                getHref={(store) => `/telesale/call/${store.id}?from=${encodeURIComponent('/today')}`}
              />
            )}

            <StoreList
              id="missing-phone"
              title="Thiếu số điện thoại"
              items={summary.lists.missingPhoneStores}
              emptyText="Không có cửa hàng thiếu số điện thoại trong danh sách đầu."
              actionLabel="Bổ sung"
              getHref={(store) => `/store/edit/${store.id}?mode=supplement`}
            />
            <StoreList
              title="Thiếu vị trí"
              items={summary.lists.missingLocationStores}
              emptyText="Không có cửa hàng thiếu vị trí trong danh sách đầu."
              actionLabel="Bổ sung"
              getHref={(store) => `/store/edit/${store.id}?mode=supplement`}
            />
            {isAdmin && (
              <Card className="rounded-md border-gray-800 bg-gray-950">
                <CardContent className="space-y-3 p-4">
                  <h2 className="text-lg font-semibold text-gray-100">Dọn dữ liệu</h2>
                  <p className="text-base text-gray-400">Quét nghi trùng khi số cửa hàng tăng nhanh hoặc sau khi nhập dữ liệu.</p>
                  <Button asChild variant="outline">
                    <Link href="/store/deduplicate">Mở màn gộp trùng</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
