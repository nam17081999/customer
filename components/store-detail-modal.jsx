import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { formatAddressParts, toTitleCaseVI } from '@/lib/utils'
import { DISTRICT_SUGGESTIONS, DISTRICT_WARD_SUGGESTIONS, REPORT_REASON_OPTIONS } from '@/lib/constants'
import { formatDistance } from '@/helper/validation'
import { getBestPosition, getGeoErrorMessage } from '@/helper/geolocation'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { invalidateStoreCache, removeStoreFromCache } from '@/lib/storeCache'

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
  const { user } = useAuth() || {}
  const [internalOpen, setInternalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportMode, setReportMode] = useState('')
  const [reportReasons, setReportReasons] = useState([])
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSuccess, setReportSuccess] = useState('')
  const [detailNotice, setDetailNotice] = useState('')
  const detailNoticeTimerRef = useRef(null)
  const [reportName, setReportName] = useState('')
  const [reportAddressDetail, setReportAddressDetail] = useState('')
  const [reportWard, setReportWard] = useState('')
  const [reportDistrict, setReportDistrict] = useState('')
  const [reportPhone, setReportPhone] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [reportLat, setReportLat] = useState(null)
  const [reportLng, setReportLng] = useState(null)
  const [reportMapEditable, setReportMapEditable] = useState(false)
  const [reportResolving, setReportResolving] = useState(false)

  const isControlled = open !== undefined
  const resolvedOpen = isControlled ? open : internalOpen
  const resolvedOnOpenChange = isControlled ? onOpenChange : setInternalOpen

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
      setReportName(store.name || '')
      setReportAddressDetail(store.address_detail || '')
      setReportWard(store.ward || '')
      setReportDistrict(store.district || '')
      setReportPhone(store.phone || '')
      setReportNote(store.note || '')
      setReportLat(typeof store.latitude === 'number' ? store.latitude : null)
      setReportLng(typeof store.longitude === 'number' ? store.longitude : null)
    }
  }, [resolvedOpen, store?.id])

  if (!store) return trigger || null

  const hasCoords = typeof store.latitude === 'number' && typeof store.longitude === 'number'
  const isActive = Boolean(store.active)
  const addressText = formatAddressParts(store)
  const imageSrc = imageError ? STORE_PLACEHOLDER_IMAGE : getFullImageUrl(store.image_url)

  const handleShare = async (e) => {
    e.stopPropagation()
    const lines = [`Tên: ${store.name}`]
    if (addressText) lines.push(`Địa chỉ: ${addressText}`)
    if (hasCoords) lines.push(`Vị trí: https://www.google.com/maps?q=${store.latitude},${store.longitude}`)

    if (navigator.share) {
      try {
        await navigator.share({ title: store.name, text: lines.join('\n') })
        return
      } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignored */ }
  }

  const handleCall = (e) => {
    e.stopPropagation()
    if (store.phone) {
      window.location.href = `tel:${String(store.phone).replace(/[^0-9+]/g, '')}`
    }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 4000)
      return
    }
    setDeleting(true)
    // Soft delete: ghi thời điểm xoá vào deleted_at thay vì xoá dòng khỏi DB
    const { error } = await supabase
      .from('stores')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', store.id)
    if (!error) {
      // 1) Xoá khỏi cache local ngay lập tức để UI cập nhật
      await removeStoreFromCache(store.id)

      // 2) Buộc lần load tiếp theo re-sync với DB
      await invalidateStoreCache()

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('storevis:stores-changed', {
            detail: { type: 'delete', id: store.id, shouldRefetchAll: true },
          })
        )
      }
      if (onOpenChange) onOpenChange(false)
      else setInternalOpen(false)
    }
    setDeleting(false)
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    router.push(`/store/edit/${store.id}`)
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
    const normalizedDetail = reportAddressDetail.trim() ? toTitleCaseVI(reportAddressDetail.trim()) : null
    const normalizedWard = reportWard.trim() ? toTitleCaseVI(reportWard.trim()) : null
    const normalizedDistrict = reportDistrict.trim() ? toTitleCaseVI(reportDistrict.trim()) : null
    const normalizedPhone = reportPhone.trim() || null
    const normalizedNote = reportNote.trim() || null

    if (normalizedName && normalizedName !== (store.name || '')) proposed.name = normalizedName
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
      setReportError('Không gửi được báo cáo, vui lòng thử lại')
    } else {
      setReportOpen(false)
      setReportReasons([])
      setReportMode('')
      setDetailNotice('Đã gửi báo cáo. Admin sẽ xem xét cập nhật.')
      if (detailNoticeTimerRef.current) clearTimeout(detailNoticeTimerRef.current)
      detailNoticeTimerRef.current = setTimeout(() => {
        setDetailNotice('')
        detailNoticeTimerRef.current = null
      }, 3000)
    }
    setReportSubmitting(false)
  }

  const detailContent = (
    <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden max-h-[90vh]">
      <div className="flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Image */}
        <div className="relative w-full h-48 sm:h-56 bg-gray-900 flex-shrink-0">
          <Image
            src={imageSrc}
            alt={store.name}
            fill
            className="object-contain"
            sizes="(max-width:448px) 100vw, 448px"
            onError={() => setImageError(true)}
          />
          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/90 text-white backdrop-blur-sm shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Xác thực
              </span>
            )}
          </div>
          {/* Close */}
          <DialogClose className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </DialogClose>
        </div>

        {/* Info */}
        <div className="px-4 pt-4 pb-2 space-y-3">
          {/* Name + distance */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-bold text-gray-100 leading-tight break-words min-w-0 flex-1">
              {store.name}
            </h3>
            {typeof store.distance === 'number' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300 flex-shrink-0 whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {formatDistance(store.distance)}
              </span>
            )}
          </div>

          {/* Address */}
          {addressText && (
            <div className="flex items-start gap-2.5 text-base text-gray-400">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="break-words leading-relaxed">{addressText}</span>
            </div>
          )}

          {/* Phone */}
          {store.phone && (
            <div className="flex items-center gap-2.5 text-base">
              <svg className="w-5 h-5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <Button variant="link" onClick={handleCall} className="break-all text-left">
                {store.phone}
              </Button>
            </div>
          )}

          {/* Note */}
          {store.note && (
            <div className="flex items-start gap-2.5 text-base text-gray-400">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="break-words leading-relaxed">{store.note}</span>
            </div>
          )}


        </div>

        {detailNotice && (
          <div className="px-4 pb-2">
            <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
              {detailNotice}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-2">
          {user && (
            <>
              <Button
                variant="outline"
                className="w-full"
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                }
                onClick={handleEdit}
              >
                Sửa
              </Button>
              <Button
                variant={deleteConfirm ? 'destructiveConfirm' : 'destructive'}
                disabled={deleting}
                className="w-full"
                leftIcon={deleting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                )}
                onClick={handleDelete}
              >
                {deleteConfirm ? 'Xác nhận xoá?' : 'Xoá'}
              </Button>
            </>
          )}
          {hasCoords && (
            <Button
              variant="outline"
              className="w-full"
              leftIcon={
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              }
              onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps?q=${store.latitude},${store.longitude}`, '_blank') }}
            >
              Chỉ đường
            </Button>
          )}
          {store.phone && (
            <Button
              variant="outline"
              className="w-full"
              leftIcon={
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              }
              onClick={handleCall}
            >
              Gọi điện
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            leftIcon={copied ? (
              <svg className="w-4 h-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            )}
            onClick={handleShare}
          >
            {copied ? 'Đã copy' : 'Chia sẻ'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            leftIcon={
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h10a2 2 0 012 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h8M7 12h5" />
              </svg>
            }
            onClick={() => {
              setReportOpen(true)
              setReportMode('')
              setReportError('')
              setReportSuccess('')
            }}
          >
            Báo cáo
          </Button>
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
            <p className="text-base font-semibold text-gray-100 truncate">{store.name}</p>
          </div>
          <DialogClose className="ml-auto w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </DialogClose>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300">
            Báo cáo sẽ được admin duyệt trước khi cập nhật.
          </div>

          {!reportMode && (
            <div className="space-y-2">
              <Button type="button" className="w-full" onClick={() => setReportMode('edit')}>
                Sửa thông tin
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setReportMode('reason')}>
                Chỉ báo cáo
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
                <Label htmlFor="report-name" className="text-sm text-gray-300">Tên cửa hàng</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="VD: Tạp Hóa Minh Anh"
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
    <Dialog open={resolvedOpen} onOpenChange={resolvedOnOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      {content}
    </Dialog>
  )
}
