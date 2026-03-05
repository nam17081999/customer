import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import StoreDetailModal from '@/components/store-detail-modal'

export default function DetailStoreCard({ 
  store: s, 
  item,
  dragAttributes, 
  dragListeners,
}) {
  const storeData = s || item
  const hasCoords = typeof storeData.latitude === 'number' && typeof storeData.longitude === 'number'
  const addressText = formatAddressParts(storeData)

  const card = (
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-3">
            {dragAttributes && dragListeners && (
              <button
                type="button"
                aria-label="Kéo để sắp xếp"
                {...dragAttributes}
                {...dragListeners}
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
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
              {addressText && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight mt-0.5 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.893 2-1.995A2 2 0 0012 7a2 2 0 00-2 2.005C10 10.107 10.895 11 12 11z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0z" />
                  </svg>
                  <span className="line-clamp-2 break-words">{addressText}</span>
                </div>
              )}
              {storeData.phone && (
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-tight mt-0.5 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-blue-600 dark:text-blue-400 break-all">
                    {storeData.phone}
                  </span>
                </div>
              )}
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
                  onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
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
  )

  return <StoreDetailModal store={storeData} trigger={card} />
}
