import React, { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import { getFullImageUrl } from '@/helper/imageUtils'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'

export function DetailStoreModalContent({ store }) {
  const [copied, setCopied] = useState(false)
  if (!store) return null
  const hasCoords = typeof store.latitude === 'number' && typeof store.longitude === 'number'
  const isActive = Boolean(store.active)
  const addressText = formatAddressParts(store)

  const handleShare = async () => {
    const lines = [`Tên: ${store.name}`]
    if (addressText) lines.push(`Địa chỉ: ${addressText}`)
    if (hasCoords) lines.push(`Vị trí: https://www.google.com/maps?q=${store.latitude},${store.longitude}`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback ignored */ }
  }

  const ActionSection = () => (
    <div className="flex-shrink-0 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700 mt-4 md:mt-6">
      {/* Mobile */}
      <div className="sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          {hasCoords && (
            <Button asChild variant="outline" className="w-full h-11 text-sm">
              <a href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                Bản đồ
              </a>
            </Button>
          )}
          <Button variant="outline" className="w-full h-11 text-sm" onClick={handleShare}>
            <div className="flex items-center justify-center gap-2">
              {copied ? (
                <>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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
          <DialogClose asChild>
            <Button variant="outline" className="w-full h-11 text-sm">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Đóng
              </div>
            </Button>
          </DialogClose>
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden sm:flex gap-3">
        {hasCoords && (
          <Button asChild variant="outline" className="flex-1 h-12">
            <a
              href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
              Bản đồ
            </a>
          </Button>
        )}
        <Button variant="outline" className="flex-1 h-12" onClick={handleShare}>
          <div className="flex items-center justify-center gap-3">
            {copied ? (
              <>
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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
        <DialogClose asChild>
          <Button variant="outline" className="flex-1 h-12">
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Đóng
            </div>
          </Button>
        </DialogClose>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row max-h-[90vh]">
      <div className="flex-shrink-0 w-full md:w-1/2 relative">
        <Image
          src={getFullImageUrl(store.image_url)}
          alt={store.name}
          width={500}
          height={400}
          className="w-full h-48 md:h-96 object-contain bg-gray-100 dark:bg-gray-800"
        />
        {typeof store.distance === 'number' && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 shadow">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {formatDistance(store.distance)}
          </div>
        )}
      </div>
      <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto">
        <div className="flex-1 space-y-3 md:space-y-4">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{store.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{addressText}</p>
          </div>
          <div className="space-y-3">
            {store.phone && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span className="hidden sm:inline">Điện thoại:</span>
                </span>
                <a href={`tel:${String(store.phone).replace(/[^0-9+]/g,'')}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all cursor-pointer">{store.phone}</a>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                <span className="hidden sm:inline">Trạng thái:</span>
              </span>
              <span className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>{isActive ? 'Xác thực' : 'Chưa xác thực'}</span>
            </div>
            {typeof store.distance === 'number' && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                  <span className="hidden sm:inline">Khoảng cách:</span>
                </span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{formatDistance(store.distance)}</span>
              </div>
            )}
            {store.note && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  <span className="hidden sm:inline">Ghi chú:</span>
                </span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{store.note}</span>
              </div>
            )}
          </div>
        </div>
        <ActionSection />
      </div>
    </div>
  )
}

export default function DetailStoreCard({ 
  store: s, 
  item,
  dragAttributes, 
  dragListeners,
}) {
  const storeData = s || item
  const hasCoords = typeof storeData.latitude === 'number' && typeof storeData.longitude === 'number'
  const addressText = formatAddressParts(storeData)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-3 p-3">
            {dragAttributes && dragListeners && (
              <button
                type="button"
                aria-label="Kéo để sắp xếp"
                {...dragAttributes}
                {...dragListeners}
                onClick={(e) => e.stopPropagation()}
                className="flex h-8 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M7 5a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
            )}
            <div className="min-w-0 flex-1">
              {typeof storeData.distance === 'number' && (
                <div className="mb-1">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {formatDistance(storeData.distance)}
                  </span>
                </div>
              )}
              <div className="truncate text-base font-medium text-gray-900 dark:text-gray-100">{storeData.name}</div>
              {/* Địa chỉ với biểu tượng */}
              {addressText && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight mt-0.5 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" />
                  </svg>
                  <span className="line-clamp-2 break-words">{addressText}</span>
                </div>
              )}
              {/* SĐT với biểu tượng */}
              {storeData.phone && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight mt-0.5 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a
                    href={`tel:${String(storeData.phone).replace(/[^0-9+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all cursor-pointer"
                  >
                    {storeData.phone}
                  </a>
                </div>
              )}
              {/* Ghi chú với biểu tượng */}
              {storeData.note && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight mt-0.5 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="line-clamp-2 break-words">{storeData.note}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {hasCoords && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <a
                    href={`https://www.google.com/maps?q=${storeData.latitude},${storeData.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Chỉ đường"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" /></svg>
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DetailStoreModalContent store={storeData} context="search" />
      </DialogContent>
    </Dialog>
  )
}
