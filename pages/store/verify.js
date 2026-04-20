import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatAddressParts } from '@/lib/utils'
import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'
import { getOrRefreshStores, updateStoresInCache } from '@/lib/storeCache'
import { formatDateTime } from '@/helper/validation'
import { buildStoreDiff, logStoreEditHistoryBatch } from '@/lib/storeEditHistory'

export default function VerifyStorePage() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}

  const [pageReady, setPageReady] = useState(false)
  const [stores, setStores] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pendingReportCount, setPendingReportCount] = useState(0)
  const [confirmVerify, setConfirmVerify] = useState({ open: false, ids: [] })
  const selectAllRef = useRef(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace('/login?from=/store/verify').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to login failed:', err)
      })
      return
    }
    if (!isAdmin) {
      setPageReady(false)
      void router.replace('/account').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to account failed:', err)
      })
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadUnverifiedStores = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const allStores = await getOrRefreshStores()
      const pendingStores = (allStores || []).filter((store) => store.active !== true)
      setStores(pendingStores)
      setSelectedIds(new Set())
    } catch {
      setStores([])
      setError('Không tải được danh sách chờ xác thực. Vui lòng thử lại.')
    }
    setLoading(false)
  }, [])

  const loadPendingReportCount = useCallback(async () => {
    try {
      const { count, error: countError } = await supabase
        .from('store_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (countError) throw countError
      setPendingReportCount(typeof count === 'number' ? count : 0)
    } catch {
      setPendingReportCount(0)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadUnverifiedStores()
    loadPendingReportCount()
  }, [pageReady, loadUnverifiedStores, loadPendingReportCount])

  const districtOptions = useMemo(() => {
    return Array.from(
      new Set(
        stores
          .map((store) => (store.district || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [stores])

  const filteredStores = useMemo(() => {
    const rawTerm = searchTerm.trim().toLowerCase()
    const term = removeVietnameseTones(rawTerm)
    const phoneticTerm = normalizeVietnamesePhonetics(rawTerm)
    return stores.filter((store) => {
      if (districtFilter && (store.district || '').trim() !== districtFilter) return false
      if (!term && !phoneticTerm) return true

      const name = (store.name || '').toLowerCase()
      const addressRaw = formatAddressParts(store).toLowerCase()

      const normName = removeVietnameseTones(name)
      const phoneticName = normalizeVietnamesePhonetics(name)
      const normAddress = removeVietnameseTones(addressRaw)
      const phoneticAddress = normalizeVietnamesePhonetics(addressRaw)
      const phone = String(store.phone || '').toLowerCase()
      return (
        name.includes(rawTerm) || normName.includes(term) || phoneticName.includes(phoneticTerm) ||
        addressRaw.includes(rawTerm) || normAddress.includes(term) || phoneticAddress.includes(phoneticTerm) ||
        phone.includes(rawTerm)
      )
    })
  }, [stores, districtFilter, searchTerm])

  const visibleIds = useMemo(() => filteredStores.map((store) => store.id), [filteredStores])
  const hasVisibleStores = visibleIds.length > 0
  const allVisibleSelected = hasVisibleStores && visibleIds.every((id) => selectedIds.has(id))
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length

  useEffect(() => {
    if (!selectAllRef.current) return
    const partiallySelected = selectedVisibleCount > 0 && !allVisibleSelected
    selectAllRef.current.indeterminate = partiallySelected
  }, [selectedVisibleCount, allVisibleSelected])

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const openVerifyConfirm = (ids) => {
    if (!ids || ids.length === 0) return
    setConfirmVerify({ open: true, ids })
  }

  const closeVerifyConfirm = () => {
    setConfirmVerify({ open: false, ids: [] })
  }

  const verifyStores = async (ids) => {
    if (!ids || ids.length === 0) return
    setSubmitting(true)
    setError('')
    setMessage('')
    const updatedAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('stores')
      .update({ active: true, updated_at: updatedAt })
      .in('id', ids)

    if (updateError) {
      setError('Xác thực thất bại. Vui lòng thử lại.')
      setSubmitting(false)
      return
    }

    const idSet = new Set(ids)
    setStores((prev) => prev.filter((store) => !idSet.has(store.id)))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    await updateStoresInCache(ids.map((storeId) => ({ id: storeId, active: true, updated_at: updatedAt })))

    try {
      const beforeById = new Map(stores.map((s) => [String(s?.id), s]))
      const rows = ids.map((storeId) => {
        const before = beforeById.get(String(storeId)) || {}
        const changes = buildStoreDiff(before, { active: true })
        return {
          store_id: storeId,
          action_type: 'verify',
          actor_user_id: user?.id,
          actor_role: 'admin',
          changes,
        }
      })
      await logStoreEditHistoryBatch(rows)
    } catch (err) {
      console.error('store_edit_history verify batch failed:', err)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storevis:stores-changed', {
          detail: { type: 'verify-many', ids },
        })
      )
    }
    setMessage(`Đã xác thực ${ids.length} cửa hàng.`)
    setSubmitting(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-6">
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    )
  }

  if (!pageReady) {
    return null
  }

  return (
    <>
      <Head>
        <title>Xác thực cửa hàng - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-100">Màn xác thực cửa hàng</h1>
                  <p className="text-sm text-gray-400">
                    Chọn 1 hoặc nhiều cửa hàng để xác thực nhanh
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadUnverifiedStores} disabled={loading || submitting}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-amber-950/30 border border-amber-900 p-3">
                  <p className="text-sm uppercase tracking-wide text-amber-300">Chờ xác thực</p>
                  <p className="text-2xl font-bold text-amber-200">{stores.length}</p>
                </div>
                <div className="rounded-xl bg-blue-950/30 border border-blue-900 p-3">
                  <p className="text-sm uppercase tracking-wide text-blue-300">Đang chọn</p>
                  <p className="text-2xl font-bold text-blue-200">{selectedIds.size}</p>
                </div>
                <div className="rounded-xl bg-green-950/30 border border-green-900 p-3 col-span-2 sm:col-span-1">
                  <p className="text-sm uppercase tracking-wide text-green-300">Hiển thị sau lọc</p>
                  <p className="text-2xl font-bold text-green-200">{filteredStores.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên, địa chỉ, số điện thoại..."
                />
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="h-10 rounded-md border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100"
                  aria-label="Lọc theo huyện"
                >
                  <option value="">Tất cả huyện</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={!hasVisibleStores || submitting}
                    className="h-5 w-5 rounded border-gray-700"
                  />
                  Chọn tất cả đang hiển thị
                </label>
                <Button
                  type="button"
                  onClick={() => openVerifyConfirm(Array.from(selectedIds))}
                  disabled={selectedIds.size === 0 || submitting}
                >
                  {submitting ? 'Đang xác thực...' : `Xác thực đã chọn (${selectedIds.size})`}
                </Button>
              </div>

              {message && (
                <div className="rounded-lg border border-green-900 bg-green-950/30 p-3">
                  <p className="text-sm text-green-300">{message}</p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 p-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {loading && (
              <Card className="rounded-xl border border-gray-800">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-400">Đang tải danh sách cửa hàng...</p>
                </CardContent>
              </Card>
            )}

            {!loading && filteredStores.length === 0 && (
              <Card className="rounded-xl border border-gray-800">
                <CardContent className="p-5 text-center space-y-2">
                  {stores.length === 0 ? (
                    <>
                      <p className="text-base font-semibold text-gray-100">Không còn cửa hàng cần xác thực</p>
                      <p className="text-sm text-gray-400">
                        Sau khi xác thực, cửa hàng sẽ tự động biến mất khỏi màn này.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-gray-100">Không có kết quả phù hợp bộ lọc</p>
                      <p className="text-sm text-gray-400">Hãy đổi từ khóa tìm kiếm hoặc bộ lọc huyện.</p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {!loading && filteredStores.map((store) => {
              const addressText = formatAddressParts(store) || 'Chưa có địa chỉ'
              return (
                <Card key={store.id} className="rounded-xl border border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(store.id)}
                        onChange={() => toggleOne(store.id)}
                        disabled={submitting}
                        aria-label={`Chọn cửa hàng ${store.name || 'không tên'}`}
                        className="mt-1 h-5 w-5 rounded border-gray-700"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <h3 className="min-w-0 flex-1 text-lg font-semibold text-gray-100 leading-snug break-words [overflow-wrap:anywhere]">
                            {store.name || 'Cửa hàng chưa đặt tên'}
                          </h3>
                          <span className="inline-flex shrink-0 whitespace-nowrap items-center rounded-full px-2.5 py-1 text-sm font-medium bg-amber-900/40 text-amber-300">
                            Chờ xác thực
                          </span>
                        </div>

                        <p className="text-base text-gray-300 mt-1 break-words [overflow-wrap:anywhere]">{addressText}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                          <span>Huyện: {(store.district || '').trim() || 'Chưa cập nhật'}</span>
                          <span>Thêm lúc: {formatDateTime(store.created_at)}</span>
                          {store.phone && <span>SĐT: {store.phone}</span>}
                        </div>

                        <div className="mt-3">
                          <Button
                            type="button"
                            onClick={() => openVerifyConfirm([store.id])}
                            disabled={submitting}
                          >
                            Xác thực cửa hàng này
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      <Dialog open={confirmVerify.open} onOpenChange={(open) => setConfirmVerify((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden">
          <div className="p-4 space-y-3">
            <DialogTitle className="text-base font-semibold text-gray-100">Xác nhận xác thực</DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              Bạn chắc chắn muốn xác thực {confirmVerify.ids.length} cửa hàng?
            </DialogDescription>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeVerifyConfirm}>
                Hủy
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  const ids = confirmVerify.ids
                  closeVerifyConfirm()
                  verifyStores(ids)
                }}
              >
                Xác thực
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
