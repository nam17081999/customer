import { useState } from 'react'
import { useRouter } from 'next/router'
import Image from 'next/image'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { invalidateStoreCache, removeStoreFromCache } from '@/lib/storeCache'

export default function StoreDetailModal({ store, trigger, open, onOpenChange }) {
  const router = useRouter()
  const { user } = useAuth() || {}
  const [internalOpen, setInternalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const content = (
    <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden max-h-[90vh]">
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
              <button onClick={handleCall} className="text-blue-400 hover:underline break-all text-left font-medium">
                {store.phone}
              </button>
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

        {/* Action buttons */}
        <div className="px-4 pb-4 pt-2 flex flex-wrap gap-2">
          {hasCoords && (
            <Button asChild variant="outline" size="sm" className="flex-1 min-w-[80px] h-11 rounded-xl">
              <a
                href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-sm">Chỉ đường</span>
              </a>
            </Button>
          )}
          {store.phone && (
            <Button variant="outline" size="sm" className="flex-1 min-w-[80px] h-11 rounded-xl" onClick={handleCall}>
              <div className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <span className="text-sm">Gọi điện</span>
              </div>
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 min-w-[80px] h-11 rounded-xl" onClick={handleShare}>
            <div className="flex items-center justify-center gap-1.5">
              {copied ? (
                <>
                  <svg className="w-4 h-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm">Đã copy</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span className="text-sm">Chia sẻ</span>
                </>
              )}
            </div>
          </Button>
        </div>

        {/* Admin actions — visible only when logged in */}
        {user && (
          <div className="px-4 pb-4 pt-0 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-10 text-sm rounded-xl"
              onClick={handleEdit}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Sửa
              </div>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              className={`flex-1 h-10 text-sm rounded-xl transition-colors ${deleteConfirm ? 'border-red-500 text-red-500 bg-red-950/30 hover:bg-red-900/50' : 'text-red-500 hover:border-red-400'}`}
              onClick={handleDelete}
            >
              <div className="flex items-center justify-center gap-2">
                {deleting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                )}
                {deleteConfirm ? 'Xác nhận xoá?' : 'Xoá'}
              </div>
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  )

  const isControlled = open !== undefined
  const resolvedOpen = isControlled ? open : internalOpen
  const resolvedOnOpenChange = isControlled ? onOpenChange : setInternalOpen

  return (
    <Dialog open={resolvedOpen} onOpenChange={resolvedOnOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      {content}
    </Dialog>
  )
}
