import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance, getStorePhoneNumbers } from '@/helper/validation'
import { hasStoreCoordinates, hasStoreSupplementOpportunity } from '@/helper/storeSupplement'
import { useAuth } from '@/lib/AuthContext'
import { formatLastCalledText, getTelesaleResultLabel, hasReportedOrder } from '@/helper/telesale'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { supabase } from '@/lib/supabaseClient'
import { removeStoreFromCache, updateStoreInCache } from '@/lib/storeCache'
import { buildStoreDiff, logStoreEditHistory } from '@/lib/storeEditHistory'

export default function StoreDetailModal({ store, trigger, open, onOpenChange, onAddToRoute, onRemoveFromRoute, isInRoute = false }) {
  const router = useRouter()
  const { user, isAdmin, isTelesale } = useAuth() || {}
  const [internalOpen, setInternalOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailNotice, setDetailNotice] = useState('')
  const [isPotential, setIsPotential] = useState(false)
  const [potentialSaving, setPotentialSaving] = useState(false)
  const detailNoticeTimerRef = useRef(null)
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
      setDetailNotice('')
      if (detailNoticeTimerRef.current) {
        clearTimeout(detailNoticeTimerRef.current)
        detailNoticeTimerRef.current = null
      }
      return
    }

    setIsPotential(Boolean(store.is_potential))
  }, [resolvedOpen, store])

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
  const phoneNumbers = getStorePhoneNumbers(store)
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
      try {
        const changes = buildStoreDiff(store, { deleted_at: nowIso })
        await logStoreEditHistory({
          storeId: store.id,
          actionType: 'delete_soft',
          actorUserId: user?.id,
          changes,
        })
      } catch (err) {
        console.error('store_edit_history delete_soft failed:', err)
      }
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
            detail: { type: 'delete', id: store.id, shouldRefetchAll: true },
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

  const handleOpenHistory = (e) => {
    e.stopPropagation()
    const from = router.asPath || '/'
    router.push(`/store/history/${store.id}?from=${encodeURIComponent(from)}`)
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
    const actorRole = isAdmin ? 'admin' : isTelesale ? 'telesale' : 'guest'

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
    try {
      const changes = buildStoreDiff(store, { is_potential: nextPotential })
      await logStoreEditHistory({
        storeId: store.id,
        actionType: 'telesale_potential_toggle',
        actorUserId: user?.id,
        actorRole,
        changes,
      })
    } catch (err) {
      console.error('store_edit_history telesale_potential_toggle failed:', err)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storevis:stores-changed', {
          detail: { type: 'update', id: store.id, store: nextStore, shouldRefetchAll: false },
        })
      )
    }
    showDetailNotice(nextPotential ? 'Đã chuyển cửa hàng sang tiềm năng.' : 'Đã chuyển cửa hàng về trạng thái thường.')
    setPotentialSaving(false)
  }

  const detailContent = (
    <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden max-h-[90vh] z-[310]">
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
            {phoneNumbers.map((phoneValue, phoneIndex) => (
              <div key={`detail-phone-${phoneValue}-${phoneIndex}`} className="mt-2 flex items-center gap-2.5 text-base text-gray-400">
                <svg className="w-5 h-5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="break-all text-left">
                  {phoneValue}
                </span>
              </div>
            ))}

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
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${isPotential
                      ? 'border-emerald-500 bg-emerald-500/25'
                      : 'border-gray-700 bg-gray-900'
                    } ${potentialSaving ? 'opacity-70' : ''}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${isPotential ? 'translate-x-6' : 'translate-x-1'
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

          {(hasCoords || phoneNumbers.length > 0) && (
            <>
              <div className="border-t border-gray-800/60" />
              <div className="space-y-1.5">
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Liên hệ & Điều hướng</p>
                <div className="grid grid-cols-2 gap-2">

                  {/* Gọi điện — mỗi số một nút */}
                  {phoneNumbers.map((phoneValue, idx) => (
                    <a
                      key={`call-${phoneValue}-${idx}`}
                      href={`tel:${phoneValue.replace(/\s/g, '')}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-600/50 bg-emerald-600/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/20 active:scale-95"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="truncate">{phoneNumbers.length > 1 ? phoneValue : 'Gọi điện'}</span>
                    </a>
                  ))}

                  {/* Google Maps */}
                  {hasCoords && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-600/50 bg-sky-600/10 px-3 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-600/20 active:scale-95"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      GG Maps
                    </a>
                  )}

                  {/* Bản đồ nội bộ */}
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

                  {/* Thêm / Bỏ tuyến */}
                  {hasCoords && isInRoute && typeof onRemoveFromRoute === 'function' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      leftIcon={
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFromRoute(store.id)
                      }}
                    >
                      Bỏ khỏi tuyến
                    </Button>
                  )}
                  {hasCoords && !isInRoute && typeof onAddToRoute === 'function' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      leftIcon={
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToRoute(store)
                        handleDetailOpenChange(false)
                      }}
                    >
                      Thêm vào tuyến
                    </Button>
                  )}

                </div>
              </div>
            </>
          )}

          {/* ── Nhóm 2: Quản lý ── */}
          {(canSupplement || isAdmin) && (
            <>
              <div className="border-t border-gray-800/60" />
              <div className="space-y-1.5">
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Quản lý</p>
                <div className="grid grid-cols-2 gap-2">
                  {canSupplement && (
                    <Button
                      variant="outline"
                      className="w-full"
                      leftIcon={
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      }
                      onClick={handleSupplement}
                    >
                      Bổ sung
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="w-full"
                      leftIcon={
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      }
                      onClick={handleEdit}
                    >
                      Chỉnh sửa
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="w-full col-span-2"
                      leftIcon={
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      }
                      onClick={handleOpenHistory}
                    >
                      Lịch sử chỉnh sửa
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Nhóm 3: Phản hồi ── */}
          <div className="border-t border-gray-800/60" />
          <div className="space-y-1.5">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Phản hồi</p>
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
                const hasDistance = typeof store.distance === 'number' && Number.isFinite(store.distance)
                const distanceQuery = hasDistance ? `&distance=${encodeURIComponent(String(store.distance))}` : ''
                router.push(`/store/report/${store.id}?from=${encodeURIComponent(from)}${distanceQuery}`)
              }}
            >
              Báo cáo cửa hàng
            </Button>
          </div>

          {/* ── Nhóm 4: Vùng nguy hiểm (admin only) ── */}
          {isAdmin && (
            <>
              <div className="border-t border-red-900/40" />
              <div className="space-y-1.5">
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-red-500/70">Vùng nguy hiểm</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={deleting}
                  leftIcon={
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  }
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  {deleting ? 'Đang xóa...' : 'Xóa cửa hàng'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DialogContent>
  )

  return (
    <>
      <Dialog open={resolvedOpen} onOpenChange={handleDetailOpenChange}>
        {triggerNode || null}
        {detailContent}
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
