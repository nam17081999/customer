import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatAddressParts } from '@/lib/utils'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { formatDistance } from '@/helper/validation'
import StoreDetailModal from '@/components/store-detail-modal'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'

export default function SearchStoreCard({ store, distance, searchTerm, compact }) {
  const [imageError, setImageError] = useState(false)

  const handleImageError = () => {
    setImageError(true)
  }

  const imageSrc = imageError ? STORE_PLACEHOLDER_IMAGE : getFullImageUrl(store.image_url)

  const addressText = formatAddressParts(store)

  const renderHighlightedName = (name, term) => {
    const text = name || ''
    const q = (term || '').trim()
    if (!q) return text
    const normText = removeVietnameseTones(text).toLowerCase()
    const normQ = removeVietnameseTones(q).toLowerCase()
    if (!normQ) return text

    const ranges = []
    let start = 0
    while (start <= normText.length - normQ.length) {
      const idx = normText.indexOf(normQ, start)
      if (idx === -1) break
      ranges.push([idx, idx + normQ.length])
      start = idx + normQ.length
    }
    if (ranges.length === 0) return text

    const parts = []
    let lastEnd = 0
    ranges.forEach(([s, e], i) => {
      if (s > lastEnd) parts.push(text.slice(lastEnd, s))
      parts.push(
        <mark key={`hl-${i}`} className="bg-yellow-200 dark:bg-yellow-700 -md px-0.5">
          {text.slice(s, e)}
        </mark>
      )
      lastEnd = e
    })
    if (lastEnd < text.length) parts.push(text.slice(lastEnd))
    return parts
  }

  // ── Compact horizontal layout ──
  if (compact) {
    const compactCard = (
      <Card className="overflow-hidden rounded-md bg-gray-950 hover:shadow-md transition duration-200 border border-gray-800 cursor-pointer">
        <CardContent className="p-0">
          <div className="flex gap-3 p-3">
            {/* Thumbnail */}
            <div className="relative w-20 h-20 rounded-md overflow-hidden bg-gray-800 flex-shrink-0">
              <Image
                src={imageSrc}
                alt={store.name || 'store image'}
                fill
                className="object-cover"
                sizes="80px"
                onError={handleImageError}
              />
              {store.active && (
                <div className="absolute top-1 left-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </span>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              <OverflowMarquee
                className="max-w-full"
                textClassName="font-semibold text-gray-100 text-base leading-snug"
                contentKey={`${store.id}:${store.name}:${searchTerm || ''}`}
              >
                {renderHighlightedName(store.name, searchTerm)}
              </OverflowMarquee>
              <p className="text-base text-gray-400 line-clamp-2 leading-snug">{addressText}</p>
              {distance !== null && distance !== undefined && (
                <span className="inline-flex items-center gap-0.5 text-base text-gray-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {formatDistance(distance)}
                </span>
              )}
              {store.phone && (
                <a
                  href={`tel:${store.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-0.5 text-base text-blue-400 hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.69l1.12 3.36a1 1 0 01-.46 1.17l-1.6.96a11.04 11.04 0 005.25 5.25l.96-1.6a1 1 0 011.17-.46l3.36 1.12a1 1 0 01.69.95V19a2 2 0 01-2 2h-.5C10.149 21 3 13.851 3 5.5V5z" /></svg>
                  <span className="truncate">{store.phone}</span>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
    return <StoreDetailModal store={store} trigger={compactCard} />
  }

  // ── Full (original) layout ──
  const fullCard = (
    <Card className="overflow-hidden rounded-md bg-gray-950 hover:shadow-lg transition duration-200 border border-gray-800 cursor-pointer">
      <CardContent className="p-0">
        {/* Image Top */}
        <div className="relative w-full h-56 sm:h-64 bg-gray-800">
          <Image
            src={imageSrc}
            alt={store.name || 'store image'}
            fill
            className="object-cover"
            sizes="(max-width:640px) 100vw, 50vw"
            onError={handleImageError}
          />
          {/* Top badges (verified & distance) */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-2">
            {store.active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-900/40 text-green-300 backdrop-blur">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Đã xác thực
              </span>
            )}
            {distance !== null && distance !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-900 text-gray-200 shadow">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {formatDistance(distance)}
              </span>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 flex flex-col gap-3 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg md:text-xl leading-tight break-words">
            {renderHighlightedName(store.name, searchTerm)}
          </h3>
          <div className="text-base leading-snug text-gray-300 space-y-1 min-w-0">
            {/* Địa chỉ */}
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" /></svg>
              <p className="line-clamp-3 break-words flex-1">{addressText}</p>
            </div>
            {/* Số điện thoại */}
            {store.phone && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.69l1.12 3.36a1 1 0 01-.46 1.17l-1.6.96a11.04 11.04 0 005.25 5.25l.96-1.6a1 1 0 011.17-.46l3.36 1.12a1 1 0 01.69.95V19a2 2 0 01-2 2h-.5C10.149 21 3 13.851 3 5.5V5z" /></svg>
                <a
                  href={`tel:${store.phone.replace(/\s+/g, '')}`}
                  className="font-medium text-gray-200 hover:underline flex-1 break-all cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {store.phone}
                </a>
              </div>
            )}
            {/* Ghi chú */}
            {store.note && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h5l5 5v7a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 4v6h6" /></svg>
                <p className="line-clamp-3 break-words flex-1">{store.note}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {store.latitude && store.longitude && (
              <Button
                variant="outline"
                className="flex-1"
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                }
                onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps?q=${store.latitude},${store.longitude}`, '_blank') }}
              >
                Bản đồ
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return <StoreDetailModal store={store} trigger={fullCard} />
}
