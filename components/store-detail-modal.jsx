import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import { DirectionTurnIcon } from '@/components/icons/navigation-icons'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance, getStorePhoneNumbers } from '@/helper/validation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import { useAuth } from '@/lib/AuthContext'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'
import { supabase } from '@/lib/supabaseClient'
import { removeStoreFromCache } from '@/lib/storeCache'
import { buildStoreDiff, logStoreEditHistory } from '@/lib/storeEditHistory'

const StoreDetailMiniMap = dynamic(() => import('@/components/map/store-detail-mini-map'), {
  ssr: false,
})

function buildTelHref(phone) {
  return `tel:${String(phone || '').replace(/[^0-9+]/g, '')}`
}

export default function StoreDetailModal({ store, trigger, open, onOpenChange, onAddToRoute, onRemoveFromRoute, isInRoute = false }) {
  const router = useRouter()
  const { user, isAdmin } = useAuth() || {}
  const [internalOpen, setInternalOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)
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

  useEffect(() => {
    if (!resolvedOpen) {
      setMapExpanded(false)
    }
  }, [resolvedOpen])

  useEffect(() => {
    setMapExpanded(false)
  }, [store?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const mediaQuery = window.matchMedia('(min-width: 640px)')
    const handleChange = () => setIsDesktopLayout(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener?.('change', handleChange)

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange)
    }
  }, [])

  if (!store) return trigger || null

  const hasCoords = hasStoreCoordinates(store)
  const isActive = Boolean(store.active)
  const addressText = formatAddressParts(store)
  const googleMapsHref = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : ''
  const storeTypeMeta = getStoreTypeMeta(store.store_type)
  const storeTypeLabel = storeTypeMeta.label
  const phoneNumbers = getStorePhoneNumbers(store)
  const isMapPage = router.pathname === '/map'
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
    <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-md p-0 sm:max-h-[min(84vh,820px)] sm:w-[calc(100%-3rem)] sm:max-w-[1180px] sm:rounded-xl sm:border-slate-700 sm:bg-slate-950 sm:shadow-2xl sm:shadow-black/50">
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto sm:max-h-[min(82vh,780px)] sm:overflow-hidden">
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur px-3 pb-4 pt-5 sm:hidden">
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
            <DialogClose className="absolute right-2.5 top-2.5 h-8 w-8 shrink-0 cursor-pointer rounded-full border border-gray-700 bg-gray-900/80 text-gray-300 transition hover:bg-gray-800 hover:text-white">
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

        <div className="sm:grid sm:min-h-[620px] sm:grid-cols-[minmax(0,1fr)_460px] sm:gap-0 sm:bg-slate-950">
          <div className="px-3 pb-4 sm:flex sm:min-h-0 sm:flex-col sm:overflow-y-auto sm:px-6 sm:py-6">
            <div className="hidden sm:block">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0 flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-500/40 bg-sky-500/10 text-sky-300">
                    {storeTypeMeta.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-400">{storeTypeLabel}</p>
                    <OverflowMarquee
                      text={store.name}
                      textClassName="mt-0.5 text-3xl font-bold text-gray-100 leading-tight"
                    />
                  </div>
                </div>
                <DialogClose className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-700 bg-gray-900/80 text-gray-300 transition hover:bg-gray-800 hover:text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </DialogClose>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-200">
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

            {hasStoreInfo && (
              <div className="mt-4 space-y-2 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
                {addressText && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-2.5 sm:col-span-2 sm:border-slate-800 sm:bg-slate-900/45 sm:p-4">
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
                        <DirectionTurnIcon className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                )}

                {phoneNumbers.map((phoneValue, phoneIndex) => (
                  <div key={`detail-phone-${phoneValue}-${phoneIndex}`} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-2.5 sm:border-slate-800 sm:bg-slate-900/45 sm:p-4">
                    <svg className="h-5 w-5 shrink-0 text-gray-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-1.71 1.72z" />
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
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-1.71 1.72z" />
                      </svg>
                    </a>
                  </div>
                ))}

                {store.note && (
                  <div className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-2.5 sm:col-span-2 sm:border-slate-800 sm:bg-slate-900/45 sm:p-4">
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

            {hasCoords && !isMapPage && (
              <section className="mt-4 space-y-2 sm:hidden">
              <button
                type="button"
                onClick={() => setMapExpanded((value) => !value)}
                aria-expanded={mapExpanded}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-3 text-left transition hover:border-gray-700 hover:bg-gray-900/70 sm:border-slate-800 sm:bg-slate-900/45 sm:p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-200">Bản đồ khu vực</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {mapExpanded ? 'Thu gọn bản đồ để xem thông tin khác' : 'Bấm để xem vị trí cửa hàng và khu vực lân cận'}
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-gray-300">
                  <svg
                    className={`h-4 w-4 transition-transform ${mapExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {mapExpanded ? <StoreDetailMiniMap store={store} open={resolvedOpen} /> : null}
              </section>
            )}

            <section className="mt-4 space-y-2 border-t border-gray-800/70 pt-3 sm:mt-auto sm:border-slate-800 sm:pt-5">
            <p className="px-0.5 text-sm font-semibold text-gray-300">Thao tác</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {hasCoords && !isMapPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full px-3"
                  leftIcon={
                    <DirectionTurnIcon className="h-4 w-4 shrink-0" />
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

          <aside className="hidden min-h-0 border-l border-slate-800 bg-slate-900/40 p-5 sm:flex sm:flex-col">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-gray-100">Bản đồ khu vực</p>
                <p className="mt-0.5 text-sm text-gray-400">
                  {hasCoords && !isMapPage ? 'Vị trí cửa hàng và khu vực lân cận' : 'Cửa hàng chưa có vị trí để hiển thị bản đồ'}
                </p>
              </div>
              {hasCoords && !isMapPage && (
                <a
                  href={googleMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Mở Google Maps"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-sky-500/70 hover:text-sky-200"
                >
                  <DirectionTurnIcon className="h-5 w-5" />
                </a>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-inner">
              {hasCoords && !isMapPage && isDesktopLayout ? (
                <StoreDetailMiniMap store={store} open={resolvedOpen} fill />
              ) : (
                <div className="flex h-full min-h-[500px] items-center justify-center px-6 text-center text-sm text-gray-500">
                  {isMapPage ? 'Đang xem trên bản đồ chính.' : 'Chưa có tọa độ hợp lệ.'}
                </div>
              )}
            </div>
          </aside>
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
