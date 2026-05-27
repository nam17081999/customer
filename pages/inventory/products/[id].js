import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowLeft, Save } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { formatMoney } from '@/helper/inventoryFormat'
import { formatProductStock, getOrderInventoryWorkbenchClasses } from '@/helper/orderInventoryFlow'
import { getOperatorErrorMessage } from '@/helper/operatorErrors'
import { createProductUnitFromForm, loadProductEditData, saveProductFromForm, saveProductUnitFromForm } from '@/services/inventory/inventory-page-service'

function buildForm(product) {
  return {
    name: product?.name || '',
    sku: product?.sku || '',
    category: product?.category || '',
    defaultSalePrice: product?.default_sale_price ?? '',
    defaultPurchasePrice: product?.default_purchase_price ?? '',
    minStockBaseQty: product?.min_stock_base_qty ?? '',
    active: product?.active !== false,
    note: product?.note || '',
  }
}

function buildUnitForm(unit) {
  return {
    unitName: unit?.unit_name || '',
    conversionToBaseQty: unit?.conversion_to_base_qty ?? '',
    defaultSalePrice: unit?.default_sale_price ?? '',
    defaultPurchasePrice: unit?.default_purchase_price ?? '',
    active: unit?.active !== false,
    isBaseUnit: Boolean(unit?.is_base_unit),
  }
}

const EMPTY_UNIT_FORM = {
  unitName: '',
  conversionToBaseQty: '',
  defaultSalePrice: '',
  defaultPurchasePrice: '',
  active: true,
  isBaseUnit: false,
}

