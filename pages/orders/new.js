import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Msg } from '@/components/ui/msg'
import { buildDocumentCode, formatMoney, toNumber } from '@/helper/inventoryFormat'
import { loadSalesOrderEntryData, submitSalesOrderFromForm } from '@/services/inventory/inventory-page-service'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  addSalesOrderDraft,
  addSalesOrderDraftForStore,
  buildSalesOrderDraftStoragePayload,
  closeSalesOrderDraft,
  createSalesOrderDraft,
  createSalesOrderLine,
  createMutationRequestId,
  filterInventoryProducts,
  assertSalesOrderStockAvailable,
  getSalesOrderStockIssues,
  getSalesOrderCreateRedirect,
  parseSalesOrderDraftStoragePayload,
  updateSalesOrderDraft,
} from '@/helper/orderInventoryFlow'
import { getRecentProductsFromOrderDrafts, mergeSalesOrderLine } from '@/helper/operatorWorkflow'
import { logAuditEvent } from '@/helper/api/audit-client'

const SALES_ORDER_DRAFTS_STORAGE_KEY = 'storevis:sales-order-drafts:v1'
const ORDER_FLASH_MESSAGE_KEY = 'storevis:order-flash-message'

function readSavedSalesOrderDrafts() {
  if (typeof window === 'undefined') return null
  try {
    return parseSalesOrderDraftStoragePayload(window.localStorage.getItem(SALES_ORDER_DRAFTS_STORAGE_KEY))
  } catch {
    return null
  }
}

function clearSavedSalesOrderDrafts() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SALES_ORDER_DRAFTS_STORAGE_KEY)
  } catch {
    // Ignore storage failures; submit success is already completed.
  }
}

function storeLabel(store) {
  if (!store) return ''
  return [store.name, store.ward, store.district].filter(Boolean).join(' - ')
}

