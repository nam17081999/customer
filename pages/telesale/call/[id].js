import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabaseClient'
import { getCachedStores, updateStoreInCache } from '@/lib/storeCache'
import { formatAddressParts } from '@/lib/utils'
import { TELESALE_CALL_RESULT_OPTIONS, formatLastCalledText, getTelesaleResultLabel } from '@/helper/telesale'

function buildTelHref(phone) {
  return `tel:${String(phone || '').replace(/[^0-9+]/g, '')}`
}

function startPhoneCall(phone) {
  if (!phone || typeof document === 'undefined') return
  const anchor = document.createElement('a')
  anchor.href = buildTelHref(phone)
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export default function TelesaleCallResultPage() {
  const router = useRouter()
  const { id, from } = router.query
  const { isAdmin, isTelesale, isAuthenticated, loading: authLoading } = useAuth() || {}

  const [pageReady, setPageReady] = useState(false)
  const [loadingStore, setLoadingStore] = useState(true)
  const [store, setStore] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isPotential, setIsPotential] = useState(false)
  const [callResult, setCallResult] = useState('')
  const [salesNote, setSalesNote] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      router.replace(`/login?from=${encodeURIComponent(router.asPath || '/')}`)
      return
    }
    if (!isAdmin && !isTelesale) {
      setPageReady(false)
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, isTelesale, router])

  const backHref = useMemo(() => {
    if (Array.isArray(from)) return from[0] || '/'
    return from || '/'
  }, [from])

  const loadStore = useCallback(async () => {
    if (!id) return
    setLoadingStore(true)
    setError('')
    try {
      const cached = await getCachedStores()
      const stores = Array.isArray(cached?.data) ? cached.data : []
      const found = (stores || []).find((item) => String(item.id) === String(id))
      if (!found) {
        setStore(null)
        setError('Không tìm thấy cửa hàng để cập nhật kết quả gọi.')
        return
      }
      setStore(found)
      setIsPotential(Boolean(found.is_potential))
      setCallResult(found.last_call_result || '')
      setSalesNote(found.sales_note || '')
    } catch (err) {
      console.error(err)
      setStore(null)
      setError('Không tải được dữ liệu cửa hàng. Vui lòng thử lại.')
    } finally {
      setLoadingStore(false)
    }
  }, [id])

  useEffect(() => {
    if (!pageReady || !id) return
    loadStore()
  }, [pageReady, id, loadStore])

  const handleBack = useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  const saveTelesaleUpdate = async () => {
    if (!store) return
    if (!callResult) {
      setError('Vui lòng chọn kết quả gọi')
      return
    }

    setSaving(true)
    setError('')
    const nowIso = new Date().toISOString()
    const updates = {
      is_potential: isPotential,
      last_called_at: nowIso,
      last_call_result: callResult,
      last_call_result_at: nowIso,
      sales_note: salesNote.trim() || null,
      last_order_reported_at: callResult === 'da_len_don' ? nowIso : null,
      updated_at: nowIso,
    }

    const { error: updateError } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', store.id)

    if (updateError) {
      console.error(updateError)
      setError('Không lưu được thông tin telesale. Vui lòng thử lại.')
      setSaving(false)
      return
    }

    const nextStore = { ...store, ...updates }
    await updateStoreInCache(store.id, updates)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storevis:stores-changed', {
          detail: { type: 'update', id: store.id, store: nextStore },
        }),
      )
    }

    setStore(nextStore)
    setSaving(false)
    router.push(backHref)
  }

  if (authLoading || !pageReady || loadingStore) {
    return <FullPageLoading visible message="Đang chuẩn bị màn kết quả gọi..." />
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-black px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-screen-md space-y-4">
          <Card className="rounded-2xl border border-gray-800 bg-gray-950">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <p className="text-sm text-red-300">{error || 'Không tìm thấy cửa hàng.'}</p>
              <Button type="button" variant="outline" onClick={handleBack}>
                Quay lại
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const addressText = formatAddressParts(store)

  return (
    <>
      <Head>
        <title>Kết quả gọi lên đơn - StoreVis</title>
      </Head>

      <div className="min-h-screen bg-black px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-screen-md space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={handleBack}>
              Quay lại
            </Button>
            {store.phone && (
              <Button type="button" variant="outline" onClick={() => startPhoneCall(store.phone)}>
                Gọi lại
              </Button>
            )}
          </div>

          <Card className="rounded-2xl border border-gray-800 bg-gray-950">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="space-y-1">
                <p className="text-sm text-gray-400">Kết quả gọi lên đơn</p>
                <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">{store.name}</h1>
                {addressText && <p className="text-sm text-gray-400">{addressText}</p>}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                <span className="rounded-full bg-gray-800 px-2.5 py-1">Lần gọi gần nhất: {formatLastCalledText(store.last_called_at)}</span>
                <span className="rounded-full bg-gray-800 px-2.5 py-1">Kết quả cũ: {getTelesaleResultLabel(store.last_call_result)}</span>
                {store.last_call_result_at && (
                  <span className="rounded-full bg-gray-800 px-2.5 py-1">
                    Cập nhật kết quả: {formatLastCalledText(store.last_call_result_at)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-100">Đánh dấu tiềm năng</p>
                  <p className="text-xs text-gray-400">Ưu tiên cửa hàng này cho telesale</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPotential((prev) => !prev)}
                  className={`inline-flex h-9 min-w-24 items-center justify-center rounded-full border px-3 text-sm transition ${
                    isPotential
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                      : 'border-gray-700 bg-gray-900 text-gray-300'
                  }`}
                >
                  {isPotential ? 'Tiềm năng' : 'Thường'}
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-200">Kết quả gọi</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TELESALE_CALL_RESULT_OPTIONS.map((option) => {
                    const selected = callResult === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCallResult(option.value)}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-sm transition ${
                          selected
                            ? 'border-sky-500 bg-sky-500/10 text-sky-100'
                            : 'border-gray-700 bg-gray-900 text-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`sales-note-${store.id}`} className="text-sm font-medium text-gray-200">Ghi chú telesale</Label>
                <textarea
                  id={`sales-note-${store.id}`}
                  value={salesNote}
                  onChange={(event) => setSalesNote(event.target.value)}
                  placeholder="Ví dụ: hẹn gọi lại chiều mai"
                  className="min-h-32 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-base text-gray-100 outline-none placeholder:text-gray-500"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button type="button" variant="outline" onClick={handleBack}>
                  Hủy
                </Button>
                <Button type="button" onClick={saveTelesaleUpdate} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu cuộc gọi'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