export default function ProductEditPage() {
  const router = useRouter()
  const { id } = router.query
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(buildForm(null))
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [unitSubmittingId, setUnitSubmittingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [unitForms, setUnitForms] = useState({})
  const [newUnitForm, setNewUnitForm] = useState(EMPTY_UNIT_FORM)
  const layoutClasses = useMemo(() => getOrderInventoryWorkbenchClasses(), [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return router.replace(`/login?from=/inventory/products/${id || ''}`)
    if (!isAdmin) return router.replace('/account')
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router, id])

  const loadProduct = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const { product: row } = await loadProductEditData(id)
      setProduct(row)
      setForm(buildForm(row))
      setUnitForms(Object.fromEntries((row?.units || []).map((unit) => [unit.id, buildUnitForm(unit)])))
      setNewUnitForm(EMPTY_UNIT_FORM)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được hàng hóa.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { if (pageReady) loadProduct() }, [pageReady, loadProduct])

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const updateUnitForm = (unitId, field, value) => setUnitForms((prev) => ({
    ...prev,
    [unitId]: {
      ...(prev[unitId] || {}),
      [field]: value,
    },
  }))
  const updateNewUnitForm = (field, value) => setNewUnitForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const saved = await saveProductFromForm(id, form)
      setProduct((prev) => ({ ...prev, ...saved }))
      setMessage('Đã lưu hàng hóa.')
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không lưu được hàng hóa.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnitSubmit = async (unit) => {
    if (!unit?.id || unitSubmittingId) return
    setUnitSubmittingId(unit.id)
    setError('')
    setMessage('')
    try {
      await saveProductUnitFromForm(unit.id, unitForms[unit.id] || buildUnitForm(unit))
      setMessage('Đã lưu đơn vị.')
      await loadProduct()
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không lưu được đơn vị.')
    } finally {
      setUnitSubmittingId('')
    }
  }

  const handleAddUnit = async () => {
    if (unitSubmittingId) return
    setUnitSubmittingId('new')
    setError('')
    setMessage('')
    try {
      await createProductUnitFromForm(id, newUnitForm)
      setMessage('Đã thêm đơn vị.')
      await loadProduct()
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không thêm được đơn vị.')
    } finally {
      setUnitSubmittingId('')
    }
  }

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />

  return (
    <>
      <Head><title>Sửa hàng hóa - NPP Hà Công</title></Head>
      <main className="min-h-screen bg-black text-gray-100">
        <form className={`${layoutClasses.formShell} space-y-4`} onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Button asChild variant="outline"><Link href="/inventory/products"><ArrowLeft className="h-4 w-4" /> Hàng hóa</Link></Button>
              <h1 className="mt-3 text-2xl font-bold">Sửa hàng hóa</h1>
              <p className="text-base text-gray-400">{product?.name || 'Thông tin mặt hàng'}</p>
            </div>
            <Button type="submit" disabled={submitting || loading}><Save className="h-4 w-4" /> {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
          </div>
          {(error || message) && <div className={`rounded-md border px-4 py-3 ${error ? 'border-red-900 bg-red-950/30 text-red-200' : 'border-green-900 bg-green-950/30 text-green-200'}`}>{error || message}</div>}
          {loading ? <Card><CardContent className="p-4 text-gray-400">Đang tải...</CardContent></Card> : product ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] min-[1900px]:grid-cols-[1fr_430px]">
              <Card><CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                <label className="block space-y-1 md:col-span-2"><span className="text-sm text-gray-300">Tên hàng</span><Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} /></label>
                <label className="block space-y-1"><span className="text-sm text-gray-300">Mã hàng</span><Input value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} /></label>
                <label className="block space-y-1"><span className="text-sm text-gray-300">Nhóm</span><Input value={form.category} onChange={(e) => updateForm('category', e.target.value)} /></label>
                <label className="block space-y-1"><span className="text-sm text-gray-300">Giá bán/gốc</span><Input type="number" min="0" value={form.defaultSalePrice} onChange={(e) => updateForm('defaultSalePrice', e.target.value)} /></label>
                <label className="block space-y-1"><span className="text-sm text-gray-300">Giá nhập/gốc</span><Input type="number" min="0" value={form.defaultPurchasePrice} onChange={(e) => updateForm('defaultPurchasePrice', e.target.value)} /></label>
                <label className="block space-y-1"><span className="text-sm text-gray-300">Tồn tối thiểu</span><Input type="number" min="0" value={form.minStockBaseQty} onChange={(e) => updateForm('minStockBaseQty', e.target.value)} /></label>
                <label className="flex items-center gap-3 rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2"><input type="checkbox" checked={form.active} onChange={(e) => updateForm('active', e.target.checked)} className="h-5 w-5" /><span>Còn bán</span></label>
                <label className="block space-y-1 md:col-span-2"><span className="text-sm text-gray-300">Ghi chú</span><Input value={form.note} onChange={(e) => updateForm('note', e.target.value)} /></label>
              </CardContent></Card>
              <div className="space-y-4">
                <Card><CardContent className="space-y-2 p-4">
                  <h2 className="text-lg font-semibold">Tồn kho</h2>
                  <p className="text-2xl font-bold">{formatProductStock(product)}</p>
                  <p className="text-gray-400">Giá vốn: {formatMoney(product.avgCostPerBaseUnit)} / {product.base_unit_name}</p>
                </CardContent></Card>
                <Card><CardContent className="space-y-3 p-4">
                  <h2 className="text-lg font-semibold">Đơn vị</h2>
                  {(product.units || []).map((unit) => {
                    const unitForm = unitForms[unit.id] || buildUnitForm(unit)
                    return (
                      <div key={unit.id} className="space-y-3 rounded-md border border-gray-800 bg-gray-900/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{unit.is_base_unit ? 'Đơn vị gốc' : 'Đơn vị bán/nhập'}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-sm ${unitForm.active ? 'border-green-900 bg-green-950/30 text-green-200' : 'border-red-900 bg-red-950/30 text-red-200'}`}>
                            {unitForm.active ? 'Đang dùng' : 'Tạm ngừng'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="block space-y-1"><span className="text-sm text-gray-300">Tên đơn vị</span><Input value={unitForm.unitName} onChange={(e) => updateUnitForm(unit.id, 'unitName', e.target.value)} /></label>
                          <label className="block space-y-1"><span className="text-sm text-gray-300">Quy đổi về {product.base_unit_name}</span><Input type="number" min="0.001" value={unitForm.conversionToBaseQty} disabled={unit.is_base_unit} onChange={(e) => updateUnitForm(unit.id, 'conversionToBaseQty', e.target.value)} /></label>
                          <label className="block space-y-1"><span className="text-sm text-gray-300">Giá bán</span><Input type="number" min="0" value={unitForm.defaultSalePrice} onChange={(e) => updateUnitForm(unit.id, 'defaultSalePrice', e.target.value)} /></label>
                          <label className="block space-y-1"><span className="text-sm text-gray-300">Giá nhập</span><Input type="number" min="0" value={unitForm.defaultPurchasePrice} onChange={(e) => updateUnitForm(unit.id, 'defaultPurchasePrice', e.target.value)} /></label>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-base text-gray-200">
                            <input type="checkbox" className="h-5 w-5" checked={unitForm.active} disabled={unit.is_base_unit} onChange={(e) => updateUnitForm(unit.id, 'active', e.target.checked)} />
                            Còn dùng đơn vị này
                          </label>
                          <Button type="button" variant="outline" onClick={() => handleUnitSubmit(unit)} disabled={unitSubmittingId === unit.id}>
                            {unitSubmittingId === unit.id ? 'Đang lưu...' : 'Lưu đơn vị'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  <div className="space-y-3 rounded-md border border-sky-900/50 bg-sky-950/10 p-3">
                    <p className="font-semibold text-sky-100">Thêm đơn vị quy đổi</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="block space-y-1"><span className="text-sm text-gray-300">Tên đơn vị</span><Input value={newUnitForm.unitName} onChange={(e) => updateNewUnitForm('unitName', e.target.value)} placeholder="thùng 24" /></label>
                      <label className="block space-y-1"><span className="text-sm text-gray-300">Quy đổi về {product.base_unit_name}</span><Input type="number" min="0.001" value={newUnitForm.conversionToBaseQty} onChange={(e) => updateNewUnitForm('conversionToBaseQty', e.target.value)} placeholder="24" /></label>
                      <label className="block space-y-1"><span className="text-sm text-gray-300">Giá bán</span><Input type="number" min="0" value={newUnitForm.defaultSalePrice} onChange={(e) => updateNewUnitForm('defaultSalePrice', e.target.value)} /></label>
                      <label className="block space-y-1"><span className="text-sm text-gray-300">Giá nhập</span><Input type="number" min="0" value={newUnitForm.defaultPurchasePrice} onChange={(e) => updateNewUnitForm('defaultPurchasePrice', e.target.value)} /></label>
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddUnit} disabled={unitSubmittingId === 'new'}>
                      {unitSubmittingId === 'new' ? 'Đang thêm...' : 'Thêm đơn vị'}
                    </Button>
                  </div>
                </CardContent></Card>
              </div>
            </div>
          ) : <Card><CardContent className="p-4 text-gray-400">Không tìm thấy hàng hóa.</CardContent></Card>}
        </form>
      </main>
    </>
  )
}
