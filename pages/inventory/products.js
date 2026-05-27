import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertTriangle, BarChart3, Package, Plus, RefreshCw, Search, ShoppingCart, Truck } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { formatMoney } from '@/helper/inventoryFormat'
import { getOperatorErrorMessage } from '@/helper/operatorErrors'
import { createProductFromForm, loadProductManagementData } from '@/services/inventory/inventory-page-service'
import {
  filterInventoryProducts,
  formatInventoryQuantity,
  formatProductStock,
  getInventoryProductCategories,
  getOrderInventoryWorkbenchClasses,
  summarizeInventoryProducts,
} from '@/helper/orderInventoryFlow'

const EMPTY_FORM = {
  name: '',
  sku: '',
  category: '',
  baseUnitName: 'chai',
  defaultSalePrice: '',
  defaultPurchasePrice: '',
  minStockBaseQty: '',
  caseUnitName: 'thùng',
  caseConversion: '12',
  caseSalePrice: '',
  casePurchasePrice: '',
  note: '',
}

export default function InventoryProductsPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [stockFilter, setStockFilter] = useState('all')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/login?from=/inventory/products')
      return
    }
    if (!isAdmin) {
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { products: data } = await loadProductManagementData()
      setProducts(data)
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Không tải được hàng hóa.'))
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadProducts()
  }, [pageReady, loadProducts])

  const categories = useMemo(() => getInventoryProductCategories(products), [products])
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const filteredProducts = useMemo(() => filterInventoryProducts(products, {
    query,
    category,
    stockFilter,
  }), [products, query, category, stockFilter])
  const summary = useMemo(() => summarizeInventoryProducts(products), [products])

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await createProductFromForm({ ...form, createdBy: user?.id || null })
      setForm(EMPTY_FORM)
      setMessage('Đã thêm hàng hóa.')
      await loadProducts()
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Không thêm được hàng hóa.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Hàng hóa & tồn kho - NPP Hà Công</title>
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <div className={`${layoutClasses.shell} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Hàng hóa & tồn kho</h1>
              <p className="text-base text-gray-400">Quản lý mặt hàng, đơn vị quy đổi, tồn hiện tại và cảnh báo thiếu hàng.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/inventory/purchases"><Truck className="h-4 w-4" /> Phiếu nhập</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/inventory/stock">Tồn kho</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/inventory/reports"><BarChart3 className="h-4 w-4" /> Thống kê</Link>
              </Button>
              <Button asChild>
                <Link href="/orders/new"><ShoppingCart className="h-4 w-4" /> Lên đơn</Link>
              </Button>
              <Button type="button" variant="outline" onClick={loadProducts} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
            </div>
          </div>

          {(error || message) && (
            <div className={`rounded-md border px-4 py-3 text-base ${error ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-green-900 bg-green-950/30 text-green-200'}`}>
              {error || message}
            </div>
          )}

          <div className={layoutClasses.productsGrid}>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-300" />
                  <h2 className="text-lg font-semibold">Thêm hàng hóa</h2>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                  <label className="block space-y-1">
                    <span className="text-sm text-gray-300">Tên hàng</span>
                    <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="Nước Lavie 500ml" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-300">Mã hàng</span>
                      <Input value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} placeholder="LAVIE500" />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-300">Nhóm</span>
                      <Input value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="Nước" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-300">Đơn vị gốc</span>
                      <Input value={form.baseUnitName} onChange={(e) => updateForm('baseUnitName', e.target.value)} />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-300">Tồn tối thiểu</span>
                      <Input type="number" min="0" value={form.minStockBaseQty} onChange={(e) => updateForm('minStockBaseQty', e.target.value)} />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-300">Giá bán/gốc</span>
                      <Input type="number" min="0" value={form.defaultSalePrice} onChange={(e) => updateForm('defaultSalePrice', e.target.value)} />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm text-gray-300">Giá nhập/gốc</span>
                      <Input type="number" min="0" value={form.defaultPurchasePrice} onChange={(e) => updateForm('defaultPurchasePrice', e.target.value)} />
                    </label>
                  </div>

                  <div className="rounded-md border border-gray-800 bg-gray-900/70 p-3 space-y-3">
                    <p className="text-base font-semibold text-gray-100">Đơn vị thùng mặc định</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-sm text-gray-300">Tên</span>
                        <Input value={form.caseUnitName} onChange={(e) => updateForm('caseUnitName', e.target.value)} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm text-gray-300">Quy đổi</span>
                        <Input type="number" min="2" value={form.caseConversion} onChange={(e) => updateForm('caseConversion', e.target.value)} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-sm text-gray-300">Giá bán/thùng</span>
                        <Input type="number" min="0" value={form.caseSalePrice} onChange={(e) => updateForm('caseSalePrice', e.target.value)} />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-sm text-gray-300">Giá nhập/thùng</span>
                        <Input type="number" min="0" value={form.casePurchasePrice} onChange={(e) => updateForm('casePurchasePrice', e.target.value)} />
                      </label>
                    </div>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-sm text-gray-300">Ghi chú</span>
                    <Input value={form.note} onChange={(e) => updateForm('note', e.target.value)} />
                  </label>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    <Plus className="h-4 w-4" /> {submitting ? 'Đang lưu...' : 'Thêm hàng'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className={layoutClasses.summaryGrid}>
                <div className="rounded-md border border-gray-800 bg-gray-950 p-4">
                  <p className="text-sm text-gray-400">Số mặt hàng</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <div className="rounded-md border border-amber-900 bg-amber-950/20 p-4">
                  <p className="text-sm text-amber-300">Dưới tồn tối thiểu</p>
                  <p className="text-2xl font-bold text-amber-100">{summary.lowStock}</p>
                </div>
                <div className="rounded-md border border-red-900 bg-red-950/20 p-4">
                  <p className="text-sm text-red-300">Hết hàng</p>
                  <p className="text-2xl font-bold text-red-100">{summary.outOfStock}</p>
                </div>
                <div className="rounded-md border border-gray-800 bg-gray-950 p-4">
                  <p className="text-sm text-gray-400">Giá trị tồn</p>
                  <p className="text-2xl font-bold">{formatMoney(summary.stockValue)}</p>
                </div>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <Input
                        className="pl-9"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Tìm tên hàng, mã hàng, nhóm"
                      />
                    </div>
                    <select
                      className="h-11 rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="">Tất cả nhóm</option>
                      {categories.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['all', 'Tất cả'],
                        ['available', 'Còn hàng'],
                        ['low', 'Sắp hết'],
                        ['out', 'Hết hàng'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`h-10 rounded-md border px-3 text-sm font-medium transition ${stockFilter === value ? 'border-sky-500 bg-sky-500/15 text-sky-100' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-gray-100'}`}
                          onClick={() => setStockFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-400">Hiển thị {filteredProducts.length} / {products.length} mặt hàng</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="max-h-[max(16rem,calc(100svh-28rem))] overflow-y-auto sm:max-h-[max(18rem,calc(100dvh-26rem))]">
                <CardContent className="p-0">
                  <div className="sticky top-0 z-10 hidden grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-gray-800 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-300 md:grid">
                    <div>Hàng hóa</div>
                    <div>Đơn vị</div>
                    <div>Tồn</div>
                    <div>Giá vốn</div>
                  </div>
                  {loading ? (
                    <div className="p-4 text-gray-400">Đang tải...</div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-4 text-gray-400">Chưa có hàng hóa.</div>
                  ) : filteredProducts.map((product) => {
                    const low = Number(product.onHandBaseQty || 0) <= Number(product.min_stock_base_qty || 0)
                    const onHandBaseQty = Number(product.onHandBaseQty || 0)
                    const largestUnit = (product.units || [])
                      .filter((unit) => Number(unit.conversion_to_base_qty || 0) > 1)
                      .sort((left, right) => Number(right.conversion_to_base_qty || 0) - Number(left.conversion_to_base_qty || 0))[0]
                    const largestUnitConversion = Number(largestUnit?.conversion_to_base_qty || 0)
                    const largestUnitCount = largestUnitConversion > 0 ? Math.floor(onHandBaseQty / largestUnitConversion) : 0
                    const baseUnitRemainder = largestUnitConversion > 0 ? onHandBaseQty - largestUnitCount * largestUnitConversion : onHandBaseQty
                    return (
                      <div key={product.id} className="grid grid-cols-1 gap-3 border-b border-gray-900 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:py-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/inventory/products/${product.id}`} className="font-semibold text-gray-100 hover:text-sky-200">{product.name}</Link>
                            {low && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-900 bg-amber-950/40 px-2 py-0.5 text-sm text-amber-200">
                                <AlertTriangle className="h-3.5 w-3.5" /> Sắp hết
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{product.sku || 'Chưa có mã'} · {product.category || 'Chưa phân nhóm'}</p>
                        </div>
                        <div className="space-y-1 text-base text-gray-200">
                          {product.units.map((unit) => (
                            <p key={unit.id || unit.unit_name}>{unit.unit_name} = {formatInventoryQuantity(unit.conversion_to_base_qty)}</p>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <div className={low ? 'font-semibold text-amber-200' : 'text-gray-100'}>
                            {largestUnit ? (
                              <>
                                <p>{formatInventoryQuantity(largestUnitCount)} {largestUnit.unit_name}</p>
                                {baseUnitRemainder > 0 && <p>{formatInventoryQuantity(baseUnitRemainder)} {product.base_unit_name}</p>}
                              </>
                            ) : (
                              <p>{formatProductStock(product)}</p>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">Tối thiểu {formatInventoryQuantity(product.min_stock_base_qty)} {product.base_unit_name}</p>
                        </div>
                        <div className="text-gray-100">{formatMoney(product.avgCostPerBaseUnit)} / {product.base_unit_name}</div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
