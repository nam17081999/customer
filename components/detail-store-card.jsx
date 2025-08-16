import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import Link from 'next/link'
import { getFullImageUrl } from '@/helper/imageUtils'

export default function DetailStoreCard({ 
  store: s, 
  isSelected, 
  onAdd, 
  onRemove,
  // drag props (optional)
  item,
  dragAttributes, 
  dragListeners,
}) {
  // Only support selected style now
  const storeData = s || item
  const hasCoords = typeof storeData.latitude === 'number' && typeof storeData.longitude === 'number'

  const STATUS_LABELS = {
    active: 'Xác thực',
    inactive: 'Chưa xác thực'
  }

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
              <div className="truncate text-base font-medium text-gray-900 dark:text-gray-100">
                {storeData.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight">{storeData.address}</div>
              {storeData.phone && (
                <div className="truncate text-sm text-gray-600 dark:text-gray-400">
                  SĐT:{' '}
                  <a
                    href={`tel:${String(storeData.phone).replace(/[^0-9+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {storeData.phone}
                  </a>
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
                    href={`https://www.google.com/maps/dir/?api=1&destination=${storeData.latitude},${storeData.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Chỉ đường"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                    </svg>
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove?.(storeData.id)
                }}
                className="h-8 w-8 p-0 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                aria-label="Xóa khỏi danh sách"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row max-h-[90vh]">
          <div className="flex-shrink-0 w-full md:w-1/2">
            {storeData.image_url ? (
              <Image
                src={getFullImageUrl(storeData.image_url)}
                alt={storeData.name}
                width={500}
                height={400}
                className="w-full h-48 md:h-96 object-contain bg-gray-100 dark:bg-gray-800"
              />
            ) : (
              <div className="w-full h-48 md:h-96 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto">
            <div className="flex-1 space-y-3 md:space-y-4">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {storeData.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {storeData.address}
                </p>
              </div>

              <div className="space-y-3">
                {storeData.phone && (
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="hidden sm:inline">Điện thoại:</span>
                    </span>
                    <a
                      href={`tel:${String(storeData.phone).replace(/[^0-9+]/g, '')}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {storeData.phone}
                    </a>
                  </div>
                )}

                {storeData.status && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="hidden sm:inline">Trạng thái:</span>
                    </span>
                    <span className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium ${
                      storeData.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    }`}>
                      {storeData.status === 'active' ? STATUS_LABELS.active : STATUS_LABELS.inactive}
                    </span>
                  </div>
                )}

                {typeof storeData.distance === 'number' && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                      </svg>
                      <span className="hidden sm:inline">Khoảng cách:</span>
                    </span>
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {storeData.distance.toFixed(1)} km
                    </span>
                  </div>
                )}

                {storeData.note && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="hidden sm:inline">Ghi chú:</span>
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      {storeData.note}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700 mt-4 md:mt-6">
              <div className="flex flex-col sm:hidden gap-2">
                {hasCoords && (
                  <Button asChild variant="outline" size="lg" className="w-full">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${storeData.latitude},${storeData.longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                      </svg>
                      <span className="font-medium">Chỉ đường</span>
                    </a>
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/store/${storeData.id}`} className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="text-sm font-medium">Sửa</span>
                    </Link>
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline" className="flex-1">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm font-medium">Đóng</span>
                      </div>
                    </Button>
                  </DialogClose>
                </div>
              </div>

              <div className="hidden sm:flex gap-3">
                <Button asChild variant="outline" className="flex-1 h-12">
                  <Link href={`/store/${storeData.id}`} className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="font-medium">Sửa</span>
                  </Link>
                </Button>
                {hasCoords && (
                  <Button asChild variant="outline" className="flex-1 h-12">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${storeData.latitude},${storeData.longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                      </svg>
                      <span className="font-medium">Chỉ đường</span>
                    </a>
                  </Button>
                )}
                <DialogClose asChild>
                  <Button variant="outline" className="flex-1 h-12">
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="font-medium">Đóng</span>
                    </div>
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
