import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { getOrRefreshStores } from '@/lib/storeCache'
import {
  buildDocumentCode,
  createSalesOrder,
  formatMoney,
  listProductsWithStock,
  toNumber,
} from '@/api/inventory/inventory-client'
import { getOrderInventoryWorkbenchClasses, getSalesOrderCreateRedirect } from '@/helper/orderInventoryFlow'

function storeLabel(store) {
  if (!store) return ''
  const parts = [store.name, store.ward, store.district].filter(Boolean)
  return parts.join(' - ')
}

function newLine(products) {
  const product = products[0] || null
  const unit = product?.units?.find((item) => Number(item.conversion_to_base_qty) > 1) || product?.baseUnit || product?.units?.[0] || null
  return {
    productId: product?.id || '',
    productUnitId: unit?.id || '',
    conversionToBaseQty: unit?.conversion_to_base_qty || 1,
    quantity: '1',
    unitPrice: unit?.default_sale_price ?? product?.default_sale_price ?? '',
    costPriceBase: '',
    note: '',
  }
}

export default function NewSalesOrderPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [customerStoreId, setCustomerStoreId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [note, setNote] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/login?from=/orders/new')
      return
    }
    if (!isAdmin) {
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [productRows, storeRows] = await Promise.all([
        listProductsWithStock(),
        getOrRefreshStores(),
      ])
      setProducts(productRows)
      setStores(storeRows || [])
      setItems((prev) => (prev.length > 0 ? prev : [newLine(productRows)]))
      setCode((prev) => prev || buildDocumentCode('DH'))
    } catch (err) {
      setError(err?.message || 'Không tải được dữ liệu lên đơn.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadData()
  }, [pageReady, loadData])

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])
  const selectedCustomer = useMemo(() => stores.find((store) => String(store.id) === String(customerStoreId)), [stores, customerStoreId])

  const filteredStores = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    const list = query
      ? stores.filter((store) => storeLabel(store).toLowerCase().includes(query) || String(store.phone || '').includes(query))
      : stores
    return list.slice(0, 80)
  }, [stores, customerQuery])

  const setItem = (index, patch) => {
    setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  const selectProduct = (index, productId) => {
    const product = productsById.get(productId)
    const unit = product?.units?.find((item) => Number(item.conversion_to_base_qty) > 1) || product?.baseUnit || product?.units?.[0] || null
    setItem(index, {
      productId,
      productUnitId: unit?.id || '',
      conversionToBaseQty: unit?.conversion_to_base_qty || 1,
      unitPrice: unit?.default_sale_price ?? product?.default_sale_price ?? '',
      costPriceBase: '',
    })
  }

  const selectUnit = (index, unitId) => {
    const line = items[index]
    const product = productsById.get(line.productId)
    const unit = product?.units?.find((item) => item.id === unitId)
    setItem(index, {
      productUnitId: unitId,
      conversionToBaseQty: unit?.conversion_to_base_qty || 1,
      unitPrice: unit?.default_sale_price ?? line.unitPrice,
    })
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0), 0)
    const discount = toNumber(discountAmount, 0)
    return {
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
    }
  }, [items, discountAmount])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await createSalesOrder({
        code,
        customerStoreId,
        note,
        discountAmount,
        items,
        createdBy: user?.id || null,
      })
      router.push(getSalesOrderCreateRedirect())
    } catch (err) {
      setError(err?.message || 'Không tạo được đơn hàng.')
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
        <title>Lên đơn hàng - NPP Hà Công</title>
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <form className={`${layoutClasses.formShell} space-y-4`} onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Lên đơn hàng</h1>
              <p className="text-base text-gray-400">Chọn cửa hàng hiện có, thêm hàng, lưu là xuất kho ngay.</p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Button asChild variant="outline">
                <Link href="/inventory/products">Hàng hóa</Link>
              </Button>
              <Button type="submit" disabled={submitting || loading || products.length === 0 || !customerStoreId}>
                {submitting ? 'Đang lưu...' : 'Lưu đơn'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>
          )}

          <div className={layoutClasses.orderFormGrid}>
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h2 className="text-lg font-semibold">Thông tin đơn</h2>
                  <label className="block space-y-1">
                    <span className="text-sm text-gray-300">Mã đơn</span>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm text-gray-300">Ghi chú</span>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú đơn hàng" />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm text-gray-300">Giảm giá</span>
                    <Input type="number" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h2 className="text-lg font-semibold">Khách hàng</h2>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input className="pl-9" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Tìm tên cửa hàng hoặc SĐT" />
                  </div>
                  <select
                    className="h-12 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                    value={customerStoreId}
                    onChange={(e) => setCustomerStoreId(e.target.value)}
                  >
                    <option value="">Chọn cửa hàng</option>
                    {filteredStores.map((store) => (
                      <option key={store.id} value={store.id}>{storeLabel(store)}</option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <div className="rounded-md border border-gray-800 bg-gray-900/70 p-3 text-base text-gray-200">
                      <p className="font-semibold">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-400">{selectedCustomer.phone || 'Chưa có SĐT'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <div className={`${layoutClasses.orderItemGrid} hidden border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 sm:grid`}>
                    <div>Hàng hóa</div>
                    <div>Đơn vị</div>
                    <div>SL</div>
                    <div>Giá bán</div>
                    <div>Thành tiền</div>
                    <div />
                  </div>

                  {loading ? (
                    <div className="p-4 text-gray-400">Đang tải...</div>
                  ) : products.length === 0 ? (
                    <div className="p-4 text-gray-400">Chưa có hàng hóa.</div>
                  ) : items.map((item, index) => {
                    const product = productsById.get(item.productId)
                    const lineTotal = toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0)
                    return (
                      <div key={index} className={`${layoutClasses.orderItemGrid} border-b border-gray-900 px-3 py-3 last:border-b-0 sm:items-end sm:px-4`}>
                        <label className="block space-y-1 sm:space-y-0">
                          <span className="text-sm text-gray-300 sm:hidden">Hàng hóa</span>
                          <select
                            className="h-12 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 sm:h-11"
                            value={item.productId}
                            onChange={(e) => selectProduct(index, e.target.value)}
                          >
                            {products.map((option) => (
                              <option key={option.id} value={option.id}>{option.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block space-y-1 sm:space-y-0">
                          <span className="text-sm text-gray-300 sm:hidden">Đơn vị</span>
                          <select
                            className="h-12 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 sm:h-11"
                            value={item.productUnitId}
                            onChange={(e) => selectUnit(index, e.target.value)}
                          >
                            {(product?.units || []).map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.unit_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block space-y-1 sm:space-y-0">
                          <span className="text-sm text-gray-300 sm:hidden">Số lượng</span>
                          <Input type="number" min="0" value={item.quantity} onChange={(e) => setItem(index, { quantity: e.target.value })} />
                        </label>
                        <label className="block space-y-1 sm:space-y-0">
                          <span className="text-sm text-gray-300 sm:hidden">Giá bán</span>
                          <Input type="number" min="0" value={item.unitPrice} onChange={(e) => setItem(index, { unitPrice: e.target.value })} />
                        </label>
                        <div className="rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-base font-semibold sm:h-11">
                          {formatMoney(lineTotal)}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Xóa dòng"
                          onClick={() => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, newLine(products)])} disabled={products.length === 0}>
                  <Plus className="h-4 w-4" /> Thêm dòng
                </Button>
                <div className="rounded-md border border-gray-800 bg-gray-950 px-5 py-3 text-right">
                  <p className="text-sm text-gray-400">Tạm tính: {formatMoney(totals.subtotal)}</p>
                  <p className="text-sm text-gray-400">Giảm: {formatMoney(totals.discount)}</p>
                  <p className="text-2xl font-bold">Tổng: {formatMoney(totals.total)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="safe-area-bottom fixed inset-x-0 bottom-14 z-40 border-t border-gray-800 bg-gray-950/95 p-3 backdrop-blur sm:hidden">
            <Button type="submit" className="w-full" disabled={submitting || loading || products.length === 0 || !customerStoreId}>
              {submitting ? 'Đang lưu...' : `Lưu đơn - ${formatMoney(totals.total)}`}
            </Button>
          </div>
        </form>
      </main>
    </>
  )
}
