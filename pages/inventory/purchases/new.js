import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import {
  buildDocumentCode,
  createPurchaseOrder,
  formatMoney,
  listProductsWithStock,
  toNumber,
} from '@/api/inventory/inventory-client'
import { getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'

function newLine(products) {
  const product = products[0] || null
  const unit = product?.units?.find((item) => Number(item.conversion_to_base_qty) > 1) || product?.baseUnit || product?.units?.[0] || null
  return {
    productId: product?.id || '',
    productUnitId: unit?.id || '',
    conversionToBaseQty: unit?.conversion_to_base_qty || 1,
    quantity: '1',
    unitCost: unit?.default_purchase_price ?? product?.default_purchase_price ?? '',
    note: '',
  }
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/login?from=/inventory/purchases/new')
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
      const data = await listProductsWithStock()
      setProducts(data)
      setItems((prev) => (prev.length > 0 ? prev : [newLine(data)]))
      setCode((prev) => prev || buildDocumentCode('PN'))
    } catch (err) {
      setError(err?.message || 'Không tải được hàng hóa.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadProducts()
  }, [pageReady, loadProducts])

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])

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
      unitCost: unit?.default_purchase_price ?? product?.default_purchase_price ?? '',
    })
  }

  const selectUnit = (index, unitId) => {
    const line = items[index]
    const product = productsById.get(line.productId)
    const unit = product?.units?.find((item) => item.id === unitId)
    setItem(index, {
      productUnitId: unitId,
      conversionToBaseQty: unit?.conversion_to_base_qty || 1,
      unitCost: unit?.default_purchase_price ?? line.unitCost,
    })
  }

  const totals = useMemo(() => {
    return items.reduce((sum, item) => sum + toNumber(item.quantity, 0) * toNumber(item.unitCost, 0), 0)
  }, [items])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await createPurchaseOrder({
        code,
        supplierName,
        note,
        items,
        createdBy: user?.id || null,
      })
      router.push('/inventory/products')
    } catch (err) {
      setError(err?.message || 'Không tạo được phiếu nhập.')
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
        <title>Nhập hàng - NPP Hà Công</title>
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <form className={`${layoutClasses.shell} space-y-4`} onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Nhập hàng</h1>
              <p className="text-base text-gray-400">Tạo phiếu là hàng vào kho ngay.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/inventory/products">Hàng hóa</Link>
              </Button>
              <Button type="submit" disabled={submitting || loading || products.length === 0}>
                {submitting ? 'Đang lưu...' : 'Lưu phiếu nhập'}
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-red-200">{error}</div>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-sm text-gray-300">Mã phiếu</span>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-gray-300">Nhà cung cấp</span>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tên nhà cung cấp" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-gray-300">Ghi chú</span>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className={`${layoutClasses.purchaseGrid} border-b border-gray-800 px-4 py-3 text-sm font-semibold text-gray-300`}>
                <div>Hàng hóa</div>
                <div>Đơn vị</div>
                <div>Số lượng</div>
                <div>Giá nhập</div>
                <div>Thành tiền</div>
                <div />
              </div>

              {loading ? (
                <div className="p-4 text-gray-400">Đang tải hàng hóa...</div>
              ) : products.length === 0 ? (
                <div className="p-4 text-gray-400">Chưa có hàng hóa. Hãy tạo hàng hóa trước.</div>
              ) : items.map((item, index) => {
                const product = productsById.get(item.productId)
                return (
                  <div key={index} className={`${layoutClasses.purchaseGrid} items-end border-b border-gray-900 px-4 py-3 last:border-b-0`}>
                    <select
                      className="h-11 rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                      value={item.productId}
                      onChange={(e) => selectProduct(index, e.target.value)}
                    >
                      {products.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                      value={item.productUnitId}
                      onChange={(e) => selectUnit(index, e.target.value)}
                    >
                      {(product?.units || []).map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unit_name} ({formatMoney(unit.conversion_to_base_qty)} {product.base_unit_name})
                        </option>
                      ))}
                    </select>
                    <Input type="number" min="0" value={item.quantity} onChange={(e) => setItem(index, { quantity: e.target.value })} />
                    <Input type="number" min="0" value={item.unitCost} onChange={(e) => setItem(index, { unitCost: e.target.value })} />
                    <div className="h-11 rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-base font-semibold">
                      {formatMoney(toNumber(item.quantity, 0) * toNumber(item.unitCost, 0))}
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

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, newLine(products)])} disabled={products.length === 0}>
              <Plus className="h-4 w-4" /> Thêm dòng
            </Button>
            <div className="rounded-md border border-gray-800 bg-gray-950 px-5 py-3 text-right">
              <p className="text-sm text-gray-400">Tổng nhập</p>
              <p className="text-2xl font-bold">{formatMoney(totals)}</p>
            </div>
          </div>
        </form>
      </main>
    </>
  )
}
