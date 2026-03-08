import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { haversineKm } from '@/helper/distance'

export default function StoreDetailPage() {
  const router = useRouter()
  const { id } = router.query

  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [distance, setDistance] = useState(null)

  // Fetch store
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('stores')
      .select('id,name,image_url,latitude,longitude,address_detail,ward,district,phone,note,active,created_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err || !data) {
          setError('Không tìm thấy cửa hàng')
        } else {
          setStore(data)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [id])

  // Get distance from user
  useEffect(() => {
    if (!store || store.latitude == null || store.longitude == null) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = haversineKm(pos.coords.latitude, pos.coords.longitude, store.latitude, store.longitude)
        setDistance(d)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [store])

  const hasCoords = store && typeof store.latitude === 'number' && typeof store.longitude === 'number'
  const isActive = store && Boolean(store.active)
  const addressText = store ? formatAddressParts(store) : ''
  const imageSrc = imageError || !store ? STORE_PLACEHOLDER_IMAGE : getFullImageUrl(store.image_url)

  const handleShare = async () => {
    if (!store) return
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const lines = [`Tên: ${store.name}`]
    if (addressText) lines.push(`Địa chỉ: ${addressText}`)
    if (hasCoords) lines.push(`Vị trí: https://www.google.com/maps?q=${store.latitude},${store.longitude}`)
    lines.push(`Xem chi tiết: ${url}`)

    // Try native share first (mobile), fallback to clipboard
    if (navigator.share) {
      try {
        await navigator.share({ title: store.name, text: lines.join('\n'), url })
        return
      } catch { /* user cancelled or not supported */ }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback ignored */ }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="max-w-screen-md mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="w-full h-64 rounded-xl bg-gray-200 dark:bg-gray-800" />
            <div className="h-6 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  // Error / not found
  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="max-w-screen-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
          </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">Không tìm thấy cửa hàng</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Cửa hàng không tồn tại hoặc đã bị xoá</p>
          <Button asChild variant="outline">
            <Link href="/">← Về trang chủ</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{store.name} - StoreVis</title>
        <meta name="description" content={`${store.name} - ${addressText}`} />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="max-w-screen-md mx-auto">
          {/* Image */}
          <div className="relative w-full h-56 sm:h-72 bg-gray-100 dark:bg-gray-800">
            <Image
              src={imageSrc}
              alt={store.name}
              fill
              className="object-contain"
              sizes="(max-width:768px) 100vw, 768px"
              onError={() => setImageError(true)}
              priority
            />
            {/* Back button overlay */}
            <button
              type="button"
              onClick={() => router.back()}
              className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition"
              aria-label="Quay lại"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            {/* Badges */}
            <div className="absolute top-3 right-3 flex gap-2">
              {isActive && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/90 text-white backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Đã xác thực
                </span>
              )}
              {distance != null && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-black/40 text-white backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {formatDistance(distance)}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-5 space-y-5">
            {/* Name & status */}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{store.name}</h1>
              {!isActive && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Chưa xác thực
                </span>
              )}
            </div>

            {/* Info rows */}
            <div className="space-y-3">
              {/* Address */}
              {addressText && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="text-sm text-gray-300 leading-relaxed break-words">{addressText}</p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {store.phone && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <a
                    href={`tel:${String(store.phone).replace(/[^0-9+]/g, '')}`}
                    className="text-sm text-blue-400 hover:underline pt-2 break-all"
                  >
                    {store.phone}
                  </a>
                </div>
              )}

              {/* Note */}
              {store.note && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <p className="text-sm text-gray-300 pt-1.5 break-words flex-1">{store.note}</p>
                </div>
              )}

              {/* Created at */}
              {store.created_at && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400 pt-2">
                    {new Date(store.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {hasCoords && (
                <Button asChild variant="outline" className="h-12 text-sm">
                  <a
                    href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Chỉ đường
                  </a>
                </Button>
              )}
              <Button variant="outline" className="h-12 text-sm" onClick={handleShare}>
                <div className="flex items-center justify-center gap-2">
                  {copied ? (
                    <>
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Đã copy
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      Chia sẻ
                    </>
                  )}
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
