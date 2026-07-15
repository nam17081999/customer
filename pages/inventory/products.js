import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Download, Edit3, Filter, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiGrid } from '@/components/ui/kpi-card'
import { formatMoney } from '@/helper/inventoryFormat'
import { getOperatorErrorMessage } from '@/helper/operatorErrors'
import { createProductFromForm, loadProductManagementData, saveProductFromForm } from '@/services/inventory/inventory-page-service'
import {
  filterInventoryProducts,
  formatInventoryQuantity,
  formatProductStock,
  getInventoryProductCategories,
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
  const [productPage, setProductPage] = useState(1)
  const [productPageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)

  // Modal state
  const [showModal, setShowModal] = useState(null) // 'add' | 'edit' | 'detail' | null
  const [editProduct, setEditProduct] = useState(null)

  // Filter panel / sheet
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

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

  const loadProducts = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const result = await loadProductManagementData({ page, pageSize: productPageSize })
      setProducts(result.products || [])
      setTotalCount(result.totalCount || 0)
      setProductPage(result.page || 1)
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Không tải được hàng hóa.'))
      setProducts([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [productPageSize])

  useEffect(() => {
    if (!pageReady) return
    loadProducts(1)
  }, [pageReady, loadProducts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem('storevis:flash-message')
      if (!raw) return
      window.sessionStorage.removeItem('storevis:flash-message')
      const parsed = JSON.parse(raw)
      if (parsed?.text) setMessage(parsed.text)
    } catch {
      // ignore parse errors
    }
  }, [])

  const categories = useMemo(() => getInventoryProductCategories(products), [products])
  const summary = useMemo(() => summarizeInventoryProducts(products), [products])
  const activeCount = useMemo(() => products.filter((p) => p.active !== false).length, [products])
  const inactiveCount = useMemo(() => products.filter((p) => p.active === false).length, [products])

  const filteredProducts = useMemo(() => filterInventoryProducts(products, {
    query,
    category,
    stockFilter,
  }), [products, query, category, stockFilter])

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
      setShowModal(null)
      await loadProducts()
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Không thêm được hàng hóa.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (event) => {
    event.preventDefault()
    if (submitting || !editProduct?.id) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        defaultSalePrice: form.defaultSalePrice,
        defaultPurchasePrice: form.defaultPurchasePrice,
        minStockBaseQty: form.minStockBaseQty,
        note: form.note,
      }
      await saveProductFromForm(editProduct.id, payload)
      setForm(EMPTY_FORM)
      setMessage('Đã cập nhật hàng hóa.')
      setShowModal(null)
      setEditProduct(null)
      await loadProducts()
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Không cập nhật được hàng hóa.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (product) => {
    if (!window.confirm(`Ngừng kinh doanh "${product.name}" (${product.sku || '---'})?`)) return
    setError('')
    setMessage('')
    try {
      await saveProductFromForm(product.id, { active: false })
      setMessage(`Đã ngừng kinh doanh "${product.name}".`)
      await loadProducts()
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Không ngừng được hàng hóa.'))
    }
  }

  const openAddModal = () => {
    setForm(EMPTY_FORM)
    setEditProduct(null)
    setShowModal('add')
  }

  const openEditModal = (product) => {
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      baseUnitName: product.base_unit_name || 'chai',
      defaultSalePrice: product.default_sale_price ?? '',
      defaultPurchasePrice: product.default_purchase_price ?? '',
      minStockBaseQty: product.min_stock_base_qty ?? '',
      caseUnitName: product.case_unit_name || 'thùng',
      caseConversion: product.case_conversion ?? '12',
      caseSalePrice: product.case_sale_price ?? '',
      casePurchasePrice: product.case_purchase_price ?? '',
      note: product.note || '',
    })
    setEditProduct(product)
    setShowModal('edit')
  }

  const openDetailModal = (product) => {
    setEditProduct(product)
    setShowModal('detail')
  }

  const closeModal = () => {
    setShowModal(null)
    setEditProduct(null)
    setForm(EMPTY_FORM)
  }

  const getStatusInfo = (product) => {
    const qty = Number(product.onHandBaseQty || 0)
    const min = Number(product.min_stock_base_qty || 0)
    if (product.active === false) return { status: 'inactive', label: 'Ngừng KD' }
    if (qty <= 0) return { status: 'danger', label: 'Hết hàng' }
    if (qty <= min) return { status: 'warning', label: 'Sắp hết' }
    return { status: 'active', label: 'Đang KD' }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / productPageSize))

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Hàng hóa & tồn kho - NPP Hà Công</title>
      </Head>

      {(error || message) && (
        <div className={`mb-4 rounded-[var(--radius)] border px-4 py-3 text-sm ${error ? 'border-[var(--red)]/30 bg-[var(--red)]/10 text-[var(--red)]' : 'border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]'}`}>
          {error || message}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground"
          onClick={() => { setProductPage(1); loadProducts(1) }}
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-accent text-white hover:opacity-90 border-none"
          onClick={openAddModal}
        >
          <Plus className="h-3.5 w-3.5" /> Thêm SP
        </button>
      </div>

      {/* KPI */}
      <KpiGrid
        items={[
          { label: 'Tổng SP', value: totalCount, subtitle: 'Tất cả mặt hàng', color: 'var(--accent)' },
          { label: 'Đang KD', value: activeCount, subtitle: 'Đang kinh doanh', color: 'var(--green)' },
          { label: 'Ngừng KD', value: inactiveCount, subtitle: 'Đã ngừng bán', color: 'var(--red)' },
          { label: 'Sắp hết', value: summary.lowStock, subtitle: 'Tồn ≤ mức tối thiểu', color: 'var(--amber)' },
        ]}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex items-center gap-2 h-9 rounded border border-gray-700 bg-background px-3 flex-1 min-w-[200px] max-w-[320px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder="Tên hoặc mã SP..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setProductPage(1) }}
            onKeyDown={(e) => e.key === 'Enter' && loadProducts(1)}
            className="flex-1 bg-transparent border-none text-sm text-foreground outline-none placeholder:text-muted"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[
            ['all', 'Tất cả', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'],
            ['active', 'Đang KD', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
            ['inactive', 'Ngừng KD', 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z'],
            ['low', 'Tồn thấp', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ].map(([value, label, svgPath]) => (
            <button
              key={value}
              type="button"
              className={`h-8 px-3 rounded-full text-[13px] font-medium cursor-pointer border transition-all duration-150 inline-flex items-center gap-1.5 ${stockFilter === value ? 'bg-accent text-white border-accent' : 'bg-transparent border-gray-700 text-muted hover:bg-gray-800 hover:text-foreground'}`}
              onClick={() => { setStockFilter(value); setProductPage(1) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={svgPath} /></svg>
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 h-9 px-3 rounded text-[13px] font-medium cursor-pointer border border-gray-700 bg-transparent text-muted hover:border-accent hover:text-foreground sm:hidden"
          onClick={() => setFilterSheetOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" /></svg>
          Bộ lọc
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          >
            <Filter className="h-3.5 w-3.5" />
            Lọc nâng cao
          </button>
          <button type="button" className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Filter Panel (desktop) */}
      {filterPanelOpen && (
        <div className="block mb-3 p-3 px-4 bg-gray-900 border border-gray-700 rounded-sm">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted">Danh mục</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="h-8 rounded border border-gray-700 bg-background text-foreground text-[13px] px-2 outline-none cursor-pointer focus:border-accent">
                <option value="">Tất cả</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted">Trạng thái</label>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
                className="h-8 rounded border border-gray-700 bg-background text-foreground text-[13px] px-2 outline-none cursor-pointer focus:border-accent">
                <option value="all">Tất cả</option>
                <option value="active">Đang KD</option>
                <option value="inactive">Ngừng KD</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted">Tồn kho ≤</label>
              <input type="number" min="0" placeholder="VD: 5"
                className="h-8 rounded border border-gray-700 bg-background text-foreground text-[13px] px-2 outline-none focus:border-accent" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted">ĐVT</label>
              <select
                className="h-8 rounded border border-gray-700 bg-background text-foreground text-[13px] px-2 outline-none cursor-pointer focus:border-accent">
                <option value="">Tất cả</option>
                <option>Thùng</option>
                <option>Chai</option>
                <option>Lốc</option>
                <option>Két</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground"
              onClick={() => { setCategory(''); setStockFilter('all'); setQuery('') }}
            >
              Đặt lại
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-accent text-white hover:opacity-90 border-none"
              onClick={() => setFilterPanelOpen(false)}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-700 rounded">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Tên sản phẩm</th>
              <th className="w-[80px]">ĐVT</th>
              <th style={{ textAlign: 'right' }}>Giá bán</th>
              <th style={{ textAlign: 'center' }}>Tồn kho</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
              <th className="w-[100px] text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody id="productBody">
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  <div className="text-center py-12 text-[var(--muted)] text-sm">Đang tải...</div>
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  <EmptyState
                    icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
                    title="Không tìm thấy sản phẩm"
                    description="Thử thay đổi bộ lọc hoặc tìm kiếm khác"
                  />
                </td>
              </tr>
            ) : filteredProducts.map((product) => {
              const statusInfo = getStatusInfo(product)
              const qty = Number(product.onHandBaseQty || 0)
              const largestUnit = (product.units || [])
                .filter((u) => Number(u.conversion_to_base_qty || 0) > 1)
                .sort((a, b) => Number(b.conversion_to_base_qty || 0) - Number(a.conversion_to_base_qty || 0))[0]
              const largestConv = Number(largestUnit?.conversion_to_base_qty || 0)
              const largestCount = largestConv > 0 ? Math.floor(qty / largestConv) : 0
              const remainder = largestConv > 0 ? qty - largestCount * largestConv : qty
              return (
                <tr key={product.id} onClick={() => openDetailModal(product)}>
                  <td className="font-mono text-xs">{product.sku || '---'}</td>
                  <td>
                    <div className="text-sm font-medium text-foreground">{product.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{product.category || 'Chưa phân nhóm'}</div>
                  </td>
                  <td className="w-[80px] text-muted text-xs">
                    {largestUnit ? (
                      <>1 {largestUnit.unit_name} = {formatInventoryQuantity(largestConv)} {product.base_unit_name}</>
                    ) : (
                      product.base_unit_name || '---'
                    )}
                  </td>
                  <td className="text-right font-semibold">{formatMoney(product.retail_price || 0)}</td>
                  <td className={`p-stock ${statusInfo.status === 'warning' || statusInfo.status === 'danger' ? 'low' : ''}`}>
                    {largestUnit ? (
                      <>{formatInventoryQuantity(largestCount)} {largestUnit.unit_name}{remainder > 0 ? ` + ${formatInventoryQuantity(remainder)} ${product.base_unit_name}` : ''}</>
                    ) : (
                      <>{formatInventoryQuantity(qty)} {product.base_unit_name}</>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Tối thiểu {formatInventoryQuantity(product.min_stock_base_qty || 0)}</div>
                  </td>
                  <td className="text-center">
                    <StatusBadge status={statusInfo.status} label={statusInfo.label} />
                  </td>
                  <td className="w-[100px] text-center">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); openEditModal(product) }}
                      title="Sửa"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 h-7 px-[10px] rounded-lg text-[11px] font-semibold cursor-pointer bg-transparent border border-gray-700 text-red-500 hover:bg-red-950/30 ml-1"
                      onClick={(e) => { e.stopPropagation(); handleDeactivate(product) }}
                      title="Ngừng KD"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={productPage}
        totalPages={totalPages}
        totalItems={totalCount}
        itemLabel="SP"
        onPageChange={(page) => { setProductPage(page); loadProducts(page) }}
      />

      {/* Mobile Filter Sheet */}
      {filterSheetOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setFilterSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-lg max-h-[85vh] overflow-y-auto p-5 pb-0">
            <div className="w-9 h-1 bg-gray-700 rounded-full mx-auto mb-4 shrink-0" />
            <div className="text-base font-bold mb-4 text-foreground">Bộ lọc</div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted mb-1.5">Danh mục</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded border border-gray-700 bg-background text-foreground text-sm px-3 outline-none cursor-pointer focus:border-accent">
                <option value="">Tất cả</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted mb-1.5">Trạng thái</label>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
                className="w-full h-10 rounded border border-gray-700 bg-background text-foreground text-sm px-3 outline-none cursor-pointer focus:border-accent">
                <option value="all">Tất cả</option>
                <option value="active">Đang KD</option>
                <option value="inactive">Ngừng KD</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted mb-1.5">Tồn kho ≤</label>
              <input type="number" min="0" placeholder="VD: 5"
                className="w-full h-10 rounded border border-gray-700 bg-background text-foreground text-sm px-3 outline-none focus:border-accent" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-muted mb-1.5">ĐVT</label>
              <select
                className="w-full h-10 rounded border border-gray-700 bg-background text-foreground text-sm px-3 outline-none cursor-pointer focus:border-accent">
                <option value="">Tất cả</option>
                <option>Thùng</option>
                <option>Chai</option>
                <option>Lốc</option>
                <option>Két</option>
              </select>
            </div>
            <div className="flex gap-2 mt-2 pb-5">
              <button
                type="button"
                className="flex-1 py-3 rounded text-sm font-semibold cursor-pointer bg-gray-700 text-foreground border-none"
                onClick={() => { setCategory(''); setStockFilter('all'); setQuery('') }}
              >
                Đặt lại
              </button>
              <button
                type="button"
                className="flex-[3] py-3 rounded text-sm font-semibold cursor-pointer bg-accent text-white border-none"
                onClick={() => setFilterSheetOpen(false)}
              >
                Xem kết quả
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal === 'add' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-gray-900 border border-gray-700 rounded-[10px] w-full max-w-[540px] max-h-[85vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3>Thêm sản phẩm</h3>
              <button type="button" className="w-8 h-8 rounded bg-transparent border-none text-muted cursor-pointer text-lg flex items-center justify-center hover:text-foreground hover:bg-gray-800" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label>Tên sản phẩm <span className="text-muted text-[11px] font-normal">(bắt buộc)</span></label>
                  <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="VD: Bia Heniken 330ml" maxLength={120} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label>Mã SKU</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} placeholder="Tự động sinh" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label>Danh mục</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="VD: Bia, Nước ngọt" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label>Đơn vị gốc</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.baseUnitName} onChange={(e) => updateForm('baseUnitName', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label>Tồn tối thiểu</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.minStockBaseQty} onChange={(e) => updateForm('minStockBaseQty', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label>Giá bán lẻ <span className="text-muted text-[11px] font-normal">(VNĐ)</span></label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.defaultSalePrice} onChange={(e) => updateForm('defaultSalePrice', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label>Giá nhập <span className="text-muted text-[11px] font-normal">(VNĐ)</span></label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.defaultPurchasePrice} onChange={(e) => updateForm('defaultPurchasePrice', e.target.value)} />
                  </div>
                </div>

                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Đơn vị thùng mặc định</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label>Tên</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.caseUnitName} onChange={(e) => updateForm('caseUnitName', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label>Quy đổi</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="2" value={form.caseConversion} onChange={(e) => updateForm('caseConversion', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3" style={{ marginTop: 12 }}>
                    <div className="flex flex-col gap-1.5">
                      <label>Giá bán/thùng</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.caseSalePrice} onChange={(e) => updateForm('caseSalePrice', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label>Giá nhập/thùng</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.casePurchasePrice} onChange={(e) => updateForm('casePurchasePrice', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label>Ghi chú</label>
                  <textarea className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.note} onChange={(e) => updateForm('note', e.target.value)} placeholder="VD: Sản phẩm mới về, giá tốt"></textarea>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700">
                <button type="button" className="inline-flex items-center justify-center h-[34px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground" onClick={closeModal}>Hủy</button>
                <button type="submit" className="inline-flex items-center justify-center h-[34px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-accent text-white hover:opacity-90 border-none disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Thêm sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'edit' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-gray-900 border border-gray-700 rounded-[10px] w-full max-w-[540px] max-h-[85vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3>Sửa sản phẩm</h3>
              <button type="button" className="w-8 h-8 rounded bg-transparent border-none text-muted cursor-pointer text-lg flex items-center justify-center hover:text-foreground hover:bg-gray-800" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="p-5 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label>Tên sản phẩm <span className="text-muted text-[11px] font-normal">(bắt buộc)</span></label>
                  <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.name} onChange={(e) => updateForm('name', e.target.value)} maxLength={120} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label>Mã SKU</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} readOnly />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label>Danh mục</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.category} onChange={(e) => updateForm('category', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label>Đơn vị gốc</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.baseUnitName} onChange={(e) => updateForm('baseUnitName', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label>Tồn tối thiểu</label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.minStockBaseQty} onChange={(e) => updateForm('minStockBaseQty', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label>Giá bán lẻ <span className="text-muted text-[11px] font-normal">(VNĐ)</span></label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.defaultSalePrice} onChange={(e) => updateForm('defaultSalePrice', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label>Giá nhập <span className="text-muted text-[11px] font-normal">(VNĐ)</span></label>
                    <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.defaultPurchasePrice} onChange={(e) => updateForm('defaultPurchasePrice', e.target.value)} />
                  </div>
                </div>

                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Đơn vị thùng mặc định</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label>Tên</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.caseUnitName} onChange={(e) => updateForm('caseUnitName', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label>Quy đổi</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="2" value={form.caseConversion} onChange={(e) => updateForm('caseConversion', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3" style={{ marginTop: 12 }}>
                    <div className="flex flex-col gap-1.5">
                      <label>Giá bán/thùng</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.caseSalePrice} onChange={(e) => updateForm('caseSalePrice', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label>Giá nhập/thùng</label>
                      <input className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" type="number" min="0" value={form.casePurchasePrice} onChange={(e) => updateForm('casePurchasePrice', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label>Ghi chú</label>
                  <textarea className="h-9 rounded border border-gray-700 px-3 bg-background text-foreground text-sm outline-none focus:border-accent w-full" value={form.note} onChange={(e) => updateForm('note', e.target.value)}></textarea>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700">
                <button type="button" className="inline-flex items-center justify-center h-[34px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground" onClick={closeModal}>Hủy</button>
                <button type="submit" className="inline-flex items-center justify-center h-[34px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-accent text-white hover:opacity-90 border-none disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showModal === 'detail' && editProduct && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-gray-900 border border-gray-700 rounded-[10px] w-full max-w-[540px] max-h-[85vh] overflow-y-auto shadow-lg" style={{ maxWidth: 620 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3>Chi tiết sản phẩm</h3>
              <button type="button" className="w-8 h-8 rounded bg-transparent border-none text-muted cursor-pointer text-lg flex items-center justify-center hover:text-foreground hover:bg-gray-800" onClick={closeModal}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-background rounded">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 text-muted">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-foreground">{editProduct.name}</div>
                  <div className="text-xs text-muted mb-1">{editProduct.sku || '---'}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusBadge status="info" label={editProduct.category || 'Chưa phân nhóm'} />
                    <StatusBadge status="default" label={editProduct.base_unit_name || '---'} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-0.5 p-2.5 bg-background rounded">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Giá nhập</span>
                  <div className="text-sm font-semibold text-muted">{formatMoney(editProduct.default_purchase_price || 0)}</div>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5 bg-background rounded">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Giá bán</span>
                  <div className="text-sm font-semibold text-accent">{formatMoney(editProduct.retail_price || 0)}</div>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5 bg-background rounded">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Tồn kho</span>
                  <div className="text-sm font-semibold text-foreground">{formatProductStock(editProduct)}</div>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5 bg-background rounded">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Trạng thái</span>
                  <div className="text-sm font-semibold text-foreground"><StatusBadge status={getStatusInfo(editProduct).status} label={getStatusInfo(editProduct).label} /></div>
                </div>
              </div>

              {editProduct.note && (
                <div className="p-2 bg-background rounded text-[13px] text-muted">
                  <strong>Ghi chú:</strong> {editProduct.note}
                </div>
              )}

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Đơn vị quy đổi</h4>
                {(editProduct.units || []).length === 0 ? (
                  <div className="text-[13px] text-muted py-2">Chưa có đơn vị quy đổi</div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="text-left px-2 py-1.5 text-[11px] uppercase tracking-[0.03em] text-muted font-semibold border-b border-gray-700">Đơn vị</th>
                        <th className="text-left px-2 py-1.5 text-[11px] uppercase tracking-[0.03em] text-muted font-semibold border-b border-gray-700 w-[140px]">Quy đổi</th>
                        <th className="text-left px-2 py-1.5 text-[11px] uppercase tracking-[0.03em] text-muted font-semibold border-b border-gray-700 w-[100px] text-right">Giá nhập</th>
                        <th className="text-left px-2 py-1.5 text-[11px] uppercase tracking-[0.03em] text-muted font-semibold border-b border-gray-700 w-[100px] text-right">Giá bán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editProduct.units || []).map((unit) => (
                        <tr key={unit.id || unit.unit_name}>
                          <td className="px-2 py-2 border-b border-gray-700">{unit.unit_name}</td>
                          <td className="px-2 py-2 border-b border-gray-700 w-[140px]">1 = {formatInventoryQuantity(unit.conversion_to_base_qty)} {editProduct.base_unit_name}</td>
                          <td className="px-2 py-2 border-b border-gray-700 w-[100px] text-right font-semibold">{formatMoney(unit.default_purchase_price || 0)}</td>
                          <td className="px-2 py-2 border-b border-gray-700 w-[100px] text-right font-semibold">{formatMoney(unit.default_sale_price || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Thông tin khác</h4>
                <div className="text-[13px] text-muted">
                  Giá vốn TB: {formatMoney(editProduct.avgCostPerBaseUnit || 0)} / {editProduct.base_unit_name}
                  &nbsp;·&nbsp; Ngày tạo: {editProduct.created_at ? new Date(editProduct.created_at).toLocaleDateString('vi-VN') : '---'}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700">
              <button type="button" className="inline-flex items-center justify-center h-[34px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-transparent border border-gray-700 text-muted hover:border-accent hover:text-foreground" onClick={closeModal}>Đóng</button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-[34px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-accent text-white hover:opacity-90 border-none"
                onClick={() => { const p = editProduct; closeModal(); setTimeout(() => openEditModal(p), 50) }}
              >
                Sửa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
