import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance, getStorePhoneNumbers } from '@/helper/validation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import { useAuth } from '@/lib/AuthContext'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { supabase } from '@/lib/supabaseClient'
import { removeStoreFromCache } from '@/lib/storeCache'
import { buildStoreDiff, logStoreEditHistory } from '@/lib/storeEditHistory'

function buildTelHref(phone) {
  return `tel:${String(phone || '').replace(/[^0-9+]/g, '')}`
}

export default function StoreDetailModal({ store, trigger, open, onOpenChange, onAddToRoute, onRemoveFromRoute, isInRoute = false }) {
  const router = useRouter()
  const { user, isAdmin } = useAuth() || {}
  const [internalOpen, setInternalOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
  const isActive = Boolean(store.active)
  const addressText = formatAddressParts(store)
  const googleMapsHref = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : ''
  const storeTypeMeta = getStoreTypeMeta(store.store_type)
  const storeTypeLabel = storeTypeMeta.label
  const phoneNumbers = getStorePhoneNumbers(store)
  const hasRouteAction = hasCoords && (
    (isInRoute && typeof onRemoveFromRoute === 'function') ||
    (!isInRoute && typeof onAddToRoute === 'function')
  )
  const hasStoreInfo = Boolean(addressText || phoneNumbers.length > 0 || store.note)

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

  const detailContent = (
    <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-md p-0 overflow-hidden max-h-[90vh] z-[310]">
      <div className="flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur pt-5 pb-4 px-3">
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

          {hasStoreInfo && (
              <div className="space-y-2 mt-4">
                {addressText && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-2.5">
                    <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight text-gray-500">Địa chỉ</p>
                      <p className="break-words text-base leading-relaxed text-gray-200">{addressText}</p>
                    </div>
                    {hasCoords && (
                      <a
                        href={googleMapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Mở địa chỉ trên Google Maps"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-800 text-gray-400 transition"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}

                {phoneNumbers.map((phoneValue, phoneIndex) => (
                  <div key={`detail-phone-${phoneValue}-${phoneIndex}`} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-2.5">
                    <svg className="h-5 w-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight text-gray-500">Số điện thoại {phoneIndex + 1}</p>
                      <p className="break-all text-base leading-relaxed text-gray-200">{phoneValue}</p>
                    </div>
                    <a
                      href={buildTelHref(phoneValue)}
                      aria-label={`Gọi số điện thoại ${phoneIndex + 1}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-800 text-gray-400 transition"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </a>
                  </div>
                ))}

                {store.note && (
                  <div className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-2.5">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight text-gray-500">Ghi chú</p>
                      <p className="break-words text-base leading-relaxed text-gray-200">{store.note}</p>
                    </div>
                  </div>
                )}
            </div>
          )}

          <section className="space-y-2 border-t border-gray-800/70 pt-3">
            <p className="px-0.5 text-sm font-semibold text-gray-300">Thao tác</p>
            <div className="grid grid-cols-2 gap-2">
              {hasCoords && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full px-3"
                  leftIcon={
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/map?storeId=${store.id}&lat=${store.latitude}&lng=${store.longitude}`)
                  }}
                >
                  Bản đồ
                </Button>
              )}

              {hasRouteAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full px-3"
                  leftIcon={
                    isInRoute
                      ? <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      : <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isInRoute) {
                      onRemoveFromRoute(store.id)
                      return
                    }
                    onAddToRoute(store)
                    handleDetailOpenChange(false)
                  }}
                >
                  {isInRoute ? 'Bỏ tuyến' : 'Thêm tuyến'}
                </Button>
              )}

              {!isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full px-3"
                  leftIcon={
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  }
                  onClick={handleSupplement}
                >
                  Bổ sung
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full px-3"
                  leftIcon={
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  }
                  onClick={handleEdit}
                >
                  Sửa
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full px-3"
                  leftIcon={
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                  onClick={handleOpenHistory}
                >
                  Lịch sử
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full px-3"
                leftIcon={
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                Báo cáo
              </Button>

              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full px-3"
                  disabled={deleting}
                  leftIcon={
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  }
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  {deleting ? 'Đang xóa...' : 'Xóa'}
                </Button>
              )}
            </div>
          </section>
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