export default function NewSalesOrderPage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [drafts, setDrafts] = useState([])
  const [activeDraftId, setActiveDraftId] = useState('')
  const [draftStorageReady, setDraftStorageReady] = useState(false)
  const [appliedQuickOrderStoreId, setAppliedQuickOrderStoreId] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [error, setError] = useState('')
  const [msgState, setMsgState] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

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
      const { products: productRows, stores: storeRows } = await loadSalesOrderEntryData()
      setProducts(productRows)
      setStores(storeRows || [])
      setDrafts((prev) => {
        if (prev.length > 0) return prev
        const savedPayload = readSavedSalesOrderDrafts()
        if (savedPayload?.drafts?.length > 0) {
          setActiveDraftId(savedPayload.activeDraftId)
          return savedPayload.drafts
        }

        const rawStoreId = Array.isArray(router.query.storeId) ? router.query.storeId[0] : router.query.storeId
        const hasQuickOrderStore = rawStoreId && (storeRows || []).some((store) => String(store?.id) === String(rawStoreId))
        if (hasQuickOrderStore) return []

        const firstDraft = createSalesOrderDraft({
          draftNumber: 1,
          products: productRows,
          code: buildDocumentCode('DH'),
        })
        setActiveDraftId(firstDraft.id)
        return [firstDraft]
      })
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tải được dữ liệu lên đơn.')
    } finally {
      setDraftStorageReady(true)
      setLoading(false)
    }
  }, [router.query.storeId])

  useEffect(() => {
    if (!pageReady) return
    loadData()
  }, [pageReady, loadData])

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const activeDraft = useMemo(() => (
    drafts.find((draft) => draft.id === activeDraftId) || drafts[0] || null
  ), [activeDraftId, drafts])
  const selectedCustomer = useMemo(() => stores.find((store) => String(store.id) === String(activeDraft?.customerStoreId)), [stores, activeDraft?.customerStoreId])
  const recentProducts = useMemo(() => getRecentProductsFromOrderDrafts(drafts, productsById, 6), [drafts, productsById])

  useEffect(() => {
    if (!pageReady || !draftStorageReady || drafts.length === 0 || typeof window === 'undefined') return
    const payload = buildSalesOrderDraftStoragePayload({ drafts, activeDraftId })
    try {
      if (payload) {
        window.localStorage.setItem(SALES_ORDER_DRAFTS_STORAGE_KEY, JSON.stringify(payload))
      } else {
        window.localStorage.removeItem(SALES_ORDER_DRAFTS_STORAGE_KEY)
      }
    } catch {
      // Browser storage can be unavailable in private mode; drafts still work in memory.
    }
  }, [activeDraftId, draftStorageReady, drafts, pageReady])

  const patchActiveDraft = useCallback((patch) => {
    if (!activeDraft?.id) return
    setDrafts((prev) => updateSalesOrderDraft(prev, activeDraft.id, patch))
  }, [activeDraft?.id])

  const consumeQuickOrderQuery = useCallback(() => {
    const nextQuery = { ...router.query }
    delete nextQuery.storeId
    delete nextQuery.from
    router.replace({ pathname: '/orders/new', query: nextQuery }, undefined, { shallow: true })
  }, [router])

  useEffect(() => {
    if (!router.isReady) return
    const rawStoreId = Array.isArray(router.query.storeId) ? router.query.storeId[0] : router.query.storeId
    if (!rawStoreId) {
      if (appliedQuickOrderStoreId) setAppliedQuickOrderStoreId('')
      return
    }
    if (!draftStorageReady || stores.length === 0 || appliedQuickOrderStoreId === String(rawStoreId)) return

    const result = addSalesOrderDraftForStore({
      drafts,
      stores,
      queryStoreId: rawStoreId,
      products,
      buildCode: () => buildDocumentCode('DH'),
    })
    if (!result.created) {
      consumeQuickOrderQuery()
      return
    }

    setAppliedQuickOrderStoreId(String(rawStoreId))
    setDrafts(result.drafts)
    setActiveDraftId(result.activeDraftId)
    setProductQuery('')
    consumeQuickOrderQuery()
  }, [
    appliedQuickOrderStoreId,
    consumeQuickOrderQuery,
    draftStorageReady,
    drafts,
    products,
    router.isReady,
    router.query.storeId,
    stores,
  ])

  const filteredStores = useMemo(() => {
    const query = String(activeDraft?.customerQuery || '').trim().toLowerCase()
    if (!query || activeDraft?.customerStoreId) return []
    return stores
      .filter((store) => storeLabel(store).toLowerCase().includes(query) || String(store.phone || '').includes(query))
      .slice(0, 8)
  }, [stores, activeDraft?.customerQuery, activeDraft?.customerStoreId])

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase()
    if (!query) return []
    return filterInventoryProducts(products, {
      query,
      excludeProductIds: (activeDraft?.items || []).map((item) => item.productId),
    })
      .slice(0, 12)
  }, [activeDraft?.items, products, productQuery])

  const setItem = (index, patch) => {
    if (!activeDraft) return
    const nextItems = activeDraft.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    patchActiveDraft({ items: nextItems })
  }

  const selectUnit = (index, unitId) => {
    const line = activeDraft?.items?.[index]
    const product = productsById.get(line?.productId)
    const unit = product?.units?.find((item) => item.id === unitId)
    const priceType = line?.priceType || 'retail'
    let unitPrice
    if (priceType === 'retail') {
      unitPrice = unit?.unit_retail_price ?? product?.retail_price ?? unit?.default_sale_price ?? line?.unitPrice
    } else if (priceType === 'wholesale') {
      unitPrice = unit?.unit_wholesale_price ?? product?.wholesale_price ?? unit?.default_sale_price ?? line?.unitPrice
    } else {
      unitPrice = unit?.default_sale_price ?? line?.unitPrice
    }
    setItem(index, {
      productUnitId: unitId,
      conversionToBaseQty: unit?.conversion_to_base_qty || 1,
      unitPrice,
    })
  }

  const setPriceType = (index, priceType) => {
    const line = activeDraft?.items?.[index]
    if (!line) return
    const product = productsById.get(line?.productId)
    const unit = product?.units?.find((u) => u.id === line.productUnitId)
    let unitPrice
    if (priceType === 'retail') {
      unitPrice = unit?.unit_retail_price ?? product?.retail_price ?? unit?.default_sale_price ?? line?.unitPrice
    } else if (priceType === 'wholesale') {
      unitPrice = unit?.unit_wholesale_price ?? product?.wholesale_price ?? unit?.default_sale_price ?? line?.unitPrice
    } else {
      unitPrice = line?.unitPrice
    }
    setItem(index, { priceType, unitPrice })
  }

  const addProductLine = (productId = '') => {
    if (!activeDraft) return
    const product = productId ? productsById.get(productId) : null
    const nextLine = product ? createSalesOrderLine([product]) : createSalesOrderLine(products)
    const result = mergeSalesOrderLine(activeDraft.items, nextLine)
    patchActiveDraft({ items: result.items })
    if (result.merged) showSuccessMessage('Đã cộng dồn hàng trùng trong đơn.')
    setProductQuery('')
  }

  const handleProductSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return
    const firstProduct = filteredProducts[0]
    if (!firstProduct) return
    event.preventDefault()
    addProductLine(firstProduct.id)
  }

  const removeLine = (index) => {
    if (!activeDraft) return
    patchActiveDraft({ items: activeDraft.items.filter((_, itemIndex) => itemIndex !== index) })
  }

  const handleAddDraft = () => {
    const result = addSalesOrderDraft({
      drafts,
      products,
      buildCode: () => buildDocumentCode('DH'),
    })
    setDrafts(result.drafts)
    setActiveDraftId(result.activeDraftId)
    setProductQuery('')
  }

  const handleCloseDraft = (draftId) => {
    const result = closeSalesOrderDraft({ drafts, activeDraftId: activeDraft?.id, draftId })
    setDrafts(result.drafts)
    setActiveDraftId(result.activeDraftId)
  }

  const showSuccessMessage = useCallback((text) => {
    setMsgState({ type: 'success', text, show: true })
    window.setTimeout(() => {
      setMsgState((prev) => (prev?.text === text ? { ...prev, show: false } : prev))
    }, 2500)
  }, [])

  const totals = useMemo(() => {
    const items = activeDraft?.items || []
    const subtotal = items.reduce((sum, item) => sum + toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0), 0)
    const discount = toNumber(activeDraft?.discountAmount, 0)
    return {
      itemCount: items.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0),
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
    }
  }, [activeDraft])

  const stockIssues = useMemo(() => getSalesOrderStockIssues(activeDraft?.items || [], productsById), [activeDraft?.items, productsById])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current || submitting || !activeDraft) return
    if (!activeDraft.customerStoreId || (activeDraft.items || []).length === 0) return
    setError('')
    try {
      assertSalesOrderStockAvailable(activeDraft.items, productsById)
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tạo được đơn hàng.')
      return
    }
    setShowConfirmDialog(true)
  }

  const handleConfirmSubmit = async () => {
    if (submittingRef.current || submitting || !activeDraft) return
    submittingRef.current = true
    setSubmitting(true)
    setShowConfirmDialog(false)
    try {
      const requestId = activeDraft.requestId || createMutationRequestId('sales')
      if (!activeDraft.requestId) patchActiveDraft({ requestId })
      const createdOrder = await submitSalesOrderFromForm({
        code: activeDraft.code,
        customerStoreId: activeDraft.customerStoreId,
        note: activeDraft.note,
        discountAmount: activeDraft.discountAmount,
        items: activeDraft.items,
        createdBy: user?.id || null,
        requestId,
      })

      logAuditEvent({
        eventType: 'sales_order.created',
        entityType: 'sales_order',
        entityId: createdOrder?.id || null,
        metadata: {
          summary: `Tạo đơn bán ${activeDraft.code || ''}`,
          code: activeDraft.code,
          customerStoreId: activeDraft.customerStoreId,
          requestId,
          itemCount: activeDraft.items?.length,
        },
      })

      const successText = `Đã lên đơn ${activeDraft.code || ''} thành công.`.replace(/\s+/g, ' ').trim()
      showSuccessMessage(successText)

      if (drafts.length > 1) {
        const result = closeSalesOrderDraft({ drafts, activeDraftId: activeDraft.id, draftId: activeDraft.id })
        setDrafts(result.drafts)
        setActiveDraftId(result.activeDraftId)
      } else {
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(ORDER_FLASH_MESSAGE_KEY, JSON.stringify({
              type: 'success',
              text: successText,
            }))
          } catch {
            // If flash storage is blocked, the order is still created successfully.
          }
        }
        clearSavedSalesOrderDrafts()
        router.push(getSalesOrderCreateRedirect())
      }
    } catch (err) {
      setError(err?.operatorMessage || err?.message || 'Không tạo được đơn hàng.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Lên đơn - NPP Hà Công</title>
      </Head>

      <main className="min-h-full bg-black text-gray-100">
        {msgState ? <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg> : null}
        <ConfirmDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title="Xác nhận tạo đơn hàng"
          description={`Bạn sắp tạo đơn hàng với ${(activeDraft?.items || []).length} mặt hàng, tổng tiền ${formatMoney(totals.total)}.`}
          onConfirm={handleConfirmSubmit}
        />
        <form className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[1900px] flex-col px-3 py-3 sm:px-4" onSubmit={handleSubmit}>
          <div className="sticky top-0 z-40 rounded-md border border-gray-800 bg-gray-950 shadow-lg shadow-black/20">
            <div className="grid grid-cols-1 gap-2 p-2 lg:grid-cols-[420px_1fr_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <Input
                  className="h-11 border-gray-700 bg-gray-900 pl-10 text-gray-100 placeholder:text-gray-500"
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  onKeyDown={handleProductSearchKeyDown}
                  placeholder="Tìm hàng hóa"
                />
                {productQuery && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-md border border-gray-700 bg-gray-950 text-gray-100 shadow-xl">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-base hover:bg-gray-800"
                        onClick={() => addProductLine(product.id)}
                      >
                        <span className="block font-semibold">{product.name}</span>
                        <span className="block text-sm text-gray-400">
                          {product.sku || 'Chưa có mã'} · Lẻ: {formatMoney(product.retail_price || 0)} · Xỉ: {formatMoney(product.wholesale_price || 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                {drafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    className={`flex h-11 shrink-0 items-center gap-2 rounded-md border px-4 text-base font-semibold ${draft.id === activeDraft?.id ? 'border-gray-500 bg-gray-800 text-white' : 'border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800'}`}
                    onClick={() => setActiveDraftId(draft.id)}
                  >
                    <span>{draft.title}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Đóng ${draft.title}`}
                      className="rounded-full p-0.5 hover:bg-gray-700"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleCloseDraft(draft.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          handleCloseDraft(draft.id)
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </span>
                  </button>
                ))}
                <Button type="button" size="icon" variant="outline" className="h-11 w-11 shrink-0" onClick={handleAddDraft}>
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              <div className="hidden items-center justify-end gap-3 lg:flex">
                <span className="text-base font-semibold">admin</span>
              </div>
            </div>
            {recentProducts.length > 0 && !productQuery && (
              <div className="flex gap-2 overflow-x-auto border-t border-gray-900 px-3 py-2">
                <span className="shrink-0 py-2 text-sm text-gray-500">Gần đây</span>
                {recentProducts.map((product) => (
                  <button key={product.id} type="button" className="shrink-0 rounded-full border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:border-gray-600" onClick={() => addProductLine(product.id)}>
                    {product.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="border-b border-red-900 bg-red-950 px-4 py-3 text-red-100">{error}</div>
          )}
          {stockIssues.length > 0 && !error && (
            <div className="border-b border-amber-900 bg-amber-950 px-4 py-3 text-amber-100">
              {stockIssues.map((issue) => issue.message).join('; ')}. Vui lòng giảm số lượng hoặc nhập hàng trước.
            </div>
          )}

          <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="flex min-h-[520px] flex-col rounded-md border border-gray-800 bg-gray-950 lg:min-h-0">
              <div className="border-b border-gray-800 px-3 py-2">
                <div className="hidden grid-cols-[52px_44px_minmax(220px,1.5fr)_160px_120px_120px_150px_150px] gap-3 text-sm font-semibold text-gray-300 xl:grid">
                  <div>STT</div>
                  <div />
                  <div>Tên hàng</div>
                  <div>Đơn vị</div>
                  <div>Loại giá</div>
                  <div>Số lượng</div>
                  <div>Giá hàng</div>
                  <div>Thành tiền</div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-2">
                {loading ? (
                  <div className="rounded-md border border-gray-800 bg-gray-900 p-4 text-gray-400">Đang tải...</div>
                ) : products.length === 0 ? (
                  <div className="rounded-md border border-gray-800 bg-gray-900 p-4 text-gray-400">Chưa có hàng hóa.</div>
                ) : (activeDraft?.items || []).length === 0 ? (
                  <div className="rounded-md border border-gray-800 bg-gray-900 p-5 text-base text-gray-400">
                    Tìm hàng hóa ở ô phía trên rồi bấm vào kết quả để thêm vào đơn.
                  </div>
                ) : (activeDraft?.items || []).map((item, index) => {
                  const product = productsById.get(item.productId)
                  const lineTotal = toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0)
                  return (
                    <div key={`${activeDraft.id}-${item.productId}`} className="mb-2 grid grid-cols-1 gap-2 rounded-md border border-gray-800 bg-gray-900 p-3 xl:grid-cols-[52px_44px_minmax(220px,1.5fr)_160px_120px_120px_150px_150px] xl:items-center">
                      <div className="text-base font-semibold text-gray-300">{index + 1}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Xóa dòng"
                        onClick={() => removeLine(index)}
                        className="text-gray-400 hover:text-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <div className="min-w-0 rounded-md border border-gray-800 bg-gray-950 px-3 py-2">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500 xl:hidden">Tên hàng</span>
                        <p className="truncate text-base font-semibold text-gray-100">{product?.name || 'Hàng hóa'}</p>
                        <p className="truncate text-sm text-gray-400">
                          {product?.sku || 'Chưa có mã'} · Lẻ: {formatMoney(product?.retail_price || 0)} · Xỉ: {formatMoney(product?.wholesale_price || 0)}
                        </p>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500 xl:hidden">Đơn vị</span>
                        <select className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-base text-gray-100" value={item.productUnitId} onChange={(event) => selectUnit(index, event.target.value)}>
                          {(product?.units || []).map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.unit_name}</option>
                          ))}
                        </select>
                      </label>

                      <div className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500 xl:hidden">Loại giá</span>
                        <div className="flex h-11 w-full overflow-hidden rounded-md border border-gray-700">
                          <button
                            type="button"
                            className={`flex-1 text-sm font-semibold ${item.priceType === 'retail' ? 'bg-blue-700 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                            onClick={() => setPriceType(index, 'retail')}
                          >
                            Giá lẻ
                          </button>
                          <button
                            type="button"
                            className={`flex-1 text-sm font-semibold ${item.priceType === 'wholesale' ? 'bg-blue-700 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}
                            onClick={() => setPriceType(index, 'wholesale')}
                          >
                            Giá xỉ
                          </button>
                        </div>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500 xl:hidden">Số lượng</span>
                        <Input type="number" min="0" value={item.quantity} onChange={(event) => setItem(index, { quantity: event.target.value })} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500 xl:hidden">Giá hàng</span>
                        <Input type="number" min="0" value={item.unitPrice} onChange={(event) => setItem(index, { unitPrice: event.target.value })} />
                      </label>
                      <div className="h-11 rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-right text-base font-bold text-gray-100">
                        <span className="float-left text-xs font-semibold uppercase text-gray-500 xl:hidden">Thành tiền</span>
                        {formatMoney(lineTotal)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-gray-800 bg-gray-950 p-2">
                <div className="relative">
                  <Input
                    className="h-12 border-gray-700 bg-gray-900 pl-11 text-base"
                    value={activeDraft?.note || ''}
                    onChange={(event) => patchActiveDraft({ note: event.target.value })}
                    placeholder="Ghi chú đơn hàng"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">✎</span>
                </div>
              </div>
            </section>

            <aside className="flex flex-col rounded-md border border-gray-800 bg-gray-950 p-4 lg:min-h-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="rounded-md bg-gray-800 px-3 py-2 text-base font-semibold">NPP</div>
                <div className="text-right text-sm text-gray-400">
                  <p>{new Date().toLocaleDateString('vi-VN')}</p>
                  <p>{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                  <Input
                    className="h-11 border-gray-700 bg-gray-900 pl-10"
                    value={activeDraft?.customerQuery || ''}
                    onChange={(event) => patchActiveDraft({ customerQuery: event.target.value, customerStoreId: '' })}
                    placeholder="Tìm khách hàng"
                  />
                  {filteredStores.length > 0 && (
                    <div className="absolute left-0 right-0 top-12 z-40 max-h-72 overflow-y-auto rounded-md border border-gray-700 bg-gray-950 shadow-xl">
                      {filteredStores.map((store) => (
                        <button
                          key={store.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left hover:bg-gray-800"
                          onClick={() => patchActiveDraft({ customerStoreId: String(store.id), customerQuery: storeLabel(store) })}
                        >
                          <span className="block text-base font-semibold text-gray-100">{store.name}</span>
                          <span className="block text-sm text-gray-400">{[store.phone, store.ward, store.district].filter(Boolean).join(' · ') || 'Chưa có thông tin'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCustomer && (
                  <div className="rounded-md border border-gray-800 bg-gray-900 p-3 text-base text-gray-200">
                    <p className="font-semibold">{selectedCustomer.name}</p>
                    <p className="text-sm text-gray-400">{selectedCustomer.phone || 'Chưa có SĐT'}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-4 text-base">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">Tổng tiền hàng</span>
                  <span className="text-gray-100">{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">Số lượng</span>
                  <span className="text-gray-100">{formatMoney(totals.itemCount)}</span>
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">Giảm giá</span>
                  <Input
                    type="number"
                    min="0"
                    className="h-10 w-36 border-gray-700 bg-gray-900 text-right"
                    value={activeDraft?.discountAmount || ''}
                    onChange={(event) => patchActiveDraft({ discountAmount: event.target.value })}
                  />
                </label>
                <div className="border-t border-gray-800 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-gray-100">Khách cần trả</span>
                    <span className="text-2xl font-bold text-white">{formatMoney(totals.total)}</span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-8 h-12 w-full rounded-md text-lg font-bold lg:mt-auto"
                disabled={submitting || loading || products.length === 0 || !activeDraft?.customerStoreId || (activeDraft?.items || []).length === 0}
              >
                {submitting ? 'ĐANG LÊN ĐƠN...' : 'LÊN ĐƠN'}
              </Button>
            </aside>
          </div>
        </form>
      </main>
    </>
  )
}
