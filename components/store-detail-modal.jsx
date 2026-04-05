import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { formatAddressParts, toTitleCaseVI } from '@/lib/utils'
import { DISTRICT_SUGGESTIONS, DISTRICT_WARD_SUGGESTIONS, REPORT_REASON_OPTIONS, STORE_TYPE_OPTIONS, DEFAULT_STORE_TYPE } from '@/lib/constants'
import { formatDistance } from '@/helper/validation'
import { hasStoreCoordinates, hasStoreSupplementOpportunity } from '@/helper/storeSupplement'
import { getBestPosition, getGeoErrorMessage } from '@/helper/geolocation'
import { useAuth } from '@/lib/AuthContext'
import { formatLastCalledText, getTelesaleResultLabel, hasReportedOrder } from '@/helper/telesale'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { supabase } from '@/lib/supabaseClient'
import { removeStoreFromCache, updateStoreInCache } from '@/lib/storeCache'

const StoreLocationPicker = dynamic(
  () => import('@/components/map/store-location-picker'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-gray-900 rounded-md" style={{ height: '45vh' }}>
        <span className="text-sm text-gray-400 animate-pulse">Đang tải bản đồ…</span>
      </div>
    ),
  }
)

export default function StoreDetailModal({ store, trigger, open, onOpenChange }) {
  const router = useRouter()
  const { user, isAdmin, isTelesale } = useAuth() || {}
  const [internalOpen, setInternalOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportMode, setReportMode] = useState('')
  const [reportReasons, setReportReasons] = useState([])
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSuccess, setReportSuccess] = useState('')
  const [detailNotice, setDetailNotice] = useState('')
  const [isPotential, setIsPotential] = useState(false)
  const [potentialSaving, setPotentialSaving] = useState(false)
  const detailNoticeTimerRef = useRef(null)
  const [reportName, setReportName] = useState('')
  const [reportStoreType, setReportStoreType] = useState(DEFAULT_STORE_TYPE)
  const [reportAddressDetail, setReportAddressDetail] = useState('')
  const [reportWard, setReportWard] = useState('')
  const [reportDistrict, setReportDistrict] = useState('')
  const [reportPhone, setReportPhone] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [reportLat, setReportLat] = useState(null)
  const [reportLng, setReportLng] = useState(null)
  const [reportMapEditable, setReportMapEditable] = useState(false)
  const [reportResolving, setReportResolving] = useState(false)
  const suppressNextOpenRef = useRef(false)

  const isControlled = open !== undefined
  const resolvedOpen = isControlled ? open : internalOpen
  const resolvedOnOpenChange = isControlled ? onOpenChange : setInternalOpen
  const handleDetailOpenChange = (nextOpen) => {
    // Keep detail modal open while delete confirmation is active.
    if (!nextOpen && confirmDeleteOpen) return
    resolvedOnOpenChange?.(nextOpen)
  }

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger, {
      onPointerDownCapture: (event) => {
        if (event.target?.closest?.('[data-detail-modal-ignore="true"]')) {
          suppressNextOpenRef.current = true
        }
      },
      onClickCapture: (event) => {
        if (event.target?.closest?.('[data-detail-modal-ignore="true"]')) {
          suppressNextOpenRef.current = true
        }
      },
      onClick: (event) => {
        trigger.props?.onClick?.(event)
        if (event.defaultPrevented) return
        if (suppressNextOpenRef.current) {
          suppressNextOpenRef.current = false
          return
        }
        if (event.target?.closest?.('[data-detail-modal-ignore="true"]')) return
        resolvedOnOpenChange?.(true)
      },
    })
    : trigger


  useEffect(() => {
    if (!store) return
    if (!resolvedOpen) {
      setReportOpen(false)
      setReportMode('')
      setReportReasons([])
      setReportSubmitting(false)
      setReportError('')
      setReportSuccess('')
      setReportMapEditable(false)
      setDetailNotice('')
      if (detailNoticeTimerRef.current) {
        clearTimeout(detailNoticeTimerRef.current)
        detailNoticeTimerRef.current = null
      }
    }
    if (resolvedOpen) {
      setIsPotential(Boolean(store.is_potential))
      setReportName(store.name || '')
      setReportStoreType(store.store_type || DEFAULT_STORE_TYPE)
      setReportAddressDetail(store.address_detail || '')
      setReportWard(store.ward || '')
      setReportDistrict(store.district || '')
      setReportPhone(store.phone || '')
      setReportNote(store.note || '')
      setReportLat(typeof store.latitude === 'number' ? store.latitude : null)
      setReportLng(typeof store.longitude === 'number' ? store.longitude : null)
    }
  }, [resolvedOpen, store?.id])

  const canPrefetchMap = Boolean(
    resolvedOpen &&
    typeof store?.latitude === 'number' &&
    typeof store?.longitude === 'number'
  )

  useEffect(() => {
    if (!canPrefetchMap) return
    router.prefetch('/map')
  }, [canPrefetchMap, router])

  if (!store) return trigger || null

  const hasCoords = hasStoreCoordinates(store)
  const canSupplement = hasStoreSupplementOpportunity(store)
  const isActive = Boolean(store.active)
  const addressText = formatAddressParts(store)
  const storeTypeMeta = getStoreTypeMeta(store.store_type)
  const storeTypeLabel = storeTypeMeta.label
  const canTrackTelesale = isAdmin || isTelesale

  const showDetailNotice = (message) => {
    setDetailNotice(message)
    if (detailNoticeTimerRef.current) clearTimeout(detailNoticeTimerRef.current)
    detailNoticeTimerRef.current = setTimeout(() => {
      setDetailNotice('')
      detailNoticeTimerRef.current = null
    }, 3000)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('stores')
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq('id', store.id)
    if (!error) {
      await removeStoreFromCache(store.id)

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('storevis:flash-message', JSON.stringify({
          type: 'success',
          text: 'Đã xóa cửa hàng!',
          createdAt: Date.now(),
        }))
        window.dispatchEvent(new CustomEvent('storevis:flash-message'))
        window.dispatchEvent(
          new CustomEvent('storevis:stores-changed', {
            detail: { type: 'delete', id: store.id },
          })
        )
      }
      if (onOpenChange) onOpenChange(false)
      else setInternalOpen(false)
      setConfirmDeleteOpen(false)
      await router.push('/')
    }
    setDeleting(false)
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    router.push(`/store/edit/${store.id}`)
  }

  const handleSupplement = (e) => {
    e.stopPropagation()
    router.push(`/store/edit/${store.id}?mode=supplement`)
  }

  const handleTogglePotential = async () => {
    if (!canTrackTelesale || !store?.id || potentialSaving) return

    const nextPotential = !isPotential
    const nowIso = new Date().toISOString()
    setPotentialSaving(true)

    const { error } = await supabase
      .from('stores')
      .update({ is_potential: nextPotential, updated_at: nowIso })
      .eq('id', store.id)

    if (error) {
      console.error(error)
      showDetailNotice('Không cập nhật được trạng thái tiềm năng.')
      setPotentialSaving(false)
      return
    }

    setIsPotential(nextPotential)
    const nextStore = { ...store, is_potential: nextPotential, updated_at: nowIso }
    await updateStoreInCache(store.id, { is_potential: nextPotential, updated_at: nowIso })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storevis:stores-changed', {
          detail: { type: 'update', id: store.id, store: nextStore },
        })
      )
    }
    showDetailNotice(nextPotential ? 'Đã chuyển cửa hàng sang tiềm năng.' : 'Đã chuyển cửa hàng về trạng thái thường.')
    setPotentialSaving(false)
  }

  const wardSuggestions = reportDistrict
    ? (DISTRICT_WARD_SUGGESTIONS[reportDistrict] || [])
    : []

  const toggleReason = (code) => {
    setReportReasons((prev) => {
      if (prev.includes(code)) return prev.filter((item) => item !== code)
      return [...prev, code]
    })
  }

  const normalizeCoord = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return null
    return Number(value.toFixed(7))
  }

  const buildProposedChanges = () => {
    const proposed = {}
    const normalizedName = toTitleCaseVI(reportName.trim())
    const normalizedStoreType = reportStoreType || DEFAULT_STORE_TYPE
    const normalizedDetail = reportAddressDetail.trim() ? toTitleCaseVI(reportAddressDetail.trim()) : null
    const normalizedWard = reportWard.trim() ? toTitleCaseVI(reportWard.trim()) : null
    const normalizedDistrict = reportDistrict.trim() ? toTitleCaseVI(reportDistrict.trim()) : null
    const normalizedPhone = reportPhone.trim() || null
    const normalizedNote = reportNote.trim() || null

    if (normalizedName && normalizedName !== (store.name || '')) proposed.name = normalizedName
    if ((store.store_type || DEFAULT_STORE_TYPE) !== normalizedStoreType) proposed.store_type = normalizedStoreType
    if ((store.address_detail || null) !== normalizedDetail) proposed.address_detail = normalizedDetail
    if ((store.ward || null) !== normalizedWard) proposed.ward = normalizedWard
    if ((store.district || null) !== normalizedDistrict) proposed.district = normalizedDistrict
    if ((store.phone || null) !== normalizedPhone) proposed.phone = normalizedPhone
    if ((store.note || null) !== normalizedNote) proposed.note = normalizedNote

    const currentLat = normalizeCoord(store.latitude)
    const currentLng = normalizeCoord(store.longitude)
    const nextLat = normalizeCoord(reportLat)
    const nextLng = normalizeCoord(reportLng)
    if (currentLat !== nextLat) proposed.latitude = nextLat
    if (currentLng !== nextLng) proposed.longitude = nextLng

    return proposed
  }

  const handleReportGetLocation = async () => {
    try {
      setReportResolving(true)
      const { coords, error } = await getBestPosition({
        maxWaitTime: 2000,
        desiredAccuracy: 15,
        skipCache: true,
      })
      if (!coords) {
        setReportError(getGeoErrorMessage(error))
        return
      }
      setReportLat(coords.latitude)
      setReportLng(coords.longitude)
      setReportError('')
      setReportSuccess('Đã cập nhật vị trí GPS mới')
    } catch (err) {
      console.error('Get location error:', err)
      setReportError(getGeoErrorMessage(err))
    } finally {
      setReportResolving(false)
    }
  }

  const handleSubmitReport = async () => {
    if (reportSubmitting) return
    setReportError('')
    setReportSuccess('')

    if (!reportMode) {
      setReportError('Vui lòng chọn loại báo cáo')
      return
    }

    if (reportMode === 'reason') {
      if (reportReasons.length === 0) {
        setReportError('Vui lòng chọn ít nhất một lý do')
        return
      }
    }

    let proposedChanges = null
    if (reportMode === 'edit') {
      if (!reportName.trim()) {
        setReportError('Tên cửa hàng không được để trống')
        return
      }
      if (!reportDistrict.trim() || !reportWard.trim()) {
        setReportError('Vui lòng nhập đủ quận/huyện và xã/phường')
        return
      }
      proposedChanges = buildProposedChanges()
      if (Object.keys(proposedChanges).length === 0) {
        setReportError('Bạn chưa thay đổi thông tin nào')
        return
      }
    }

    setReportSubmitting(true)
    const payload = {
      store_id: store.id,
      report_type: reportMode === 'edit' ? 'edit' : 'reason_only',
      reason_codes: reportMode === 'reason' ? reportReasons : null,
      proposed_changes: reportMode === 'edit' ? proposedChanges : null,
      reporter_id: user?.id || null,
    }

    const { error } = await supabase.from('store_reports').insert([payload])
    if (error) {
      console.error(error)
      setReportError('Khôgn gửi được báo cáo, vui lòng thử lại')
    } else {
      setReportOpen(false)
      setReportReasons([])
      setReportMode('')
      setDetailNotice('Đã gửi báo cáo. Admin sẽ xem xét và cập nhật.')
      if (detailNoticeTimerRef.current) clearTimeout(detailNoticeTimerRef.current)
      detailNoticeTimerRef.current = setTimeout(() => {
        setDetailNotice('')
        detailNoticeTimerRef.current = null
      }, 3000)
    }
    setReportSubmitting(false)
  }

  const detailContent = (
    <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden max-h-[90vh] z-300">
      <div className="flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur pt-5 pb-4 px-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-300">
                {storeTypeMeta.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-400">{storeTypeLabel}</p>
                <OverflowMarquee
                  text={store.name}
                  textClassName="mt-0.5 text-xl font-bold text-gray-100 leading-tight"
                />
              </div>
            </div>
            <DialogClose className="absolute right-2.5 top-2.5 cursor-pointer h-8 w-8 shrink-0 rounded-full border border-gray-700 bg-gray-900/80 text-gray-300 transition hover:bg-gray-800 hover:text-white">
              <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </DialogClose>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-200 border border-green-500/40">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Xác thực
              </span>
            )}
            {typeof store.distance === 'number' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {formatDistance(store.distance)}
              </span>
            ) : !hasCoords ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-200">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></svg>
                Chưa có vị trí
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Name + distance */}
          <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Thông tin cửa hàng</p>

            {/* Address */}
            {addressText && (
              <div className="mt-2 flex items-start gap-2.5 text-base text-gray-400">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="break-words leading-relaxed">{addressText}</span>
              </div>
            )}

            {/* Phone */}
            {store.phone && (
              <div className="mt-2 flex items-center gap-2.5 text-base text-gray-400">
                <svg className="w-5 h-5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="break-all text-left">{store.phone}</span>
              </div>
            )}

            {/* Note */}
            {store.note && (
              <div className="mt-2 flex items-start gap-2.5 text-base text-gray-400">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="break-words leading-relaxed">{store.note}</span>
              </div>
            )}
          </div>

          {canTrackTelesale && store.phone && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-200">Telesale</p>
                  <p className="text-xs text-gray-400">Cửa hàng tiềm năng</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPotential}
                  disabled={potentialSaving}
                  onClick={handleTogglePotential}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
                    isPotential
                      ? 'border-emerald-500 bg-emerald-500/25'
                      : 'border-gray-700 bg-gray-900'
                  } ${potentialSaving ? 'opacity-70' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                      isPotential ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${isPotential ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}>
                  {isPotential ? 'Tiềm năng' : 'Thông thường'}
                </span>
                {isPotential && (
                  <>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                      Thời gian gọi cuối: {formatLastCalledText(store.last_called_at)}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                      Kết quả: {getTelesaleResultLabel(store.last_call_result)}
                    </span>
                    {hasReportedOrder(store) && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-sky-500/20 text-sky-200 border border-sky-500/40">
                        Đã lên đơn
                      </span>
                    )}
                  </>
                )}
              </div>

              {isPotential && store.sales_note ? (
                <p className="text-sm text-gray-400 break-words">{store.sales_note}</p>
              ) : null}
            </div>
          )}

          {detailNotice && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {detailNotice}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            {canSupplement && (
              <Button variant="outline" className="w-full" onClick={handleSupplement}>
                Bổ sung
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" className="w-full" onClick={handleEdit}>
                Chỉnh sửa
              </Button>
            )}
            {hasCoords && (
              <Button
                variant="outline"
                className="w-full"
                leftIcon={
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                }
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/map?storeId=${store.id}&lat=${store.latitude}&lng=${store.longitude}`)
                }}
              >
                Bản đồ
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              leftIcon={
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h10a2 2 0 012 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h8M7 12h5" />
                </svg>
              }
              onClick={(e) => {
                e.stopPropagation()
                const from = router.asPath || '/'
                router.push(`/store/report/${store.id}?from=${encodeURIComponent(from)}`)
              }}
            >
              Báo cáo
            </Button>
            {isAdmin && (
              <Button
                variant="destructive"
                className="w-full"
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                {deleting ? 'Đang xóa...' : 'Xóa cửa hàng'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DialogContent>
  )

  const reportContent = (
    <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden max-h-[90vh]">
      <div className="flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            }
            onClick={() => {
              setReportOpen(false)
              setReportMode('')
              setReportError('')
              setReportSuccess('')
            }}
          />
          <div className="min-w-0">
            <p className="text-sm text-gray-400">Báo cáo cửa hàng</p>
            <OverflowMarquee
              text={store.name}
              textClassName="text-base font-semibold text-gray-100"
            />
          </div>
          <DialogClose className="ml-auto w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </DialogClose>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300">
            Báo cáo cửa hàng sẽ được admin duyệt khi cập nhật.
          </div>

          {!reportMode && (
            <div className="space-y-2">
              <Button type="button" className="w-full" onClick={() => setReportMode('edit')}>
                Sửa thông tin
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setReportMode('reason')}>
                Chọn báo cáo
              </Button>
            </div>
          )}

          {reportMode === 'reason' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm text-gray-300">Chọn lý do (có thể chọn nhiều)</Label>
                <div className="space-y-2">
                  {REPORT_REASON_OPTIONS.map((opt) => {
                    const active = reportReasons.includes(opt.code)
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between ${
                          active
                            ? 'bg-blue-600/20 text-blue-200 border-blue-500'
                            : 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800'
                        }`}
                        onClick={() => toggleReason(opt.code)}
                        aria-pressed={active}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                            active ? 'border-blue-400 bg-blue-500 text-white' : 'border-gray-600 text-gray-400'
                          }`}>
                            {active ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </span>
                          <span>{opt.label}</span>
                        </span>
                        {active && <span className="text-sm text-blue-300">Đã chọn</span>}
                      </button>
                    )
                  })}
                </div>
                <div className="text-sm text-gray-400">
                  Đã chọn {reportReasons.length} lý do
                </div>
              </div>
            </>
          )}

          {reportMode === 'edit' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="report-store-type" className="text-sm text-gray-300">Loại cửa hàng</Label>
                <select
                  id="report-store-type"
                  value={reportStoreType}
                  onChange={(e) => setReportStoreType(e.target.value || DEFAULT_STORE_TYPE)}
                  className="w-full h-11 rounded-xl border border-gray-700 bg-gray-900 text-sm px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STORE_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <Label htmlFor="report-name" className="text-sm text-gray-300">Tên cửa hàng</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="VD: Tạp hóa Minh Anh"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-gray-300">Huyện / Quận</Label>
                <select
                  value={reportDistrict}
                  onChange={(e) => { setReportDistrict(e.target.value); setReportWard('') }}
                  className="w-full h-11 rounded-xl border border-gray-700 bg-gray-900 text-sm px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Chọn huyện / quận</option>
                  {DISTRICT_SUGGESTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm text-gray-300">Xã / Phường / Thị trấn</Label>
                {wardSuggestions.length > 0 ? (
                  <select
                    value={reportWard}
                    onChange={(e) => setReportWard(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-700 bg-gray-900 text-sm px-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Chọn xã / phường</option>
                    {wardSuggestions.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={reportWard}
                    onChange={(e) => setReportWard(e.target.value)}
                    placeholder="VD: Minh Khai"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-address" className="text-sm text-gray-300">Địa chỉ chi tiết</Label>
                <Input
                  id="report-address"
                  value={reportAddressDetail}
                  onChange={(e) => setReportAddressDetail(e.target.value)}
                  placeholder="Số nhà, đường, thôn/xóm/đội..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-phone" className="text-sm text-gray-300">Số điện thoại</Label>
                <Input
                  id="report-phone"
                  type="tel"
                  value={reportPhone}
                  onChange={(e) => setReportPhone(e.target.value)}
                  placeholder="0901 234 567"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-note" className="text-sm text-gray-300">Ghi chú</Label>
                <Input
                  id="report-note"
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="VD: Mở cửa từ 6:00 - 22:00"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-300">Vị trí trên bản đồ</Label>
                {reportLat != null && reportLng != null && (
                  <p className="text-sm text-gray-400">
                    Tọa độ: {reportLat.toFixed(6)}, {reportLng.toFixed(6)}
                  </p>
                )}
                <div className="flex gap-2 sm:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={reportResolving}
                    onClick={handleReportGetLocation}
                  >
                    {reportResolving ? 'Đang lấy...' : 'Lấy lại vị trí'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setReportMapEditable((v) => !v)}
                  >
                    {reportMapEditable ? 'Khóa bản đồ' : 'Mở khóa'}
                  </Button>
                </div>
                <div className="rounded-2xl overflow-hidden border border-gray-800" style={{ height: '45vh' }}>
                  <StoreLocationPicker
                    initialLat={reportLat}
                    initialLng={reportLng}
                    editable={reportMapEditable}
                    onToggleEditable={() => setReportMapEditable((v) => !v)}
                    onChange={(lat, lng) => { setReportLat(lat); setReportLng(lng) }}
                    onGetLocation={handleReportGetLocation}
                    resolvingAddr={reportResolving}
                    dark={false}
                  />
                </div>
              </div>
            </>
          )}

          {(reportError || reportSuccess) && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${reportError ? 'border-red-900 text-red-300 bg-red-950/20' : 'border-green-900 text-green-300 bg-green-950/20'}`}>
              {reportError || reportSuccess}
            </div>
          )}

          {reportMode && (
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setReportMode('')
                  setReportError('')
                  setReportSuccess('')
                }}
              >
                Quay lại
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={reportSubmitting}
                onClick={handleSubmitReport}
              >
                {reportSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  )

  const content = reportOpen ? reportContent : detailContent

  return (
    <>
      <Dialog open={resolvedOpen} onOpenChange={handleDetailOpenChange}>
        {triggerNode || null}
        {content}
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Xác nhận xóa cửa hàng"
        description="Cửa hàng sẽ bị ẩn khỏi hệ thống theo cơ chế xóa mềm. Bạn có chắc muốn tiếp tục?"
        confirmLabel="Xóa cửa hàng"
        loading={deleting}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
