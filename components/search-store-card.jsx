import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { IMAGEKIT_URL_ENDPOINT } from '@/lib/constants'

export default function SearchStoreCard({ store, onAdd, isAdded }) {
  const [imageError, setImageError] = useState(false)

  const handleImageError = () => {
    setImageError(true)
  }

  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return ''
    return distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`
  }

  const getImageSrc = (imageUrl) => {
    if (!imageUrl) return null
    
    // If already a full URL, use as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl
    }
    
    // Otherwise, prepend IMAGEKIT_URL_ENDPOINT
    return `${IMAGEKIT_URL_ENDPOINT}${imageUrl}`
  }

  return (
    <Card className="overflow-hidden rounded-xl bg-white dark:bg-black hover:shadow-lg transition duration-200 border border-gray-200 dark:border-gray-700">
      <CardContent className="p-0">
        {/* Image Top */}
        <div className="relative w-full h-56 sm:h-64 bg-gray-100 dark:bg-gray-800">
          {!imageError && store.image_url ? (
            <Image
              src={getImageSrc(store.image_url)}
              alt={store.name || 'store image'}
              fill
              className="object-cover"
              sizes="(max-width:640px) 100vw, 50vw"
              onError={handleImageError}
              priority
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <span className="text-xs text-gray-500">Chưa có ảnh</span>
            </div>
          )}
          {/* Top badges (verified & distance) */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-2">
            {store.active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 backdrop-blur">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Đã xác thực
              </span>
            )}
            {store.distance !== null && store.distance !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200 shadow">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {formatDistance(store.distance)}
              </span>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 flex flex-col gap-3 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg md:text-xl leading-tight break-words">
            {store.name}
          </h3>
          <div className="text-[13px] leading-snug text-gray-600 dark:text-gray-300 space-y-1 min-w-0">
            {/* Địa chỉ */}
            <div className="flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" /></svg>
              <p className="line-clamp-3 break-words flex-1">{store.address}</p>
            </div>
            {/* Số điện thoại */}
            {store.phone && (
              <div className="flex items-start gap-1.5">
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.69l1.12 3.36a1 1 0 01-.46 1.17l-1.6.96a11.04 11.04 0 005.25 5.25l.96-1.6a1 1 0 011.17-.46l3.36 1.12a1 1 0 01.69.95V19a2 2 0 01-2 2h-.5C10.149 21 3 13.851 3 5.5V5z" /></svg>
                <a
                  href={`tel:${store.phone.replace(/\s+/g,'')}`}
                  className="font-medium text-gray-700 dark:text-gray-200 hover:underline flex-1 break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {store.phone}
                </a>
              </div>
            )}
            {/* Ghi chú */}
            {store.notes && (
              <div className="flex items-start gap-1.5">
                <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h5l5 5v7a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 4v6h6" /></svg>
                <p className="text-amber-600 dark:text-amber-300 italic line-clamp-2 break-words flex-1">{store.notes}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {store.latitude && store.longitude && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm"
                onClick={() => window.open(`https://www.google.com/maps?q=${store.latitude},${store.longitude}`, '_blank')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                Bản đồ
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => onAdd(store)}
              disabled={isAdded}
              variant={isAdded ? 'secondary' : 'default'}
              className="flex-1 inline-flex items-center justify-center gap-2 text-sm"
            >
              {isAdded ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Đã thêm
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Thêm
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}