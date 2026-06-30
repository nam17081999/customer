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
          className="btn btn-outline btn-sm"
          onClick={() => { setProductPage(1); loadProducts(1) }}
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
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
      <div className="toolbar">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder="Tên hoặc mã SP..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setProductPage(1) }}
            onKeyDown={(e) => e.key === 'Enter' && loadProducts(1)}
          />
        </div>

        <div className="filter-chips">
          {[
            ['all', 'Tất cả', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'],
            ['active', 'Đang KD', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
            ['inactive', 'Ngừng KD', 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z'],
            ['low', 'Tồn thấp', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'],
          ].map(([value, label, svgPath]) => (
            <button
              key={value}
              type="button"
              className={`chip${stockFilter === value ? ' active' : ''}`}
              onClick={() => { setStockFilter(value); setProductPage(1) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={svgPath} /></svg>
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setFilterSheetOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" /></svg>
          Bộ lọc
        </button>

        <div className="toolbar-extra">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          >
            <Filter className="h-3.5 w-3.5" />
            Lọc nâng cao
          </button>
          <button type="button" className="btn btn-outline btn-sm">
            <Download className="h-3.5 w-3.5" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Filter Panel (desktop) */}
      {filterPanelOpen && (
        <div className="filter-panel open">
          <div className="filter-grid">
            <div className="filter-group">
              <label>Danh mục</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Tất cả</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Trạng thái</label>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="active">Đang KD</option>
                <option value="inactive">Ngừng KD</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Tồn kho ≤</label>
              <input type="number" min="0" placeholder="VD: 5" />
            </div>
            <div className="filter-group">
              <label>ĐVT</label>
              <select>
                <option value="">Tất cả</option>
                <option>Thùng</option>
                <option>Chai</option>
                <option>Lốc</option>
                <option>Két</option>
              </select>
            </div>
          </div>
          <div className="filter-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { setCategory(''); setStockFilter('all'); setQuery('') }}
            >
              Đặt lại
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setFilterPanelOpen(false)}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table className="p-table">
          <thead>
            <tr>
              <th>Mã SP</th>
              <th>Tên sản phẩm</th>
              <th className="p-unit">ĐVT</th>
              <th style={{ textAlign: 'right' }}>Giá bán</th>
              <th style={{ textAlign: 'center' }}>Tồn kho</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
              <th className="p-actions">Thao tác</th>
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
                  <td className="p-code">{product.sku || '---'}</td>
                  <td>
                    <div className="p-name">{product.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{product.category || 'Chưa phân nhóm'}</div>
                  </td>
                  <td className="p-unit" style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {largestUnit ? (
                      <>1 {largestUnit.unit_name} = {formatInventoryQuantity(largestConv)} {product.base_unit_name}</>
                    ) : (
                      product.base_unit_name || '---'
                    )}
                  </td>
                  <td className="p-price">{formatMoney(product.retail_price || 0)}</td>
                  <td className={`p-stock ${statusInfo.status === 'warning' || statusInfo.status === 'danger' ? 'low' : ''}`}>
                    {largestUnit ? (
                      <>{formatInventoryQuantity(largestCount)} {largestUnit.unit_name}{remainder > 0 ? ` + ${formatInventoryQuantity(remainder)} ${product.base_unit_name}` : ''}</>
                    ) : (
                      <>{formatInventoryQuantity(qty)} {product.base_unit_name}</>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Tối thiểu {formatInventoryQuantity(product.min_stock_base_qty || 0)}</div>
                  </td>
                  <td className="p-status">
                    <StatusBadge status={statusInfo.status} label={statusInfo.label} />
                  </td>
                  <td className="p-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={(e) => { e.stopPropagation(); openEditModal(product) }}
                      title="Sửa"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--red)', padding: '5px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer', marginLeft: 4 }}
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
          <div className="filter-backdrop open" onClick={() => setFilterSheetOpen(false)} />
          <div className="filter-sheet open">
            <div className="sheet-handle" />
            <div className="sheet-title">Bộ lọc</div>
            <div className="sheet-group">
              <label>Danh mục</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Tất cả</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="sheet-group">
              <label>Trạng thái</label>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="active">Đang KD</option>
                <option value="inactive">Ngừng KD</option>
              </select>
            </div>
            <div className="sheet-group">
              <label>Tồn kho ≤</label>
              <input type="number" min="0" placeholder="VD: 5" />
            </div>
            <div className="sheet-group">
              <label>ĐVT</label>
              <select>
                <option value="">Tất cả</option>
                <option>Thùng</option>
                <option>Chai</option>
                <option>Lốc</option>
                <option>Két</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="apply-btn"
                style={{ flex: 1, background: 'var(--border)', color: 'var(--fg)' }}
                onClick={() => { setCategory(''); setStockFilter('all'); setQuery('') }}
              >
                Đặt lại
              </button>
              <button
                type="button"
                className="apply-btn"
                style={{ flex: 3 }}
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
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Thêm sản phẩm</h3>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="field-group">
                  <label>Tên sản phẩm <span className="opt">(bắt buộc)</span></label>
                  <input className="f-input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="VD: Bia Heniken 330ml" maxLength={120} />
                </div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label>Mã SKU</label>
                    <input className="f-input" value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} placeholder="Tự động sinh" />
                  </div>
                  <div className="field-group">
                    <label>Danh mục</label>
                    <input className="f-input" value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="VD: Bia, Nước ngọt" />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label>Đơn vị gốc</label>
                    <input className="f-input" value={form.baseUnitName} onChange={(e) => updateForm('baseUnitName', e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>Tồn tối thiểu</label>
                    <input className="f-input" type="number" min="0" value={form.minStockBaseQty} onChange={(e) => updateForm('minStockBaseQty', e.target.value)} />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label>Giá bán lẻ <span className="opt">(VNĐ)</span></label>
                    <input className="f-input" type="number" min="0" value={form.defaultSalePrice} onChange={(e) => updateForm('defaultSalePrice', e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>Giá nhập <span className="opt">(VNĐ)</span></label>
                    <input className="f-input" type="number" min="0" value={form.defaultPurchasePrice} onChange={(e) => updateForm('defaultPurchasePrice', e.target.value)} />
                  </div>
                </div>

                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Đơn vị thùng mặc định</p>
                  <div className="form-row-2">
                    <div className="field-group">
                      <label>Tên</label>
                      <input className="f-input" value={form.caseUnitName} onChange={(e) => updateForm('caseUnitName', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Quy đổi</label>
                      <input className="f-input" type="number" min="2" value={form.caseConversion} onChange={(e) => updateForm('caseConversion', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row-2" style={{ marginTop: 12 }}>
                    <div className="field-group">
                      <label>Giá bán/thùng</label>
                      <input className="f-input" type="number" min="0" value={form.caseSalePrice} onChange={(e) => updateForm('caseSalePrice', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Giá nhập/thùng</label>
                      <input className="f-input" type="number" min="0" value={form.casePurchasePrice} onChange={(e) => updateForm('casePurchasePrice', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="field-group">
                  <label>Ghi chú</label>
                  <textarea className="f-input" value={form.note} onChange={(e) => updateForm('note', e.target.value)} placeholder="VD: Sản phẩm mới về, giá tốt"></textarea>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Thêm sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'edit' && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <div className="modal-head">
              <h3>Sửa sản phẩm</h3>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="field-group">
                  <label>Tên sản phẩm <span className="opt">(bắt buộc)</span></label>
                  <input className="f-input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} maxLength={120} />
                </div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label>Mã SKU</label>
                    <input className="f-input" value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} readOnly />
                  </div>
                  <div className="field-group">
                    <label>Danh mục</label>
                    <input className="f-input" value={form.category} onChange={(e) => updateForm('category', e.target.value)} />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label>Đơn vị gốc</label>
                    <input className="f-input" value={form.baseUnitName} onChange={(e) => updateForm('baseUnitName', e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>Tồn tối thiểu</label>
                    <input className="f-input" type="number" min="0" value={form.minStockBaseQty} onChange={(e) => updateForm('minStockBaseQty', e.target.value)} />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="field-group">
                    <label>Giá bán lẻ <span className="opt">(VNĐ)</span></label>
                    <input className="f-input" type="number" min="0" value={form.defaultSalePrice} onChange={(e) => updateForm('defaultSalePrice', e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label>Giá nhập <span className="opt">(VNĐ)</span></label>
                    <input className="f-input" type="number" min="0" value={form.defaultPurchasePrice} onChange={(e) => updateForm('defaultPurchasePrice', e.target.value)} />
                  </div>
                </div>

                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Đơn vị thùng mặc định</p>
                  <div className="form-row-2">
                    <div className="field-group">
                      <label>Tên</label>
                      <input className="f-input" value={form.caseUnitName} onChange={(e) => updateForm('caseUnitName', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Quy đổi</label>
                      <input className="f-input" type="number" min="2" value={form.caseConversion} onChange={(e) => updateForm('caseConversion', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row-2" style={{ marginTop: 12 }}>
                    <div className="field-group">
                      <label>Giá bán/thùng</label>
                      <input className="f-input" type="number" min="0" value={form.caseSalePrice} onChange={(e) => updateForm('caseSalePrice', e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Giá nhập/thùng</label>
                      <input className="f-input" type="number" min="0" value={form.casePurchasePrice} onChange={(e) => updateForm('casePurchasePrice', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="field-group">
                  <label>Ghi chú</label>
                  <textarea className="f-input" value={form.note} onChange={(e) => updateForm('note', e.target.value)}></textarea>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showModal === 'detail' && editProduct && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-head">
              <h3>Chi tiết sản phẩm</h3>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="info-card">
                <div className="ic-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <div>
                  <div className="ic-name">{editProduct.name}</div>
                  <div className="ic-code">{editProduct.sku || '---'}</div>
                  <div className="ic-tags">
                    <StatusBadge status="info" label={editProduct.category || 'Chưa phân nhóm'} />
                    <StatusBadge status="default" label={editProduct.base_unit_name || '---'} />
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-row">
                  <span className="label">Giá nhập</span>
                  <div className="value" style={{ color: 'var(--muted)' }}>{formatMoney(editProduct.default_purchase_price || 0)}</div>
                </div>
                <div className="detail-row">
                  <span className="label">Giá bán</span>
                  <div className="value" style={{ color: 'var(--accent)' }}>{formatMoney(editProduct.retail_price || 0)}</div>
                </div>
                <div className="detail-row">
                  <span className="label">Tồn kho</span>
                  <div className="value">{formatProductStock(editProduct)}</div>
                </div>
                <div className="detail-row">
                  <span className="label">Trạng thái</span>
                  <div className="value"><StatusBadge status={getStatusInfo(editProduct).status} label={getStatusInfo(editProduct).label} /></div>
                </div>
              </div>

              {editProduct.note && (
                <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--muted)' }}>
                  <strong>Ghi chú:</strong> {editProduct.note}
                </div>
              )}

              <div className="detail-section">
                <h4>Đơn vị quy đổi</h4>
                {(editProduct.units || []).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>Chưa có đơn vị quy đổi</div>
                ) : (
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Đơn vị</th>
                        <th className="dt-qty">Quy đổi</th>
                        <th className="dt-price">Giá nhập</th>
                        <th className="dt-price">Giá bán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editProduct.units || []).map((unit) => (
                        <tr key={unit.id || unit.unit_name}>
                          <td>{unit.unit_name}</td>
                          <td className="dt-qty">1 = {formatInventoryQuantity(unit.conversion_to_base_qty)} {editProduct.base_unit_name}</td>
                          <td className="dt-price">{formatMoney(unit.default_purchase_price || 0)}</td>
                          <td className="dt-price">{formatMoney(unit.default_sale_price || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="detail-section">
                <h4>Thông tin khác</h4>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Giá vốn TB: {formatMoney(editProduct.avgCostPerBaseUnit || 0)} / {editProduct.base_unit_name}
                  &nbsp;·&nbsp; Ngày tạo: {editProduct.created_at ? new Date(editProduct.created_at).toLocaleDateString('vi-VN') : '---'}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-outline" onClick={closeModal}>Đóng</button>
              <button
                type="button"
                className="btn btn-primary"
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
